import { test, expect, chromium, type Browser, type Page } from "@playwright/test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * P2: the body flies the actual TinySkies plane.
 *
 * These specs run HEADED: a WebGL game page with no media stream gets
 * compositor-throttled to ~1 rAF/s in new headless Chrome (measured — the
 * game loop froze), same reason PosePuppet's eval runs headed. Project
 * convention: headless asserts correctness where it can, headed asserts
 * anything that needs a live render loop.
 *
 * Specs 1–2 inject synthetic BodySignal frames via the postMessage envelope
 * (shape-guarded on the flight side) — deterministic mapping/merge tests.
 * Spec 3 is the real closed loop: lean_lr.y4m → fake webcam → PosePuppet
 * tracker → body-input core → postMessage relay → flight page → sustained
 * signed turns both directions. Landmarks never cross; only BodySignal does.
 */

const FLIGHT = "http://localhost:5199";
const POSEPUPPET = "http://localhost:5173";
const repoRoot = resolve(__dirname, "../../..");
const leanClip = resolve(repoRoot, "fixtures", "flight", "lean_lr.y4m");

async function waitForFlying(page: Page) {
  await page.waitForFunction(
    () => {
      const f = (window as any).__FLIGHT;
      const s = f?.state();
      return !!s && s.phase === "flying" && s.introActive === false && s.controlsEnabled === true;
    },
    undefined,
    { timeout: 60_000 },
  );
}

/** rAF-driven synthetic BodySignal pump (setInterval gets throttled). */
async function startSignalPump(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    w.__pump = {
      axes: {
        leanX: 0, leanY: 0, crouch: 0, tallness: 0,
        armsOut: 0, armsRaised: 0, handsForward: 0, handPoint: 0,
      },
    };
    const emit = () => {
      const signal = {
        v: 1,
        ts: performance.now(),
        confidence: 1,
        seated: false,
        stillness: 0.2,
        neutralConfidence: 1,
        axes: { ...w.__pump.axes },
        events: [],
      };
      window.postMessage({ t: "bodyarcade.body-input.v1", signal }, "*");
      requestAnimationFrame(emit);
    };
    requestAnimationFrame(emit);
  });
}

async function setPumpAxes(page: Page, axes: Record<string, number>) {
  await page.evaluate((a) => {
    Object.assign((window as any).__pump.axes, a);
  }, axes);
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

test.describe("body flies the plane", () => {
  let browser: Browser;

  test.beforeAll(async () => {
    browser = await chromium.launch({ headless: false });
  });
  test.afterAll(async () => {
    await browser.close();
  });

  test("synthetic lean turns the plane; speed and altitude axes respond", async () => {
    test.setTimeout(120_000);
    const page = await browser.newPage();
    await page.goto(`${FLIGHT}/?autostart=1`);
    await waitForFlying(page);
    // Pin the profile: the default is Superman (Gate-2 pick), whose
    // arms-down arming gate would treat this pump's neutral arms as
    // "stabilize" — these specs test the Pilot Lean mapping.
    await page.evaluate(() => (window as any).__FLIGHT.setProfile("pilot-lean"));
    await startSignalPump(page);

    // Neutral body, no keyboard → near-zero heading rate.
    await page.waitForTimeout(2_000); // clear keyboard-priority window
    const neutral = await meanHeadingRate(page, 2_000);
    expect(Math.abs(neutral)).toBeLessThan(4);

    // Lean right → negative heading rate (right turn), sustained.
    await setPumpAxes(page, { leanX: 0.7 });
    await page.waitForTimeout(800);
    const right = await meanHeadingRate(page, 2_500);
    expect(right).toBeLessThan(-12);

    // Lean left → positive heading rate.
    await setPumpAxes(page, { leanX: -0.7 });
    await page.waitForTimeout(800);
    const left = await meanHeadingRate(page, 2_500);
    expect(left).toBeGreaterThan(12);

    // Lean forward → speed toward cruise; lean back → slow down. Full
    // Assist (default) floors speedAxis at −0.5 ⇒ slow target is exactly
    // 0.3 + 0.5·0.25 = 0.425 — the throttle floor, not min speed.
    await setPumpAxes(page, { leanX: 0, leanY: 0.8 });
    await page.waitForTimeout(2_500);
    const fastSpeed = await page.evaluate(() => (window as any).__FLIGHT.state().speed);
    await setPumpAxes(page, { leanY: -0.8 });
    await page.waitForTimeout(3_000);
    const slowSpeed = await page.evaluate(() => (window as any).__FLIGHT.state().speed);
    expect(fastSpeed).toBeGreaterThan(0.55);
    expect(slowSpeed).toBeLessThan(0.46);
    expect(slowSpeed).toBeGreaterThan(0.38); // the assist floor is holding

    // Stand tall → climb above the cruise band.
    const altBefore = await page.evaluate(() => (window as any).__FLIGHT.state().altitude);
    await setPumpAxes(page, { leanY: 0, tallness: 0.9 });
    await page.waitForTimeout(3_000);
    const altAfter = await page.evaluate(() => (window as any).__FLIGHT.state().altitude);
    expect(altAfter).toBeGreaterThan(altBefore + 0.1);

    await page.close();
  });

  test("keyboard always wins over body input", async () => {
    test.setTimeout(120_000);
    const page = await browser.newPage();
    await page.goto(`${FLIGHT}/?autostart=1`);
    await waitForFlying(page);
    await page.evaluate(() => (window as any).__FLIGHT.setProfile("pilot-lean"));
    await startSignalPump(page);
    await setPumpAxes(page, { leanX: 0.9 }); // body says: hard right

    await page.waitForTimeout(2_000);
    // Hold A (turn left). Keyboard must own the plane despite the body lean.
    await page.keyboard.down("a");
    await page.waitForTimeout(1_000);
    const kb = await meanHeadingRate(page, 2_000);
    await page.keyboard.up("a");
    expect(kb).toBeGreaterThan(20);

    // After the priority window lapses, the body takes over again (right).
    await page.waitForTimeout(2_200);
    const body = await meanHeadingRate(page, 2_000);
    expect(body).toBeLessThan(-12);

    await page.close();
  });
});

test("closed loop: lean_lr.y4m through PosePuppet turns the plane both ways", async () => {
  test.skip(!existsSync(leanClip), "lean_lr.y4m missing (local fixture)");
  test.setTimeout(240_000);

  const browser = await chromium.launch({
    headless: false,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${leanClip}`,
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });

  // Producer: PosePuppet with the fake webcam running the tracker.
  const producer = await context.newPage();
  await producer.goto(POSEPUPPET);
  await producer.waitForFunction(() => (window as any).__PP?.videoReady === true, undefined, {
    timeout: 30_000,
  });
  await producer.waitForFunction(() => (window as any).__PP.detectionCount > 10, undefined, {
    timeout: 60_000,
  });

  // Consumer: flight page opened by the producer (cross-origin popup), the
  // producer relaying BodySignal via postMessage — the production bridge.
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

  // Sample heading rate across ≥2 full clip loops: the fake webcam loops
  // the file, and neutral capture can land on an awkward loop phase (it
  // self-corrects at the next stillness dwell) — long sampling makes the
  // spec independent of loop phase, same as the crouch_stand spec.
  const samples: number[] = [];
  const t0 = Date.now();
  while (Date.now() - t0 < 70_000) {
    const rate = await flight.evaluate(() => (window as any).__FLIGHT.state()?.headingRateDegS ?? 0);
    samples.push(rate);
    await flight.waitForTimeout(200);
  }

  // Structural: ≥1 sustained window (≥1.2 s) of signed turn EACH direction
  // beyond ±8°/s — the clip leans both ways.
  const sustained = (sign: 1 | -1) => {
    let run = 0;
    let best = 0;
    for (const s of samples) {
      run = sign * s > 8 ? run + 1 : 0;
      best = Math.max(best, run);
    }
    return best >= 6;
  };
  expect(sustained(-1), "sustained right turn during right-lean window").toBe(true);
  expect(sustained(1), "sustained left turn during left-lean window").toBe(true);

  await browser.close();
});
