import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Flight perf measurement. Headless SwiftShader numbers are meaningless for
 * a WebGL game, so this only runs when PERF=1 (run headed):
 *   PERF=1 npx playwright test perf --headed
 * Writes eval/flight-perf.json at the repo root (same convention as
 * PosePuppet: numbers that could be quoted must come from a file).
 */

test("flight render fps baseline (headed)", async ({ page }) => {
  test.skip(!process.env.PERF, "PERF=1 + --headed required for honest numbers");

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

  const out = {
    date: new Date().toISOString(),
    mode: "headed",
    note: "P1 offline keyboard baseline — pre-body-input; flying with W held",
    renderFps: Math.round(sample.fps * 10) / 10,
    seconds: Math.round(sample.seconds * 10) / 10,
    longFramePct: Math.round(sample.longFramePct * 10) / 10,
    jsHeapMB: mem,
  };
  const evalDir = resolve(__dirname, "../../../eval");
  mkdirSync(evalDir, { recursive: true });
  writeFileSync(resolve(evalDir, "flight-perf.json"), JSON.stringify(out, null, 2) + "\n");
  console.log("flight-perf:", JSON.stringify(out));

  expect(sample.fps).toBeGreaterThan(45); // the floor; target is 60
});
