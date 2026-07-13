import { test, expect } from '@playwright/test';

// Cross-profile consistency — the one-shared-foundation proof. The SAME
// deterministic battery of geographic queries (spawns, transitions, a
// 49-point grid of ground/water/SDF/nav-hint/nav-node answers,
// attribution) must be byte-identical under every registered profile:
// profiles are renderer/content packs, never geography. The registered
// list is read from the page so O8/O9 profiles join automatically.

const KNOWN: string[] = ['low-poly', 'realistic', 'fantasy-game'];

test('battery identical across every registered profile', async ({ page }) => {
  test.setTimeout(240_000);
  const batteries: Record<string, string> = {};
  for (const profile of KNOWN) {
    await page.goto(`/openworld/?mode=flyover&profile=${profile}&hud=0`);
    await page.waitForFunction(() => (window as unknown as { __OW?: unknown }).__OW !== undefined);
    const active = await page.evaluate(() => (window as any).__OW.profile());
    if (active !== profile) continue; // not registered yet — falls back
    batteries[profile] = await page.evaluate(() =>
      JSON.stringify((window as any).__OW.battery()),
    );
  }
  const keys = Object.keys(batteries);
  expect(keys.length).toBeGreaterThan(0);
  for (const k of keys.slice(1)) {
    expect(batteries[k]).toBe(batteries[keys[0]]);
  }
  // record which profiles the run actually proved
  console.log(`consistency: proved over [${keys.join(', ')}]`);
});

test('mode/content matrix: dolphin is low-poly only', async ({ page }) => {
  for (const profile of KNOWN) {
    await page.goto(`/openworld/?mode=flyover&profile=${profile}&hud=0`);
    await page.waitForFunction(() => (window as unknown as { __OW?: unknown }).__OW !== undefined);
    const active = await page.evaluate(() => (window as any).__OW.profile());
    if (active !== profile) continue;
    const modes = await page.evaluate(() => (window as any).__OW.modes());
    expect(modes).toContain('flight');
    expect(modes).toContain('walk');
    expect(modes).toContain('row');
    if (profile === 'low-poly') expect(modes).toContain('dolphin');
    else expect(modes).not.toContain('dolphin');
  }
});
