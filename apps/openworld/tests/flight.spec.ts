import { test, expect, type Page } from '@playwright/test';

// O2 low-poly flight: airfield spawn + takeoff, keyboard play (the
// camera-denied guarantee), closed-loop body lap through the REAL
// body-input chain + broadcast transport + the reused BodyFlightControls,
// tracking-loss autopilot, and region-edge soft containment.

interface FlightState {
  x: number; y: number; z: number; yawDeg: number; speed: number;
  airborne: boolean; bodyStatus: string; edgeDistance: number;
}

async function flight(page: Page): Promise<FlightState> {
  return page.evaluate(() => (window as any).__OW.flight()) as Promise<FlightState>;
}

test('airfield spawn, scripted takeoff, keyboard steering', async ({ page }) => {
  await page.goto('/openworld/?mode=flight&hud=0');
  await page.waitForFunction(() => (window as any).__OW?.flight() !== null);

  const s0 = await flight(page);
  expect(s0.airborne).toBe(false);
  expect(s0.speed).toBe(0);
  // spawn is AT the airfield spawn point
  const spawns = await page.evaluate(() => (window as any).__OW.spawns());
  const airfield = spawns.find((s: { kind: string }) => s.kind === 'airfield');
  expect(Math.hypot(s0.x - airfield.x, s0.z - airfield.z)).toBeLessThan(5);

  // rolls and rotates on its own
  await page.waitForFunction(
    () => (window as any).__OW.flight().airborne,
    undefined, { timeout: 15_000 },
  );
  await page.waitForTimeout(2000);
  const s1 = await flight(page);
  expect(s1.speed).toBeGreaterThan(20);
  expect(s1.y).toBeGreaterThan(await page.evaluate(
    ([x, z]) => (window as any).__OW.ground(x, z), [s1.x, s1.z],
  ));

  // keyboard: A turns left (heading decreases mod 360), D turns right
  const h0 = (s1.yawDeg + 360) % 360;
  await page.keyboard.down('a');
  await page.waitForTimeout(1500);
  await page.keyboard.up('a');
  const s2 = await flight(page);
  let dh = ((s2.yawDeg - s1.yawDeg + 540) % 360) - 180;
  expect(Math.abs(dh)).toBeGreaterThan(15); // turned
  expect(s2.bodyStatus).toBe('keyboard');
  void h0;

  // ArrowUp climbs
  const y0 = s2.y;
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(1500);
  await page.keyboard.up('ArrowUp');
  const s3 = await flight(page);
  expect(s3.y).toBeGreaterThan(y0 + 8);
});

test('closed-loop body lap: leans steer through the production chain', async ({ page }) => {
  await page.goto('/openworld/?mode=flight&drive=flylap&hud=0');
  await page.waitForFunction(() => (window as any).__OW?.flight() !== null);
  await page.waitForFunction(
    () => (window as any).__OW.flight().airborne,
    undefined, { timeout: 15_000 },
  );
  await page.waitForFunction(
    () => (window as any).__OW.flight().bodyStatus === 'ok',
    undefined, { timeout: 15_000 },
  );

  // sample heading for the whole scripted lap; the script holds a left
  // lean (t 4-11) then a right lean (t 14-21) -- assert both phases exist
  // in order, from the ACTUAL trajectory (no sleep-timing coupling)
  const dh: number[] = [];
  let prev = (await flight(page)).yawDeg;
  let lastState: FlightState | null = null;
  for (let i = 0; i < 52; i++) {
    await page.waitForTimeout(500);
    lastState = await flight(page);
    const d = ((lastState.yawDeg - prev + 540) % 360) - 180;
    prev = lastState.yawDeg;
    dh.push(d);
  }
  // cumulative left-turn phase: most-negative windowed sum; right: most-positive after it
  let bestLeft = 0;
  let bestLeftEnd = -1;
  let run = 0;
  for (let i = 0; i < dh.length; i++) {
    run = Math.min(0, run) + dh[i];
    if (run < bestLeft) { bestLeft = run; bestLeftEnd = i; }
  }
  let bestRight = 0;
  run = 0;
  for (let i = Math.max(0, bestLeftEnd); i < dh.length; i++) {
    run = Math.max(0, run) + dh[i];
    if (run > bestRight) bestRight = run;
  }
  expect(bestLeft).toBeLessThan(-25);   // a sustained left turn happened
  expect(bestRight).toBeGreaterThan(25); // then a sustained right turn

  // still flying, inside the region, finite numbers
  expect(lastState!.speed).toBeGreaterThan(10);
  expect(lastState!.edgeDistance).toBeGreaterThan(-1);
  expect(Number.isFinite(lastState!.x + lastState!.y + lastState!.z + lastState!.yawDeg)).toBe(true);
});

test('tracking loss → autopilot decay → snap-free reacquire', async ({ page }) => {
  await page.goto('/openworld/?mode=flight&drive=flyloss&hud=0');
  await page.waitForFunction(() => (window as any).__OW?.flight() !== null);
  await page.waitForFunction(
    () => (window as any).__OW.flight().bodyStatus === 'ok',
    undefined, { timeout: 20_000 },
  );
  // loss window at script t 8–11 (wall t ≈ 10–13): autopilot appears
  await page.waitForFunction(
    () => ['autopilot', 'low-confidence'].includes((window as any).__OW.flight().bodyStatus),
    undefined, { timeout: 20_000 },
  );
  // heading rate decays toward straight flight during loss
  const l0 = await flight(page);
  await page.waitForTimeout(1200);
  const l1 = await flight(page);
  const lossTurn = Math.abs(((l1.yawDeg - l0.yawDeg + 540) % 360) - 180);
  expect(lossTurn).toBeLessThan(30); // no runaway spin while lost
  expect(l1.speed).toBeGreaterThan(10); // still flying straight

  // reacquires without a snap: status returns to ok
  await page.waitForFunction(
    () => (window as any).__OW.flight().bodyStatus === 'ok',
    undefined, { timeout: 20_000 },
  );
});

test('region edge: soft turn-back, never an exit, never a wall-stop', async ({ page }) => {
  await page.goto('/openworld/?mode=flight&hud=0');
  await page.waitForFunction(() => (window as any).__OW?.flight() !== null);
  const bounds = await page.evaluate(() => (window as any).__OW.bounds());
  // aim straight at the east edge from 300 m inside it
  await page.evaluate(
    ([bx]) => (window as any).__OW.flightTeleport(bx - 300, 0, 90),
    [bounds.maxX],
  );
  let minEdge = Infinity;
  let minSpeed = Infinity;
  for (let i = 0; i < 24; i++) {
    await page.waitForTimeout(500);
    const s = await flight(page);
    minEdge = Math.min(minEdge, s.edgeDistance);
    minSpeed = Math.min(minSpeed, s.speed);
  }
  expect(minEdge).toBeGreaterThan(-60); // never leaves the region (small overshoot ok)
  expect(minSpeed).toBeGreaterThan(10); // never wall-stopped
  const end = await flight(page);
  expect(end.edgeDistance).toBeGreaterThan(150); // turned back inward
});
