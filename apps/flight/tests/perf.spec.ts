import { test, expect, chromium } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Flight perf measurement. Headless SwiftShader numbers are meaningless for
 * a WebGL game, so these only run when PERF=1:
 *   PERF=1 npx playwright test perf
 * Both tests launch their own headed browser (same convention as body/feel).
 * Writes eval/flight-perf.json at the repo root (same convention as
 * PosePuppet: numbers that could be quoted must come from a file).
 */

test("flight render fps baseline (headed)", async () => {
  test.skip(!process.env.PERF, "PERF=1 required for honest numbers");
  test.setTimeout(180_000);

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ baseURL: "http://localhost:5199" });

  await page.goto("/");
  await expect(page.locator("#btn-fly")).toBeVisible({ timeout: 20_000 });
  await page.click("#btn-fly");
  await expect(page.locator("#hud")).toBeAttached({ timeout: 30_000 });

  // Let the intro settle, then measure while actually flying (W + turns).
  await page.waitForTimeout(2_000);
  await page.keyboard.down("w");

  const sample = await page.evaluate(
    () =>
      new Promise<{ fps: number; frames: number; seconds: number; longFramePct: number }>(
        (resolveP) => {
          const SECONDS = 15;
          let frames = 0;
          let longFrames = 0;
          let last = performance.now();
          const t0 = last;
          const tick = (now: number) => {
            frames++;
            if (now - last > 25) longFrames++; // frame over 25 ms = sub-40fps moment
            last = now;
            if (now - t0 < SECONDS * 1000) {
              requestAnimationFrame(tick);
            } else {
              resolveP({
                fps: frames / ((now - t0) / 1000),
                frames,
                seconds: (now - t0) / 1000,
                longFramePct: (100 * longFrames) / frames,
              });
            }
          };
          requestAnimationFrame(tick);
        },
      ),
  );
  await page.keyboard.up("w");

  const mem = await page.evaluate(() => {
    const m = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    return m ? Math.round(m.usedJSHeapSize / 1e6) : null;
  });

  const baseline = {
    date: new Date().toISOString(),
    mode: "headed",
    note: "offline keyboard baseline — no body input; flying with W held",
    renderFps: Math.round(sample.fps * 10) / 10,
    seconds: Math.round(sample.seconds * 10) / 10,
    longFramePct: Math.round(sample.longFramePct * 10) / 10,
    jsHeapMB: mem,
  };
  const evalDir = resolve(__dirname, "../../../eval");
  mkdirSync(evalDir, { recursive: true });
  const perfPath = resolve(evalDir, "flight-perf.json");
  const existing = existsSync(perfPath) ? JSON.parse(readFileSync(perfPath, "utf8")) : {};
  writeFileSync(perfPath, JSON.stringify({ ...existing, baseline }, null, 2) + "\n");
  console.log("flight-perf baseline:", JSON.stringify(baseline));

  expect(sample.fps).toBeGreaterThan(45); // the floor; target is 60

  await browser.close();
});

/**
 * P4 target: 60 fps render (floor 45) on the game WHILE the pose loop runs
 * at ≥ 15 Hz — the real two-window session. Uses the production entry path
 * (the Fly card → companion mode: lite model + suspended stage).
 *   PERF=1 npx playwright test perf
 */
test("combined session: game fps with live pose loop (headed)", async () => {
  test.skip(!process.env.PERF, "PERF=1 required for honest numbers");
  const armsClip = resolve(__dirname, "../../../fixtures/arms.y4m");
  test.skip(!existsSync(armsClip), "arms.y4m missing (local fixture)");
  test.setTimeout(240_000);

  const browser = await chromium.launch({
    headless: false,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${armsClip}`,
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const producer = await context.newPage();
  await producer.goto("http://localhost:5173/");
  await producer.waitForFunction(() => (window as any).__PP?.detectionCount > 10, undefined, {
    timeout: 60_000,
  });

  // Enter via the real Fly card: companion mode (lite model, stage paused).
  const popupPromise = context.waitForEvent("page");
  await producer.click("#fly-btn");
  const flight = await popupPromise;
  await flight.waitForLoadState("domcontentloaded");
  // Autostart into the cockpit for the measurement window.
  await flight.goto("http://localhost:5173/flight/?autostart=1");
  await flight.waitForFunction(
    () => {
      const s = (window as any).__FLIGHT?.state();
      return !!s && s.phase === "flying" && s.introActive === false && s.controlsEnabled === true;
    },
    undefined,
    { timeout: 60_000 },
  );
  await flight.waitForTimeout(2_000);

  const [flightSample, poseFps, bodyRate] = await Promise.all([
    flight.evaluate(
      () =>
        new Promise<{ fps: number; longFramePct: number }>((resolveP) => {
          const SECONDS = 15;
          let frames = 0;
          let longFrames = 0;
          let last = performance.now();
          const t0 = last;
          const tick = (now: number) => {
            frames++;
            if (now - last > 25) longFrames++;
            last = now;
            if (now - t0 < SECONDS * 1000) requestAnimationFrame(tick);
            else
              resolveP({
                fps: frames / ((now - t0) / 1000),
                longFramePct: (100 * longFrames) / frames,
              });
          };
          requestAnimationFrame(tick);
        }),
    ),
    (async () => {
      await producer.waitForTimeout(15_000);
      return producer.evaluate(() => (window as any).__PP.poseFps());
    })(),
    (async () => {
      await flight.waitForTimeout(14_000);
      return flight.evaluate(() => (window as any).__FLIGHT.body().signalRateHz);
    })(),
  ]);

  const companion = await producer.evaluate(() => ({
    // Companion-mode proof: the Fly card switched the producer to lite.
    model: JSON.parse(localStorage.getItem("posepuppet-config-v3") ?? "{}").model ?? "unknown",
  }));

  const evalDir = resolve(__dirname, "../../../eval");
  mkdirSync(evalDir, { recursive: true });
  const perfPath = resolve(evalDir, "flight-perf.json");
  const existing = existsSync(perfPath) ? JSON.parse(readFileSync(perfPath, "utf8")) : {};
  const out = {
    ...existing,
    combined: {
      date: new Date().toISOString(),
      mode: "headed",
      note: "P4 two-window session via Fly card — companion mode (lite model, stage suspended)",
      flightRenderFps: Math.round(flightSample.fps * 10) / 10,
      flightLongFramePct: Math.round(flightSample.longFramePct * 10) / 10,
      poseFps: Math.round(poseFps * 10) / 10,
      bodySignalRateHz: Math.round(bodyRate * 10) / 10,
      producerModel: companion.model,
    },
  };
  writeFileSync(perfPath, JSON.stringify(out, null, 2) + "\n");
  console.log("combined-perf:", JSON.stringify(out.combined));

  expect(flightSample.fps).toBeGreaterThan(45); // floor; target 60
  expect(poseFps).toBeGreaterThanOrEqual(15);

  await browser.close();
});
