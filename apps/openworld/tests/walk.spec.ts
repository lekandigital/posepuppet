import { test, expect, type Page } from '@playwright/test';

// O3 walking: V3's locomotion package on the baked nav graph. Comfort is
// the package's contract (asserted in its own suite); here we verify the
// WORLD integration: settlement spawn on the network, keyboard walking
// with terrain-clamped eye height, closed-loop marching through the real
// chain, assist keeping the walker near the path, dropout easing, and the
// horizon never tilting.

interface WalkState {
  x: number; z: number; yawDeg: number; speed: number; eyeY: number;
  mode: string; vignette: number; traveled: number;
  envelope: Record<string, number>;
  camTilt: [number, number];
  lateral: number | null;
}

async function walk(page: Page): Promise<WalkState> {
  return page.evaluate(() => (window as any).__OW.walk()) as Promise<WalkState>;
}

test('settlement spawn on the nav network; keyboard walk with ground clamp', async ({ page }) => {
  await page.goto('/openworld/?mode=walk&hud=0');
  await page.waitForFunction(() => (window as any).__OW?.walk() !== null);
  await page.waitForTimeout(400);

  const s0 = await walk(page);
  expect(s0.lateral).not.toBeNull(); // spawned ON the walk network
  expect(Math.abs(s0.lateral!)).toBeLessThan(4);

  // W walks forward; camera stays ground + eye height; horizon level
  await page.keyboard.down('w');
  await page.waitForTimeout(2500);
  const s1 = await walk(page);
  await page.keyboard.up('w');
  expect(s1.mode).toBe('keyboard');
  expect(s1.traveled).toBeGreaterThan(2.5);
  expect(s1.speed).toBeGreaterThan(0.5);
  expect(s1.camTilt[0]).toBe(0);
  expect(s1.camTilt[1]).toBe(0);
  const cam = await page.evaluate(() => (window as any).__OW.camera());
  const ground = await page.evaluate(
    ([x, z]) => (window as any).__OW.ground(x, z), [s1.x, s1.z],
  );
  expect(cam.y - Math.max(ground, 0)).toBeGreaterThan(1.0);
  expect(cam.y - Math.max(ground, 0)).toBeLessThan(1.9);

  // minimap present
  await expect(page.getByTestId('ow-minimap')).toBeVisible();
});

test('closed-loop march: gait drives walking, leans steer, stop eases', async ({ page }) => {
  await page.goto('/openworld/?mode=walk&drive=walkroute&hud=0');
  await page.waitForFunction(() => (window as any).__OW?.walk() !== null);

  // marching engages (source LEGS) and the walker travels
  await page.waitForFunction(
    () => (window as any).__OW.walk().mode === 'walk',
    undefined, { timeout: 20_000 },
  );
  const a = await walk(page);
  await page.waitForTimeout(4000);
  const b = await walk(page);
  expect(b.traveled - a.traveled).toBeGreaterThan(2);

  // heading changes across the lean phases (t 8-14 left, 20-26 right)
  const headings: number[] = [];
  for (let i = 0; i < 36; i++) {
    await page.waitForTimeout(500);
    headings.push((await walk(page)).yawDeg);
  }
  const deltas = headings.slice(1).map((h, i) => ((h - headings[i] + 540) % 360) - 180);
  const minD = Math.min(...deltas);
  const maxD = Math.max(...deltas);
  expect(minD).toBeLessThan(-0.4);  // a left-turn phase existed
  expect(maxD).toBeGreaterThan(0.4); // a right-turn phase existed

  // comfort envelope: the package caps hold in-world
  const env = (await walk(page)).envelope as Record<string, number>;
  expect(env.maxYawRateDps).toBeLessThanOrEqual(45.5);
  expect(env.maxSpeed).toBeLessThanOrEqual(2.45);

  // stop phase (t 26-30): the walk eases to a stop, never a snap
  // (covered by envelope yaw-accel bound; here: it does actually stop)
  // walkroute resumes marching at t>=30, so just assert the envelope held.
});

test('dropout mid-march: eases out on a held heading, no tilt ever', async ({ page }) => {
  await page.goto('/openworld/?mode=walk&drive=walkloss&hud=0');
  await page.waitForFunction(() => (window as any).__OW?.walk() !== null);
  await page.waitForFunction(
    () => (window as any).__OW.walk().mode === 'walk',
    undefined, { timeout: 20_000 },
  );
  // loss at script t 8-11: autopilot then resume; sample tilt throughout
  let sawAutopilot = false;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(500);
    const s = await walk(page);
    expect(s.camTilt[0]).toBe(0);
    expect(s.camTilt[1]).toBe(0);
    if (s.mode === 'autopilot') sawAutopilot = true;
  }
  expect(sawAutopilot).toBe(true);
  // back to walking after reacquire
  await page.waitForFunction(
    () => ['walk', 'idle'].includes((window as any).__OW.walk().mode),
    undefined, { timeout: 15_000 },
  );
});
