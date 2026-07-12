import { test, expect, chromium } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Replay tolerance (acceptance item): a recorded intent stream re-run
 * through the REAL Plane class reproduces the flight path within a
 * documented tolerance.
 *
 * TinySkies runs a variable timestep (dt clamped at 50 ms), so the tape
 * records dt per frame alongside the final merged inputs (post keyboard/
 * body merge, post twister/level-up overrides) plus a full kinematic
 * snapshot at tape start. Replay = fresh Plane + snapshot + tape.
 *
 * Honest caveats, measured not hidden: events that mutate the plane
 * OUTSIDE Plane.update (ring-collect speed boosts, gremlin hits) are not
 * in the tape; the scripted flight below avoids them (short, gentle, no
 * boost gesture; gremlins spawn at 30 s). The measured error lands in
 * eval/flight-results.json — the number quoted anywhere must come from
 * there.
 */

const FLIGHT = `http://localhost:${process.env.FLIGHT_PORT ?? "5199"}`;

test("recorded intent tape replays within documented tolerance", async () => {
  test.setTimeout(180_000);

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(`${FLIGHT}/?autostart=1&record-intents=1`);
  await page.waitForFunction(
    () => {
      const s = (window as any).__FLIGHT?.state();
      return !!s && s.phase === "flying" && s.introActive === false && s.controlsEnabled === true;
    },
    undefined,
    { timeout: 60_000 },
  );
  await page.evaluate(() => (window as any).__FLIGHT.setProfile("pilot-lean"));

  // Synthetic pump (rAF-driven), then a scripted 12 s maneuver set.
  await page.evaluate(() => {
    const w = window as any;
    w.__pump = {
      axes: {
        leanX: 0, leanY: 0, crouch: 0, tallness: 0,
        armsOut: 0, armsRaised: 0, handsForward: 0, handPoint: 0,
      },
    };
    const emit = () => {
      window.postMessage(
        {
          t: "bodyarcade.body-input.v1",
          signal: {
            v: 1, ts: performance.now(), confidence: 1, seated: false,
            stillness: 0.2, neutralConfidence: 1,
            axes: { ...w.__pump.axes }, events: [],
          },
        },
        "*",
      );
      requestAnimationFrame(emit);
    };
    requestAnimationFrame(emit);
  });
  const move = (axes: Record<string, number>) =>
    page.evaluate((a) => Object.assign((window as any).__pump.axes, a), axes);

  await page.waitForTimeout(2_500); // settle keyboard-priority + smoothing
  await move({ leanX: 0.6 });
  await page.waitForTimeout(3_000);
  await move({ leanX: -0.5 });
  await page.waitForTimeout(3_000);
  await move({ leanX: 0, leanY: 0.6 });
  await page.waitForTimeout(2_000);
  await move({ leanY: 0, tallness: 0.8 });
  await page.waitForTimeout(2_000);
  await move({ tallness: 0 });
  await page.waitForTimeout(1_500);

  // Pull the tape and replay it in-page through a fresh real Plane.
  const result = await page.evaluate(() => {
    const tape = (window as any).__FLIGHT_TAPE;
    const n = Math.min(tape.frames.length, tape.live.length);
    const frames = tape.frames.slice(0, n);
    const live = tape.live.slice(0, n);
    const sim = (window as any).__FLIGHT.simulateTape(tape.initial, frames);

    const globeRadius = 5;
    let maxPosArc = 0;
    let maxHeadingDeg = 0;
    let maxAlt = 0;
    let maxSpeed = 0;
    for (let i = 0; i < n; i++) {
      const a = live[i];
      const b = sim[i];
      const dot = Math.abs(a.qx * b.qx + a.qy * b.qy + a.qz * b.qz + a.qw * b.qw);
      const posArc = 2 * Math.acos(Math.min(1, dot)) * globeRadius;
      let dh = Math.abs(a.heading - b.heading) % (Math.PI * 2);
      if (dh > Math.PI) dh = Math.PI * 2 - dh;
      maxPosArc = Math.max(maxPosArc, posArc);
      maxHeadingDeg = Math.max(maxHeadingDeg, (dh * 180) / Math.PI);
      maxAlt = Math.max(maxAlt, Math.abs(a.altitude - b.altitude));
      maxSpeed = Math.max(maxSpeed, Math.abs(a.speed - b.speed));
    }
    const dts = frames.map((f: { dt: number }) => f.dt);
    return {
      frames: n,
      tapeSeconds: dts.reduce((s: number, v: number) => s + v, 0),
      dtMinMs: Math.round(Math.min(...dts) * 10000) / 10,
      dtMaxMs: Math.round(Math.max(...dts) * 10000) / 10,
      maxPosArcWorldUnits: maxPosArc,
      maxHeadingErrDeg: maxHeadingDeg,
      maxAltitudeErr: maxAlt,
      maxSpeedErr: maxSpeed,
    };
  });
  console.log("replay:", JSON.stringify(result));

  // Documented tolerance: path within 0.02 world units (globe radius 5 —
  // i.e. 0.4% of R) and heading within 0.5°. Measured values are written
  // to eval/flight-results.json; the assertion is the ceiling, the file
  // is the truth.
  expect(result.frames).toBeGreaterThan(300);
  expect(result.maxPosArcWorldUnits).toBeLessThan(0.02);
  expect(result.maxHeadingErrDeg).toBeLessThan(0.5);

  const evalDir = resolve(__dirname, "../../../eval");
  mkdirSync(evalDir, { recursive: true });
  const outPath = resolve(evalDir, "flight-results.json");
  const existing = existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf8")) : {};
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        ...existing,
        replay: {
          date: new Date().toISOString(),
          mode: "headed",
          note: "intent tape (variable dt, recorded per frame) replayed through a fresh Plane",
          ...result,
        },
      },
      null,
      2,
    ) + "\n",
  );

  await browser.close();
});
