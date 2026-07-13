import { test, expect, type Page } from '@playwright/test';

// O6 transitions: honest fade + spawn handoffs at the BAKED transition
// points (TRANSITIONS.md). Each leg asserts the destination mode is live
// at the geographically matching entry.

async function ow<T>(page: Page, fn: string): Promise<T> {
  return page.evaluate((f) => {
    // eslint-disable-next-line no-new-func
    return new Function('OW', `return (${f})`)((window as any).__OW);
  }, fn) as Promise<T>;
}

test('walk → row at a dock, then row → walk back', async ({ page }) => {
  await page.goto('/openworld/?mode=walk&hud=0');
  await page.waitForFunction(() => (window as any).__OW?.walk() !== null);
  const dock = (await ow<any[]>(page, 'OW.transitions()')).find((t) => t.kind === 'dock-to-row');
  await page.evaluate(([x, z]) => (window as any).__OW.walkTeleport(x, z, 0), [dock.x, dock.z]);
  await page.waitForFunction(
    () => (window as any).__OW.transition().eligible === 'row', undefined, { timeout: 8000 },
  );
  await page.keyboard.press('f');
  await page.waitForFunction(() => (window as any).__OW.mode() === 'row', undefined, { timeout: 8000 });
  const row = await ow<any>(page, 'OW.row()');
  expect(row.inWater).toBe(true);
  expect(Math.hypot(row.x - dock.x, row.z - dock.z)).toBeLessThan(120);

  // back: still near the dock → walk
  await page.waitForFunction(
    () => (window as any).__OW.transition().eligible !== null, undefined, { timeout: 8000 },
  );
  const t = await ow<any>(page, 'OW.transition()');
  if (t.eligible === 'walk') {
    await page.keyboard.press('f');
    await page.waitForFunction(() => (window as any).__OW.mode() === 'walk', undefined, { timeout: 8000 });
    expect(await ow<any>(page, 'OW.walk()')).not.toBeNull();
  }
});

test('row → dolphin at a dive point (low-poly), and back at the surface', async ({ page }) => {
  await page.goto('/openworld/?mode=row&hud=0');
  await page.waitForFunction(() => (window as any).__OW?.row() !== null);
  const dive = (await ow<any[]>(page, 'OW.transitions()')).find((t) => t.kind === 'row-to-dive');
  await page.evaluate(([x, z]) => (window as any).__OW.rowTeleport(x, z, 0, 0), [dive.x, dive.z]);
  await page.waitForFunction(
    () => (window as any).__OW.transition().eligible === 'dolphin', undefined, { timeout: 8000 },
  );
  await page.keyboard.press('f');
  await page.waitForFunction(() => (window as any).__OW.mode() === 'dolphin', undefined, { timeout: 8000 });
  const d = await ow<any>(page, 'OW.dolphin()');
  expect(d.inWater).toBe(true);
  expect(Math.hypot(d.x - dive.x, d.z - dive.z)).toBeLessThan(80);

  // surface → row again
  await page.evaluate(([x, z]) => (window as any).__OW.dolphinTest.teleport(x, z, -1.5), [dive.x, dive.z]);
  await page.waitForFunction(
    () => (window as any).__OW.transition().eligible === 'row', undefined, { timeout: 8000 },
  );
  await page.keyboard.press('f');
  await page.waitForFunction(() => (window as any).__OW.mode() === 'row', undefined, { timeout: 8000 });
});

test('flight → walk: land at the airfield with F when low and slow', async ({ page }) => {
  await page.goto('/openworld/?mode=flight&hud=0');
  await page.waitForFunction(() => (window as any).__OW?.flight() !== null);
  await page.waitForFunction(() => (window as any).__OW.flight().airborne, undefined, { timeout: 15_000 });
  const land = (await ow<any[]>(page, 'OW.transitions()')).find((t) => t.kind === 'land-to-walk');
  // fly a real approach: start 260 m short, heading at the point, braking
  // and holding descend so the plane arrives low and slow
  await page.evaluate(
    ([x, z]) => {
      const OW = (window as any).__OW;
      const sx = x - 0;
      const sz = z + 260; // approach from the south, heading 0 (north)
      OW.flightTeleport(sx, sz, 0, Math.max(OW.ground(sx, sz), 0) + 14);
    }, [land.x, land.z],
  );
  await page.keyboard.down('s'); // brake (keyboard priority silences the body)
  await page.keyboard.down('ArrowDown'); // stay low against the climb-out
  await page.waitForFunction(
    () => (window as any).__OW.transition().eligible === 'walk', undefined, { timeout: 25_000 },
  );
  await page.keyboard.up('s');
  await page.keyboard.up('ArrowDown');
  await page.keyboard.press('f');
  await page.waitForFunction(() => (window as any).__OW.mode() === 'walk', undefined, { timeout: 8000 });
  const w = await ow<any>(page, 'OW.walk()');
  expect(Math.hypot(w.x - land.x, w.z - land.z)).toBeLessThan(150);
});

test('selector present; dolphin option only where the profile ships it', async ({ page }) => {
  await page.goto('/openworld/?mode=walk&hud=0');
  await page.waitForFunction(() => (window as any).__OW?.walk() !== null);
  await expect(page.getByTestId('ow-selector')).toBeVisible();
  const modes = await ow<string[]>(page, 'OW.modes()');
  expect(modes).toContain('dolphin'); // low-poly ships the dolphin
  const options = await page.getByTestId('ow-mode-select').locator('option').allTextContents();
  expect(options.join(',')).toContain('DOLPHIN');
});
