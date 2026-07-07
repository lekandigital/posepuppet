import { test, expect, chromium } from "@playwright/test";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Supported topology (the Gate-2 regression guard): PosePuppet serves the
 * BUILT flight app same-origin at /flight/ (vite middleware), so
 * BroadcastChannel body signals reach the game with no bridge or relay.
 *
 * BroadcastChannel is origin-scoped — two dev-server ports can never share
 * it. That was Gate 2's failure: the script's nested-npm command dropped
 * --port, flight landed on a different port, and no signals could cross.
 *
 * Headed for two reasons (measured, see DECISIONS 2026-07-07): headless
 * SwiftShader makes the game page compute-bound (~1 rAF/s) which starves
 * even BC event delivery to ~0.7 msg/s, and the producer's pose loop is
 * rAF-driven. Same convention as body.spec.ts / feel.spec.ts.
 */

const repoRoot = resolve(__dirname, "../../..");
const armsClip = resolve(repoRoot, "fixtures", "arms.y4m");
const flightDist = resolve(repoRoot, "apps/flight/client/dist/index.html");
const POSEPUPPET = "http://localhost:5173";

test("live body intent reaches /flight/ over same-origin BroadcastChannel", async () => {
  test.skip(!existsSync(armsClip), "arms.y4m missing (local fixture)");
  test.setTimeout(180_000);

  if (!existsSync(flightDist)) {
    execSync("npm --prefix apps/flight run build:client", { cwd: repoRoot, stdio: "ignore" });
  }

  const browser = await chromium.launch({
    headless: false,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${armsClip}`,
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });

  // Producer: PosePuppet tracking the fake webcam.
  const producer = await context.newPage();
  await producer.goto(POSEPUPPET);
  await producer.waitForFunction(() => (window as any).__PP?.detectionCount > 10, undefined, {
    timeout: 60_000,
  });

  // Consumer: the flight app on the SAME origin. No bridge, no postMessage
  // relay — this is pure BroadcastChannel, exactly what ⌘K → "fly" uses.
  const flight = await context.newPage();
  await flight.goto(`${POSEPUPPET}/flight/`);
  await flight.waitForFunction(() => !!(window as any).__FLIGHT, undefined, { timeout: 30_000 });

  await flight.waitForFunction(
    () => {
      const b = (window as any).__FLIGHT.body();
      return !!b && b.senderConnected === true && b.signalRateHz > 5;
    },
    undefined,
    { timeout: 30_000 },
  );
  const b = await flight.evaluate(() => (window as any).__FLIGHT.body());
  expect(b.transport).toBe("broadcast");
  expect(b.schemaV).toBe(1);
  expect(["ok", "reacquiring", "low-confidence"]).toContain(b.reason);
  expect(b.signalAgeMs).toBeLessThan(500);

  // Live tracker output, not a stuck frame: at least one axis moves.
  const a1 = await flight.evaluate(() => ({ ...(window as any).__FLIGHT.body().signal.axes }));
  await flight.waitForTimeout(2_000);
  const a2 = await flight.evaluate(() => ({ ...(window as any).__FLIGHT.body().signal.axes }));
  const moved = Object.keys(a1).some((k) => Math.abs((a2 as any)[k] - (a1 as any)[k]) > 1e-4);
  expect(moved, "at least one axis changed across 2 s of live tracking").toBe(true);

  await browser.close();
});
