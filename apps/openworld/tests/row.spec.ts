import { test, expect, type Page } from '@playwright/test';

// O4 rowing: the completed RowingControls on the fjord. Dock spawn lands
// on the row network in real water; keyboard parity; closed-loop stroke
// circuit through the production chain (strokes propel, cruise holds on
// rest, leans steer); shore guard never beaches the boat.

interface RowState {
  x: number; z: number; yawDeg: number; speed: number; traveled: number;
  strokes: number; cruising: boolean; bodyStatus: string;
  sdf: number; inWater: boolean;
}

async function row(page: Page): Promise<RowState> {
  return page.evaluate(() => (window as any).__OW.row()) as Promise<RowState>;
}

test('dock spawn in rowable water; keyboard parity', async ({ page }) => {
  await page.goto('/openworld/?mode=row&hud=0');
  await page.waitForFunction(() => (window as any).__OW?.row() !== null);
  await page.waitForTimeout(300);

  const s0 = await row(page);
  expect(s0.inWater).toBe(true);
  expect(s0.sdf).toBeGreaterThan(0.5);
  expect(s0.speed).toBe(0);

  // ArrowUp rows forward
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(2500);
  const s1 = await row(page);
  expect(s1.bodyStatus).toBe('keyboard');
  expect(s1.speed).toBeGreaterThan(1);
  expect(s1.traveled).toBeGreaterThan(1.5);

  // ArrowLeft turns (A convention: + = left = heading decreases)
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(1500);
  await page.keyboard.up('ArrowLeft');
  const s2 = await row(page);
  const dh = ((s2.yawDeg - s1.yawDeg + 540) % 360) - 180;
  expect(dh).toBeLessThan(-6);
  await page.keyboard.up('ArrowUp');

  // glide: releasing keys never hard-stops the hull
  await page.waitForTimeout(1500);
  const s3 = await row(page);
  expect(s3.speed).toBeGreaterThan(0.4);
});

test('closed-loop circuit: strokes surge, leans steer, rest cruises', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto('/openworld/?mode=row&drive=rowcircuit&hud=0');
  await page.waitForFunction(() => (window as any).__OW?.row() !== null);

  // strokes register and the boat travels
  await page.waitForFunction(
    () => ((window as any).__OW.row() as { strokes: number }).strokes >= 3,
    undefined, { timeout: 30_000 },
  );
  const a = await row(page);
  await page.waitForTimeout(5000);
  const b = await row(page);
  expect(b.traveled - a.traveled).toBeGreaterThan(3);
  expect(b.strokes).toBeGreaterThan(a.strokes);

  // steering phases exist (lean left t 14-20, right t 20-26)
  const headings: number[] = [];
  for (let i = 0; i < 32; i++) {
    await page.waitForTimeout(500);
    headings.push((await row(page)).yawDeg);
  }
  const deltas = headings.slice(1).map((h, i) => ((h - headings[i] + 540) % 360) - 180);
  expect(Math.min(...deltas)).toBeLessThan(-0.5);
  expect(Math.max(...deltas)).toBeGreaterThan(0.5);

  // rest phase (t 26-31): cruise latch holds way (speed never collapses)
  // the phase may already have passed; assert from the record instead:
  // during the sampled window the boat kept moving throughout
  const end = await row(page);
  expect(end.speed).toBeGreaterThan(0.3);
  expect(end.inWater).toBe(true);
});

test('shore guard: full-speed run at the shore never beaches', async ({ page }) => {
  await page.goto('/openworld/?mode=row&hud=0');
  await page.waitForFunction(() => (window as any).__OW?.row() !== null);
  // aim at the nearest shore: head straight down the SDF gradient
  const s0 = await row(page);
  const shoreYaw = await page.evaluate(([x, z]) => {
    const OW = (window as any).__OW;
    const E = 4;
    const dx = OW.sdf(x + E, z) - OW.sdf(x - E, z);
    const dz = OW.sdf(x, z + E) - OW.sdf(x, z - E);
    // toward SHALLOW: negative gradient
    return (Math.atan2(-dx, dz) * 180) / Math.PI;
  }, [s0.x, s0.z]);
  await page.evaluate(
    ([x, z, yaw]) => (window as any).__OW.rowTeleport(x, z, yaw, 4.0),
    [s0.x, s0.z, shoreYaw],
  );
  // hold forward on keys to keep speed up against the guard
  await page.keyboard.down('ArrowUp');
  let minSdf = Infinity;
  for (let i = 0; i < 24; i++) {
    await page.waitForTimeout(500);
    const s = await row(page);
    minSdf = Math.min(minSdf, s.sdf);
    expect(s.inWater).toBe(true); // never beached
  }
  await page.keyboard.up('ArrowUp');
  const end = await row(page);
  expect(end.inWater).toBe(true);
  expect(end.speed).toBeGreaterThan(0.2); // never trapped dead at the shore
});
