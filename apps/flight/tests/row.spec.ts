import { test, expect, chromium, type Browser, type Page } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * BodyArcade Rowing P2: strokes drive the boat.
 *
 * Headed like the rest of the suite (headless WebGL is compositor-
 * throttled). Signals are injected via the postMessage envelope with a
 * synthetic `stroke` block — deterministic impulse/steer/cruise/autopilot
 * tests — plus a closed-loop Full-Assist run whose speed↔stroke-rate
 * correlation and on-water record land in eval/flight-results.json.
 * ?row is the entry under test: the game starts straight on the water.
 */

const FLIGHT = "http://localhost:5199";

async function waitForBoat(page: Page) {
  await page.waitForFunction(
    () => {
      const f = (window as any).__FLIGHT;
      const s = f?.state();
      return (
        !!s && s.phase === "flying" && s.vehicle === "boat" &&
        s.introActive === false && s.controlsEnabled === true
      );
    },
    undefined,
    { timeout: 60_000 },
  );
}

/**
 * rAF-driven synthetic BodySignal pump with a stroke block. Strokes are
 * "performed" by advancing `count` on a schedule from `rateHz`; the game
 * only consumes count increments + amps + rate/active, so this is a
 * faithful stand-in for the package's detector output.
 */
async function startStrokePump(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    w.__row = { rateHz: 0, ampL: 0.4, ampR: 0.4, leanX: 0, count: 0, nextAt: 0 };
    const emit = () => {
      const r = w.__row;
      const now = performance.now();
      if (r.dead) {
        // tracking lost: stop posting, keep the loop alive for recovery
        requestAnimationFrame(emit);
        return;
      }
      if (r.rateHz > 0) {
        if (r.nextAt === 0) r.nextAt = now + 1000 / r.rateHz;
        if (now >= r.nextAt) {
          r.count++;
          r.nextAt += 1000 / r.rateHz;
        }
      } else {
        r.nextAt = 0;
      }
      const signal = {
        v: 1,
        ts: now,
        confidence: 1,
        seated: false,
        stillness: 0.2,
        neutralConfidence: 1,
        axes: {
          leanX: r.leanX, leanY: 0, crouch: 0, tallness: 0,
          armsOut: 0, armsRaised: 0, handsForward: 0.3, handPoint: 0,
        },
        events: [],
        stroke: {
          active: r.rateHz > 0,
          count: r.count,
          rate: r.rateHz,
          phase: 0.5,
          ampL: r.ampL,
          ampR: r.ampR,
        },
      };
      window.postMessage({ t: "bodyarcade.body-input.v1", signal }, "*");
      requestAnimationFrame(emit);
    };
    requestAnimationFrame(emit);
  });
}

async function setRow(page: Page, patch: Record<string, number>) {
  await page.evaluate((p) => {
    Object.assign((window as any).__row, p);
  }, patch);
}

async function stopPump(page: Page) {
  // stop emitting entirely by parking rate and freezing ts delivery:
  // easiest reliable "tracking lost" = stop posting (reload-free) — the
  // pump checks a kill flag.
  await page.evaluate(() => {
    ((window as any).__row as any).dead = true;
  });
}

async function boatState(page: Page) {
  return page.evaluate(() => {
    const f = (window as any).__FLIGHT;
    return { ...f.state(), row: f.row(), sample: f.rowSample() };
  });
}

async function meanHeadingRate(page: Page, ms: number): Promise<number> {
  const samples: number[] = [];
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const rate = await page.evaluate(() => (window as any).__FLIGHT.state()?.headingRateDegS ?? 0);
    samples.push(rate);
    await page.waitForTimeout(150);
  }
  return samples.reduce((s, v) => s + v, 0) / samples.length;
}

const repoRoot = resolve(__dirname, "../../..");
const rowingClip = resolve(repoRoot, "fixtures", "rowing", "rowing_slow.y4m");
const POSEPUPPET = "http://localhost:5173";

test("closed loop: rowing_slow.y4m through PosePuppet propels the boat", async () => {
  test.skip(!existsSync(rowingClip), "rowing_slow.y4m missing (local fixture)");
  test.setTimeout(240_000);

  const browser = await chromium.launch({
    headless: false,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${rowingClip}`,
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });

  // Producer: PosePuppet tracking the looping rowing clip (loop seams are
  // fine here — this spec needs sustained rhythm, not exact counts).
  const producer = await context.newPage();
  await producer.goto(POSEPUPPET);
  await producer.waitForFunction(() => (window as any).__PP?.videoReady === true, undefined, {
    timeout: 30_000,
  });
  await producer.waitForFunction(() => (window as any).__PP.detectionCount > 10, undefined, {
    timeout: 60_000,
  });

  // Consumer: the boat via ?row, signals relayed over the production bridge.
  const popupPromise = context.waitForEvent("page");
  await producer.evaluate((flightUrl) => {
    const w = window as any;
    w.__flightWin = window.open(`${flightUrl}/?row`, "bodyarcade-flight");
    w.__BI.source.subscribe((signal: unknown) => {
      w.__flightWin?.postMessage({ t: "bodyarcade.body-input.v1", signal }, "*");
    });
  }, FLIGHT);
  const flight = await popupPromise;
  await waitForBoat(flight);

  // Sample across ≥1 clip loop: real strokes must reach the boat as
  // impulses and sustain forward way; the boat must stay on water.
  const speeds: number[] = [];
  let strokes0: number | null = null;
  let strokes1 = 0;
  let onWaterAll = true;
  const t0 = Date.now();
  while (Date.now() - t0 < 60_000) {
    const s = await flight.evaluate(() => {
      const f = (window as any).__FLIGHT;
      return {
        speed: f.state()?.speed ?? 0,
        count: f.row()?.signal?.stroke?.count ?? 0,
        onWater: f.rowSample()?.onWater ?? true,
      };
    });
    if (strokes0 === null && s.count > 0) strokes0 = s.count;
    strokes1 = s.count;
    speeds.push(s.speed);
    onWaterAll &&= s.onWater;
    await flight.waitForTimeout(400);
  }

  const p75 = [...speeds].sort((a, b) => a - b)[Math.floor(speeds.length * 0.75)]!;
  expect(strokes1 - (strokes0 ?? 0)).toBeGreaterThanOrEqual(8); // rhythm reached the game
  expect(p75).toBeGreaterThan(0.15); // strokes translated into sustained way
  expect(onWaterAll).toBe(true);

  await browser.close();
});

test.describe("rowing drives the boat", () => {
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
    await page.goto(`${FLIGHT}/?row`);
    await waitForBoat(page);
    await startStrokePump(page);
    await page.waitForTimeout(2_000); // clear keyboard-priority window
  });
  test.afterEach(async () => {
    await page.close();
  });

  test("?row starts the boat; strokes surge it; stillness glides, never stops dead", async () => {
    test.setTimeout(120_000);
    await page.evaluate(() => (window as any).__FLIGHT.setRowAssist("expert")); // no cruise
    const s0 = await boatState(page);
    expect(s0.vehicle).toBe("boat");

    // 6 strokes at 0.6 Hz — the boat must pick up real speed
    await setRow(page, { rateHz: 0.6 });
    await page.waitForTimeout(10_000);
    const rowing = await boatState(page);
    expect(rowing.speed).toBeGreaterThan(0.2);

    // rest (signal stays fresh, no strokes): impulse-and-glide — speed
    // decays exponentially (τ ≈ 5.5 s), a graceful drift, never a stop
    await setRow(page, { rateHz: 0 });
    await page.waitForTimeout(5_000);
    const gliding = await boatState(page);
    expect(gliding.speed).toBeGreaterThan(rowing.speed * 0.3); // still carrying way
    expect(gliding.speed).toBeGreaterThan(0.08); // graceful drift, not a stop
  });

  test("cruise: steady strokes arm it, resting holds momentum", async () => {
    test.setTimeout(120_000);
    await page.evaluate(() => (window as any).__FLIGHT.setRowAssist("full"));
    await setRow(page, { rateHz: 0.7 });
    await page.waitForTimeout(12_000); // ≥ 6 steady strokes → armed
    const rowing = await boatState(page);
    expect(rowing.row.cruiseArmed).toBe(true);

    await setRow(page, { rateHz: 0 }); // rest, tracked
    await page.waitForTimeout(4_500); // > 2 periods at 0.7 Hz
    const resting = await boatState(page);
    expect(resting.row.cruiseHolding).toBe(true);
    const held0 = resting.speed;
    await page.waitForTimeout(5_000);
    const held = await boatState(page);
    expect(held.speed).toBeGreaterThan(held0 - 0.03); // momentum holds
  });

  test("both steering profiles turn with the documented signs", async () => {
    test.setTimeout(120_000);
    await page.evaluate(() => (window as any).__FLIGHT.setRowAssist("standard")); // no course-follow
    // keep way on so heading changes are visible in the world
    await setRow(page, { rateHz: 0.6 });

    // lean profile: lean right (+leanX) → negative heading rate (right turn)
    await page.evaluate(() => (window as any).__FLIGHT.setRowProfile("row-lean"));
    await setRow(page, { leanX: 0.6 });
    await page.waitForTimeout(800);
    const leanRight = await meanHeadingRate(page, 2_500);
    expect(leanRight).toBeLessThan(-6);
    await setRow(page, { leanX: -0.6 });
    await page.waitForTimeout(800);
    const leanLeft = await meanHeadingRate(page, 2_500);
    expect(leanLeft).toBeGreaterThan(6);
    await setRow(page, { leanX: 0 });

    // asymmetry profile: stronger LEFT pulls → right turn (negative rate)
    await page.evaluate(() => (window as any).__FLIGHT.setRowProfile("row-asym"));
    await setRow(page, { ampL: 0.55, ampR: 0.2 });
    await page.waitForTimeout(1_500);
    const asymLeft = await meanHeadingRate(page, 3_000);
    expect(asymLeft).toBeLessThan(-4);
    await setRow(page, { ampL: 0.2, ampR: 0.55 });
    await page.waitForTimeout(1_500);
    const asymRight = await meanHeadingRate(page, 3_000);
    expect(asymRight).toBeGreaterThan(4);
  });

  test("tracking loss: autopilot drifts straight and slows; re-entry never snaps", async () => {
    test.setTimeout(120_000);
    await page.evaluate(() => (window as any).__FLIGHT.setRowAssist("standard"));
    await page.evaluate(() => (window as any).__FLIGHT.setRowProfile("row-lean"));
    await setRow(page, { rateHz: 0.6, leanX: 0.6 });
    await page.waitForTimeout(6_000);
    const before = await boatState(page);
    expect(Math.abs(before.row.turnRate)).toBeGreaterThan(0.3);

    // kill the pump = tracking lost
    await stopPump(page);
    await page.waitForTimeout(2_000);
    const lost = await boatState(page);
    expect(["autopilot", "no-signal", "low-confidence"]).toContain(lost.row.reason);
    expect(Math.abs(lost.row.turnRate)).toBeLessThan(0.06); // drifting straight
    expect(lost.row.cruiseHolding).toBe(false); // slows on its own glide

    // recovery: pump resumes → slew-bounded blend, no turn-rate snap
    await page.evaluate(() => {
      ((window as any).__row as any).dead = false;
    });
    const rates: number[] = [];
    const t0 = Date.now();
    let prev: number | null = null;
    let maxStep = 0;
    while (Date.now() - t0 < 2_500) {
      const tr = await page.evaluate(() => (window as any).__FLIGHT.row()?.turnRate ?? 0);
      if (prev !== null) maxStep = Math.max(maxStep, Math.abs(tr - prev));
      prev = tr;
      rates.push(tr);
      await page.waitForTimeout(100);
    }
    // REACQUIRE_SLEW 2.0/s → ≤ ~0.2 per 100 ms sample (+ margin)
    expect(maxStep).toBeLessThanOrEqual(0.3);
    expect(Math.abs(rates[rates.length - 1]!)).toBeGreaterThan(0.3); // back to live
  });

  test("keyboard always wins over rowing input", async () => {
    test.setTimeout(120_000);
    await setRow(page, { rateHz: 0.7 });
    await page.waitForTimeout(5_000);
    // hold S (brake): body must yield instantly, boat brakes to a stop
    await page.keyboard.down("s");
    await page.waitForTimeout(1_500);
    const braked = await boatState(page);
    expect(braked.row.reason).toBe("keyboard");
    expect(braked.speed).toBeLessThan(0.05);
    await page.keyboard.up("s");
  });

  test("closed loop: 2-minute Full-Assist run stays on water; speed tracks stroke rate", async () => {
    test.setTimeout(240_000);
    await page.evaluate(() => (window as any).__FLIGHT.setRowAssist("full"));
    await page.evaluate(() => (window as any).__FLIGHT.setRowProfile("row-lean"));

    // 2-minute cadence program: slow → fast → rest → medium. Rates chosen
    // so steady-state speeds are distinct (0.3→~0.22, 0.8→cap 0.42,
    // 0.5→~0.37) — 0.55+ all saturate at the cap and can't separate.
    const program: [rateHz: number, seconds: number][] = [
      [0.3, 35], [0.8, 35], [0, 20], [0.5, 30],
    ];
    const samples: {
      rate: number; speed: number; onWater: boolean; crossTrack: number; settled: boolean;
    }[] = [];
    for (const [rateHz, seconds] of program) {
      await setRow(page, { rateHz });
      const t0 = Date.now();
      while (Date.now() - t0 < seconds * 1000) {
        const tInSeg = Date.now() - t0;
        const s = await page.evaluate(() => {
          const f = (window as any).__FLIGHT;
          const st = f.state();
          const sample = f.rowSample();
          const row = f.row();
          return {
            rate: row?.strokeRate ?? 0,
            speed: st?.speed ?? 0,
            onWater: sample?.onWater ?? false,
            crossTrack: sample?.crossTrack ?? 0,
          };
        });
        samples.push({ ...s, settled: tInSeg >= 12_000 });
        await page.waitForTimeout(500);
      }
    }

    const n = samples.length;
    const onWaterFrac = samples.filter((s) => s.onWater).length / n;
    const inBandFrac = samples.filter((s) => Math.abs(s.crossTrack) <= 1.75).length / n; // 0.35·R, R=5
    // Pearson r between stroke rate and speed over SETTLED active-rowing
    // samples: the glide constant is τ ≈ 5.5 s, so the first ~2τ of each
    // cadence segment is transition (same rate, speed still converging) —
    // measuring steady-state correlation requires settled windows. The
    // rest segment is excluded on purpose: cruise holds speed at zero
    // cadence by design, asserted separately (cruise spec).
    const rowingSamples = samples.filter((s) => s.rate > 0.05 && s.settled);
    const m = rowingSamples.length;
    const mx = rowingSamples.reduce((a, s) => a + s.rate, 0) / m;
    const my = rowingSamples.reduce((a, s) => a + s.speed, 0) / m;
    let sxy = 0, sxx = 0, syy = 0;
    for (const s of rowingSamples) {
      sxy += (s.rate - mx) * (s.speed - my);
      sxx += (s.rate - mx) ** 2;
      syy += (s.speed - my) ** 2;
    }
    const r = sxy / Math.sqrt(sxx * syy);
    const result = {
      date: new Date().toISOString(),
      mode: "headed",
      samples: n,
      rowingSamples: m,
      minutes: 2,
      onWaterFrac: Number(onWaterFrac.toFixed(4)),
      inBandFrac: Number(inBandFrac.toFixed(4)),
      crossTrackBandWorldUnits: 1.75,
      speedStrokeRatePearsonR: Number(r.toFixed(3)),
      note:
        "synthetic cadence program 0.3/0.8/0/0.5 Hz through the real boat + waterway; " +
        "r over settled (≥12 s ≈ 2τ into each segment) active-rowing samples — cruise " +
        "holds speed at zero cadence by design and is asserted separately",
    };
    console.log("rowing closed loop:", JSON.stringify(result));

    expect(onWaterFrac).toBe(1); // never beached
    expect(inBandFrac).toBeGreaterThanOrEqual(0.95); // follows the course
    expect(r).toBeGreaterThanOrEqual(0.6); // speed tracks the rhythm

    const evalDir = resolve(__dirname, "../../../eval");
    mkdirSync(evalDir, { recursive: true });
    const outPath = resolve(evalDir, "flight-results.json");
    const existing = existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf8")) : {};
    writeFileSync(outPath, JSON.stringify({ ...existing, rowingClosedLoop: result }, null, 2) + "\n");
  });
});
