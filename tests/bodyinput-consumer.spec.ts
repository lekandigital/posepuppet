// Cross-page transport proof: PosePuppet runs in one tab, the example
// consumer page in another (same origin, BroadcastChannel), and derived
// signals — never landmarks — arrive and update.
import { test, expect } from '@playwright/test';
import { assertSignalShape } from '../packages/body-input/src/index';

test('example consumer receives signals from the app across pages', async ({ context }) => {
  const app = await context.newPage();
  await app.goto('/?avatar=robot');
  await app.waitForFunction(() => window.__PP?.detectionCount > 5, undefined, { timeout: 45_000 });

  const consumer = await context.newPage();
  await consumer.goto('/packages/body-input/examples/consumer.html');
  await consumer.waitForFunction(
    () => (window as unknown as { __CONSUMER?: { count: number } }).__CONSUMER?.count! > 10,
    undefined,
    { timeout: 20_000 },
  );

  const state = (await consumer.evaluate(
    () => (window as unknown as { __CONSUMER: { count: number; last: unknown } }).__CONSUMER,
  )) as { count: number; last: unknown };
  assertSignalShape(state.last); // schema v1, landmark-free, finite
  // and it keeps flowing
  await consumer.waitForTimeout(700);
  const later = await consumer.evaluate(
    () => (window as unknown as { __CONSUMER: { count: number } }).__CONSUMER.count,
  );
  expect(later).toBeGreaterThan(state.count);
});
