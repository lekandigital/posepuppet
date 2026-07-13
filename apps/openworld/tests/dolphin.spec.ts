import { test, expect, type Page } from '@playwright/test';

// O5 dolphin: the completed PS2 implementation on the region's real sea
// polygons + real bathymetry (low-poly profile only). The sim/renderer/
// controls are the completed modules; these specs verify the REGION
// integration: dive spawn, real-depth seabed, closed-loop torso-wave
// swimming, keyboard parity, and containment on the fjord polygon.

interface DolphinState {
  phase: string; x: number; y: number; z: number;
  yaw: number; pitch: number; roll: number; speed: number;
  kickCount: number; breachCount: number;
  inWater: boolean; shoreDist: number; depthHere: number;
  assist: string; tracking: string; splashes: number;
}

async function dolphin(page: Page): Promise<DolphinState> {
  return page.evaluate(() => (window as any).__OW.dolphin()) as Promise<DolphinState>;
}

test('dive spawn in the fjord; real bathymetry under the sim', async ({ page }) => {
  await page.goto('/openworld/?mode=dolphin&hud=0');
  await page.waitForFunction(() => (window as any).__OW?.dolphin() !== null);
  await page.waitForTimeout(500);
  const s = await dolphin(page);
  expect(s.inWater).toBe(true);
  expect(s.shoreDist).toBeGreaterThan(50); // open water, not a pier graze
  expect(s.depthHere).toBeGreaterThan(2);
  expect(s.depthHere).toBeLessThan(46);
  // real bathymetry: the world's carved seabed answers, and the world
  // water containment agrees with the sim's polygon containment
  const worldDepth = await page.evaluate(
    ([x, z]) => {
      const OW = (window as any).__OW;
      return { d: Math.max(0, -OW.ground(x, z)), w: OW.inWater(x, z) };
    }, [s.x, s.z],
  );
  expect(worldDepth.w).toBe(true);
  expect(Math.abs(worldDepth.d - s.depthHere)).toBeLessThan(2.5);
});

test('keyboard parity: Shift kicks, A/D turn, W dives', async ({ page }) => {
  await page.goto('/openworld/?mode=dolphin&hud=0');
  await page.waitForFunction(() => (window as any).__OW?.dolphin() !== null);
  const s0 = await dolphin(page);
  // Shift = kick impulses
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Shift');
    await page.waitForTimeout(350);
  }
  const s1 = await dolphin(page);
  expect(s1.kickCount).toBeGreaterThan(s0.kickCount);
  expect(s1.speed).toBeGreaterThan(1);
  // A turns: yaw changes
  await page.keyboard.down('a');
  await page.waitForTimeout(1200);
  await page.keyboard.up('a');
  const s2 = await dolphin(page);
  expect(Math.abs(s2.yaw - s1.yaw)).toBeGreaterThan(0.15);
  // W dives (deeper = y more negative)
  await page.keyboard.down('w');
  await page.waitForTimeout(1500);
  await page.keyboard.up('w');
  const s3 = await dolphin(page);
  expect(s3.y).toBeLessThan(s1.y - 0.5);
});

test('closed-loop torso-wave swim: kicks, dive, surface, roll turns', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto('/openworld/?mode=dolphin&drive=swim&hud=0');
  await page.waitForFunction(() => (window as any).__OW?.dolphin() !== null);

  // waves become kicks through the production chain
  await page.waitForFunction(
    () => ((window as any).__OW.dolphin() as { kickCount: number }).kickCount >= 3,
    undefined, { timeout: 30_000 },
  );
  const a = await dolphin(page);
  await page.waitForTimeout(4000);
  const b = await dolphin(page);
  expect(b.kickCount).toBeGreaterThan(a.kickCount);
  expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeGreaterThan(4);

  // script phases: dive lean (t 8-13) then surface lean (t 13-18) then
  // roll turns (t 18-24) — track depth extremes and yaw motion
  let minY = 0;
  let yawSpread = 0;
  let yaw0: number | null = null;
  for (let i = 0; i < 32; i++) {
    await page.waitForTimeout(500);
    const s = await dolphin(page);
    minY = Math.min(minY, s.y);
    if (yaw0 === null) yaw0 = s.yaw;
    yawSpread = Math.max(yawSpread, Math.abs(s.yaw - yaw0));
    expect(s.inWater).toBe(true);
  }
  expect(minY).toBeLessThan(-4); // dove meaningfully below spawn depth
  expect(yawSpread).toBeGreaterThan(0.3); // turned during the roll phase
});

test('containment: burst straight at the shore never exits the polygon', async ({ page }) => {
  await page.goto('/openworld/?mode=dolphin&hud=0');
  await page.waitForFunction(() => (window as any).__OW?.dolphin() !== null);
  // aim at the nearest shore via the world SDF gradient
  const s0 = await dolphin(page);
  const shoreYaw = await page.evaluate(([x, z]) => {
    const OW = (window as any).__OW;
    const E = 4;
    const dx = OW.sdf(x + E, z) - OW.sdf(x - E, z);
    const dz = OW.sdf(x, z + E) - OW.sdf(x, z - E);
    // dolphin yaw: heading (sin yaw, cos yaw) in game coords where
    // game z = -north; toward shallow = -gradient (scene) = ...
    return Math.atan2(-dx, -(-dz));
  }, [s0.x, s0.z]);
  await page.evaluate(
    ([yaw]) => {
      const T = (window as any).__OW.dolphinTest;
      T.setYaw(yaw);
      T.setIntent({ kicks: 0, kickAmp: 1, kickRate: 2, burst: true, pitch: 0, roll: 0, depthTrim: 0, autopilot: false });
    }, [shoreYaw],
  );
  for (let i = 0; i < 24; i++) {
    await page.waitForTimeout(500);
    const s = await dolphin(page);
    expect(s.inWater).toBe(true); // never beached, never through the shore
  }
  const end = await dolphin(page);
  expect(end.speed).toBeGreaterThan(0.5); // not wall-stopped dead
});
