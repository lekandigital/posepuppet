import { test, expect, chromium } from '@playwright/test';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Supported topology (the Flight Gate-2 lesson applied): PosePuppet serves
 * the BUILT dolphin app same-origin at /dolphin/ (vite middleware), so
 * BroadcastChannel body signals reach the game with no bridge or relay.
 * BroadcastChannel is origin-scoped — two dev-server ports can never share
 * it. Headed, same convention as the flight topology spec (headless
 * SwiftShader starves rAF and BC delivery).
 *
 * The fixture is fullbody.y4m: the swim-kick signal reads the vertical
 * chest–hip extent, so hips must be in frame for the live path to carry
 * a swim block worth asserting on.
 */

const repoRoot = resolve(HERE, '../../..');
const clip = resolve(repoRoot, 'fixtures', 'fullbody.y4m');
const dolphinDist = resolve(repoRoot, 'apps/dolphin/dist/index.html');
const POSEPUPPET = `http://localhost:${process.env.PP_PORT ?? '5173'}`;

test('live body signals reach /dolphin/ over same-origin BroadcastChannel', async () => {
  test.skip(!existsSync(clip), 'fullbody.y4m missing (local fixture)');
  test.setTimeout(180_000);

  if (!existsSync(dolphinDist)) {
    execSync('npm --prefix apps/dolphin run build', { cwd: repoRoot, stdio: 'ignore' });
  }

  const browser = await chromium.launch({
    headless: false,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${clip}`,
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });

  // Producer: PosePuppet tracking the fake webcam.
  const producer = await context.newPage();
  await producer.goto(POSEPUPPET);
  await producer.waitForFunction(() => (window as any).__PP?.detectionCount > 10, undefined, {
    timeout: 60_000,
  });

  // Consumer: the dolphin on the SAME origin — pure BroadcastChannel,
  // exactly what ⌘K → "swim" uses.
  const dolphin = await context.newPage();
  await dolphin.goto(`${POSEPUPPET}/dolphin/`);
  await dolphin.waitForFunction(() => !!(window as any).__DOLPHIN, undefined, { timeout: 30_000 });

  await dolphin.waitForFunction(
    () => {
      const t = (window as any).__DOLPHIN.transport();
      return t.gotBroadcast === true && t.ageMs < 500;
    },
    undefined,
    { timeout: 30_000 },
  );
  const t = await dolphin.evaluate(() => (window as any).__DOLPHIN.transport());
  expect(t.gotBroadcast).toBe(true);
  expect(t.ageMs).toBeLessThan(500);

  // Live tracker output, not a stuck frame: an axis moves across 2 s.
  const a1 = await dolphin.evaluate(() => (window as any).__DOLPHIN.transport().axes);
  await dolphin.waitForTimeout(2_000);
  const a2 = await dolphin.evaluate(() => (window as any).__DOLPHIN.transport().axes);
  expect(a1).not.toBeNull();
  const moved = ['leanX', 'leanY', 'crouch'].some(
    (k) => Math.abs((a2 as any)[k] - (a1 as any)[k]) > 1e-4,
  );
  expect(moved, 'at least one axis changed across 2 s of live tracking').toBe(true);

  // The dolphin is under body control end-to-end (tracking reads live).
  const st = await dolphin.evaluate(() => (window as any).__DOLPHIN.state());
  expect(st.tracking).toBe('live');
  await browser.close();
});
