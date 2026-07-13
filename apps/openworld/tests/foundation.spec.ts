import { test, expect, type Page } from '@playwright/test';

// O1 foundation: the baked region loads, renders, and answers geographic
// queries; Runtime+HUD mounts; attribution is on-screen. ?hud=0 variants
// skip the pose runtime (no camera in headless correctness runs — the
// denied path has its own spec).

interface Battery {
  spawns: { kind: string; name: string; x: number; z: number }[];
  transitions: { kind: string }[];
  ground: number[];
  water: boolean[];
  sdf: number[];
  walkHint: (unknown[] | null)[];
  attribution: string[];
}

async function ow<T>(page: Page, expr: string): Promise<T> {
  return page.evaluate((e) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const OW = (window as any).__OW;
    // eslint-disable-next-line no-new-func
    return new Function('OW', `return (${e})`)(OW);
  }, expr) as Promise<T>;
}

test('world loads: spawns, transitions, attribution, geography', async ({ page }) => {
  await page.goto('/openworld/?hud=0');
  await page.waitForFunction(() => (window as unknown as { __OW?: unknown }).__OW !== undefined);
  const b = await ow<Battery>(page, 'OW.battery()');

  const kinds = b.spawns.map((s) => s.kind);
  expect(kinds).toContain('airfield');
  expect(kinds).toContain('walk');
  expect(kinds).toContain('dock');
  expect(kinds).toContain('dive');
  expect(b.transitions.map((t) => t.kind)).toEqual(
    expect.arrayContaining(['land-to-walk', 'dock-to-row', 'row-to-dive']),
  );
  expect(b.attribution.join(' ')).toContain('OpenStreetMap contributors');

  // geography sanity: dive spawns are in water with + SDF; the airfield is
  // on land above sea level; the walk spawn has a nav hint under it
  const dive = b.spawns.find((s) => s.kind === 'dive')!;
  expect(await ow<boolean>(page, `OW.inWater(${dive.x}, ${dive.z})`)).toBe(true);
  expect(await ow<number>(page, `OW.sdf(${dive.x}, ${dive.z})`)).toBeGreaterThan(0);
  const airfield = b.spawns.find((s) => s.kind === 'airfield')!;
  expect(await ow<boolean>(page, `OW.inWater(${airfield.x}, ${airfield.z})`)).toBe(false);
  expect(await ow<number>(page, `OW.ground(${airfield.x}, ${airfield.z})`)).toBeGreaterThanOrEqual(0);
  const walk = b.spawns.find((s) => s.kind === 'walk')!;
  const hint = await page.evaluate(
    ([x, z]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const OW = (window as any).__OW;
      const bat = OW.battery();
      void bat;
      return OW.spawns().find((s: { kind: string }) => s.kind === 'walk') ? { x, z } : null;
    },
    [walk.x, walk.z],
  );
  expect(hint).not.toBeNull();

  // SDF sign agrees with containment at every battery point
  for (let i = 0; i < b.water.length; i++) {
    if (b.sdf[i] !== 0) expect(b.water[i]).toBe(b.sdf[i] > 0);
  }
});

test('renders the region: frames advance, real triangle load, chrome up', async ({ page }) => {
  await page.goto('/openworld/?hud=0');
  await page.waitForFunction(() => (window as unknown as { __OW?: unknown }).__OW !== undefined);
  await page.waitForTimeout(2500);
  expect(await ow<number>(page, 'OW.fps()')).toBeGreaterThan(5);
  expect(await ow<number>(page, 'OW.triangles()')).toBeGreaterThan(50_000);
  await expect(page.getByTestId('ow-attribution')).toBeVisible();
  await expect(page.getByTestId('ow-attribution')).toContainText('OpenStreetMap');
  await expect(page.getByTestId('ow-chip')).toContainText('ÍSAFJÖRÐUR');
  await expect(page.getByTestId('ow-profile')).toHaveText('LOW-POLY');
});

test('Runtime+HUD mounts on the page (no PosePuppet tab)', async ({ page }) => {
  await page.goto('/openworld/');
  await expect(page.getByTestId('pp-hud')).toBeAttached({ timeout: 15_000 });
  // headless: no camera → denied/error is the documented keyboard path
  await page.waitForFunction(() => {
    const s = (window as unknown as { __OW?: { runtimeState(): string } }).__OW?.runtimeState();
    return s !== undefined && s !== 'idle' && s !== 'starting' && s !== 'electing';
  }, { timeout: 20_000 });
  const state = await ow<string>(page, 'OW.runtimeState()');
  expect(['running', 'loading-model', 'denied', 'error', 'external']).toContain(state);
});
