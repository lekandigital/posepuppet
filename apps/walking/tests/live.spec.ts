// Live-mode smoke: the page boots the real pose-runtime (fake webcam,
// still-person clip), mounts the shared HUD, and idles cleanly — no
// steps minted from a person who isn't walking, no console errors.
import { test, expect } from '@playwright/test';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const cachedFixture = resolve(here, '../../../.local/cache/fake-camera/arms_tpose.y4m');

const swiftShaderArgs = process.env.USE_SWIFTSHADER
  ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
     '--disable-accelerated-video-decode']
  : [];

test.use({
  permissions: ['camera'],
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${cachedFixture}`,
      '--autoplay-policy=no-user-gesture-required',
      ...swiftShaderArgs,
    ],
  },
});

test('live boot: runtime runs, HUD mounts, still person mints no steps', async ({ page }) => {
  test.skip(!existsSync(cachedFixture), 'fake-camera cache not prepared');
  const errors: string[] = [];
  page.on('pageerror', (e) => {
    // "ModuleFactory not set." is the documented tasks-vision module-worker
    // failure the runtime recovers from by falling back to the other
    // delegate (pose-runtime runtime.ts) — expected on SwiftShader
    if (!String(e).includes('ModuleFactory not set')) errors.push(String(e));
  });

  await page.goto('/walking/');
  await page.waitForFunction(
    () => (window as never as { __WALK?: { runtimeState(): string } }).__WALK?.runtimeState() === 'running',
    undefined, { timeout: 45_000 },
  );
  // shared HUD mounted (the V1 overlay)
  await page.waitForFunction(
    () => (window as never as { __PP_HUD?: unknown }).__PP_HUD !== undefined,
    undefined, { timeout: 10_000 },
  );
  // give tracking a few seconds on the still clip
  await page.waitForTimeout(6000);
  const pose = await page.evaluate(
    () => (window as never as { __WALK: { pose(): { speed: number; mode: string } } }).__WALK.pose(),
  );
  expect(pose.speed).toBeLessThan(0.05); // nobody walked
  expect(errors).toEqual([]);
});
