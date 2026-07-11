import { test, expect, chromium, type Browser, type Page } from "@playwright/test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * P3 Feel Lab: autopilot-on-loss, slew-bounded re-entry, neutral drift law,
 * boost hysteresis + refractory, profile arming, assist-ladder caps —
 * synthetic signals for determinism, plus one real closed loop
 * (crouch_stand.y4m → altitude follows stature). Headed: see body.spec.ts.
 */

const FLIGHT = "http://localhost:5199";
const POSEPUPPET = `http://localhost:${process.env.PP_PORT ?? "5173"}`;
const repoRoot = resolve(__dirname, "../../..");
const crouchClip = resolve(repoRoot, "fixtures", "flight", "crouch_stand.y4m");

async function waitForFlying(page: Page) {
  await page.waitForFunction(
    () => {
      const s = (window as any).__FLIGHT?.state();
      return !!s && s.phase === "flying" && s.introActive === false && s.controlsEnabled === true;
    },
    undefined,
    { timeout: 60_000 },
  );
}

async function startSignalPump(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    w.__pump = {
      running: true,
      axes: {
        leanX: 0, leanY: 0, crouch: 0, tallness: 0,
        armsOut: 0, armsRaised: 0, handsForward: 0, handPoint: 0,
      },
      events: [] as string[],
    };
    const emit = () => {
      if (w.__pump.running) {
        const signal = {
          v: 1,
          ts: performance.now(),
          confidence: 1,
          seated: false,
          stillness: 0.2,
          neutralConfidence: 1,
          axes: { ...w.__pump.axes },
          events: w.__pump.events.splice(0),
        };
        window.postMessage({ t: "bodyarcade.body-input.v1", signal }, "*");
      }
      requestAnimationFrame(emit);
    };
    requestAnimationFrame(emit);
  });
}

const setAxes = (page: Page, axes: Record<string, number>) =>
  page.evaluate((a) => Object.assign((window as any).__pump.axes, a), axes);
const setPumpRunning = (page: Page, running: boolean) =>
  page.evaluate((r) => ((window as any).__pump.running = r), running);

async function sampleRates(page: Page, ms: number, everyMs = 150): Promise<number[]> {
  const out: number[] = [];
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    out.push(await page.evaluate(() => (window as any).__FLIGHT.state()?.headingRateDegS ?? 0));
    await page.waitForTimeout(everyMs);
  }
  return out;
}
const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;

test.describe("feel lab", () => {
  let browser: Browser;
  let page: Page;

  test.beforeAll(async () => {
    browser = await chromium.launch({ headless: false });
  });
  test.afterAll(async () => {
    await browser.close();
  });

  test.beforeEach(async () => {
    page = await browser.newPage();
    await page.goto(`${FLIGHT}/?autostart=1`);
    await waitForFlying(page);
    await page.evaluate(() => (window as any).__FLIGHT.setProfile("pilot-lean"));
    await page.evaluate(() => (window as any).__FLIGHT.setAssist("full"));
    await startSignalPump(page);
    await page.waitForTimeout(2_000); // clear keyboard-priority window
  });
  test.afterEach(async () => {
    await page.close();
  });

  test("neutral body = straight and level (drift law)", async () => {
    test.setTimeout(120_000);
    const rates = await sampleRates(page, 8_000);
    expect(Math.abs(mean(rates))).toBeLessThan(2);
    const s = await page.evaluate(() => (window as any).__FLIGHT.state());
    expect(Math.abs((s.bankAngle * 180) / Math.PI)).toBeLessThan(3);
    expect(s.speed).toBeGreaterThan(0.25);
    expect(s.altitude).toBeGreaterThan(0.3); // never sagging into terrain
  });

  test("dropout → autopilot decays to level; re-entry is slew-bounded", async () => {
    test.setTimeout(120_000);
    await setAxes(page, { leanX: 0.8 });
    await page.waitForTimeout(1_500);
    const turning = mean(await sampleRates(page, 1_500));
    expect(turning).toBeLessThan(-20); // hard right turn in progress

    // Tracking loss mid-turn.
    await setPumpRunning(page, false);
    await page.waitForTimeout(1_500);
    const reason = await page.evaluate(() => (window as any).__FLIGHT.body().reason);
    expect(reason).toBe("autopilot");
    const level = await sampleRates(page, 2_500);
    expect(Math.abs(mean(level))).toBeLessThan(3); // straight and level again
    const alt = await page.evaluate(() => (window as any).__FLIGHT.state().altitude);
    expect(alt).toBeGreaterThan(0.3); // no terrain contact during loss

    // Recovery: still leaning right — intent returns, but bounded (no snap).
    const before = await page.evaluate(() => (window as any).__FLIGHT.state().headingRateDegS);
    await setPumpRunning(page, true);
    const rates = await sampleRates(page, 2_500, 100);
    let maxStep = 0;
    let prev = before;
    for (const r of rates) {
      maxStep = Math.max(maxStep, Math.abs(r - prev));
      prev = r;
    }
    // Slew cap 2.0 intent/s ⇒ heading-rate ramps; a snap would jump the
    // full ~55°/s in one 100 ms sample. Bound generously below that.
    expect(maxStep).toBeLessThan(30);
    expect(mean(rates.slice(-8))).toBeLessThan(-20); // back in the turn
  });

  test("hands-forward boost: fires once, refractory blocks the retrigger", async () => {
    test.setTimeout(120_000);
    const cruiseMax = 0.8;
    await setAxes(page, { handsForward: 0.9 });
    await page.waitForTimeout(1_200);
    const boosted = await page.evaluate(() => (window as any).__FLIGHT.state().speed);
    expect(boosted).toBeGreaterThan(cruiseMax + 0.1); // boost pinned past cruise

    // Release and immediately re-thrust inside the refractory window.
    await setAxes(page, { handsForward: 0.2 });
    await page.waitForTimeout(400);
    await setAxes(page, { handsForward: 0.9 });
    await page.waitForTimeout(400);
    const armedIn = await page.evaluate(() => (window as any).__FLIGHT.body().boostArmedIn);
    expect(armedIn).toBeGreaterThan(0); // still cooling down — no second boost
  });

  test("superman arms: arms down stabilizes, arms out flies", async () => {
    test.setTimeout(120_000);
    await page.evaluate(() => (window as any).__FLIGHT.setProfile("superman"));
    await setAxes(page, { leanX: 0.8, armsOut: 0 }); // leaning but arms down
    await page.waitForTimeout(1_200);
    expect(await page.evaluate(() => (window as any).__FLIGHT.body().reason)).toBe("unarmed");
    const idle = mean(await sampleRates(page, 2_000));
    expect(Math.abs(idle)).toBeLessThan(3); // stabilized despite the lean

    await setAxes(page, { armsOut: 0.7 }); // arms out — now it flies
    await page.waitForTimeout(1_200);
    const flying = mean(await sampleRates(page, 2_000));
    expect(flying).toBeLessThan(-15);
  });

  test("head pilot: speed automated, lean back climbs", async () => {
    test.setTimeout(120_000);
    await page.evaluate(() => (window as any).__FLIGHT.setProfile("head-pilot"));
    await page.waitForTimeout(3_000);
    const s1 = await page.evaluate(() => (window as any).__FLIGHT.state());
    expect(s1.speed).toBeGreaterThan(0.5); // automated cruise, no lean needed

    const altBefore = s1.altitude;
    await setAxes(page, { leanY: -0.5 }); // lean back
    await page.waitForTimeout(3_000);
    const altAfter = await page.evaluate(() => (window as any).__FLIGHT.state().altitude);
    expect(altAfter).toBeGreaterThan(altBefore + 0.08);
  });

  test("assist ladder caps turn authority (full < expert)", async () => {
    test.setTimeout(120_000);
    await setAxes(page, { leanX: 1.0 });
    await page.waitForTimeout(1_500);
    const full = mean(await sampleRates(page, 2_000));

    await page.evaluate(() => (window as any).__FLIGHT.setAssist("expert"));
    await page.waitForTimeout(1_500);
    const expert = mean(await sampleRates(page, 2_000));

    expect(Math.abs(expert)).toBeGreaterThan(Math.abs(full) + 8);
    // Full Assist cap: |turnRate| ≤ 0.95 rad/s ≈ 54°/s.
    expect(Math.abs(full)).toBeLessThan(58);
  });

  test("T-pose recenter event surfaces to the player", async () => {
    test.setTimeout(120_000);
    await page.evaluate(() => (window as any).__pump.events.push("recenter"));
    await page.waitForTimeout(300);
    const flash = await page.evaluate(() => (window as any).__FLIGHT.body().recenterFlashMs);
    expect(flash).toBeGreaterThan(0);
  });
});

test("closed loop: crouch_stand.y4m moves altitude down and up", async () => {
  test.skip(!existsSync(crouchClip), "crouch_stand.y4m missing (local fixture)");
  test.setTimeout(240_000);

  const browser = await chromium.launch({
    headless: false,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${crouchClip}`,
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const producer = await context.newPage();
  await producer.goto(POSEPUPPET);
  await producer.waitForFunction(() => (window as any).__PP?.videoReady === true, undefined, {
    timeout: 30_000,
  });
  await producer.waitForFunction(() => (window as any).__PP.detectionCount > 10, undefined, {
    timeout: 60_000,
  });

  const popupPromise = context.waitForEvent("page");
  await producer.evaluate((flightUrl) => {
    const w = window as any;
    w.__flightWin = window.open(`${flightUrl}/?autostart=1`, "bodyarcade-flight");
    w.__BI.source.subscribe((signal: unknown) => {
      w.__flightWin?.postMessage({ t: "bodyarcade.body-input.v1", signal }, "*");
    });
  }, FLIGHT);
  const flight = await popupPromise;
  await waitForFlying(flight);
  await flight.evaluate(() => (window as any).__FLIGHT.setProfile("pilot-lean"));

  // Sample altitude across ≥2 full loops of the clip. The fake webcam loops
  // the file continuously, so the body-input neutral can be captured at an
  // awkward loop phase; it self-corrects at the next stillness dwell —
  // sampling long makes the spec independent of loop phase.
  const alts: number[] = [];
  const t0 = Date.now();
  while (Date.now() - t0 < 70_000) {
    alts.push(await flight.evaluate(() => (window as any).__FLIGHT.state()?.altitude ?? 0));
    await flight.waitForTimeout(250);
  }

  // The clip is crouch → return-to-standing cycles: standing is NEUTRAL
  // (cruise), not an upward stretch, so the law here is descend + recover.
  // (Climb needs a deliberate stretch — tallness — validated synthetically.)
  // Dips are measured against the observed baseline, not absolutes.
  const sorted = [...alts].sort((a, b) => a - b);
  const baseline = sorted[Math.floor(sorted.length / 2)]!; // median ≈ cruise
  const min = Math.min(...alts);
  expect(baseline - min, `crouch depth below baseline ${baseline.toFixed(2)}`).toBeGreaterThan(0.1);

  // Count descend→recover cycles relative to baseline.
  let cycles = 0;
  let dipped = false;
  for (const a of alts) {
    if (!dipped && a < baseline - 0.08) dipped = true;
    else if (dipped && a > baseline - 0.03) {
      cycles++;
      dipped = false;
    }
  }
  expect(
    cycles,
    `descend→recover cycles (baseline ${baseline.toFixed(2)}, altitudes: ${alts.map((a) => a.toFixed(2)).join(",")})`,
  ).toBeGreaterThanOrEqual(2);

  await browser.close();
});
