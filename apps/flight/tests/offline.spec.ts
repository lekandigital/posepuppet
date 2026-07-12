import { test, expect, type Page } from "@playwright/test";

/**
 * P1 offline parity: the whole game runs single-player with no server, no
 * Postgres, and zero non-same-origin network traffic. Guards both the
 * LocalWorldProvider and the "nothing phones home" non-negotiable.
 */

const ORIGIN = `http://localhost:${process.env.FLIGHT_PORT ?? "5199"}`;

function trackRequests(page: Page) {
  const offOrigin: string[] = [];
  page.on("request", (req) => {
    const url = req.url();
    if (!url.startsWith(ORIGIN) && !url.startsWith("data:") && !url.startsWith("blob:")) {
      offOrigin.push(url);
    }
  });
  return offOrigin;
}

function trackConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(String(err)));
  return errors;
}

test("lobby loads offline: local world minted, zero off-origin requests", async ({ page }) => {
  const offOrigin = trackRequests(page);
  const errors = trackConsoleErrors(page);

  await page.goto("/");
  await expect(page.locator("#btn-fly")).toBeVisible({ timeout: 20_000 });

  const store = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("globefly_local_worlds_v1") ?? "null"),
  );
  expect(store, "LocalWorldProvider persisted a world").not.toBeNull();
  expect(store.worlds.length).toBeGreaterThan(0);
  expect(store.worlds[0]).toMatchObject({
    globeRadius: 5.0,
    texture: "earth",
    terrainType: "default",
  });
  expect(typeof store.worlds[0].seed).toBe("number");

  expect(offOrigin, `off-origin requests: ${offOrigin.join(", ")}`).toHaveLength(0);
  expect(errors, `console errors: ${errors.join(" | ")}`).toHaveLength(0);
});

test("full flight session offline: GO → intro → HUD, still zero off-origin", async ({ page }) => {
  // Headless throttles this mediastream-less WebGL page to ~1 rAF/s, so a
  // full session normally takes ~1.2 min — give it room past the 90 s default.
  test.setTimeout(150_000);
  const offOrigin = trackRequests(page);
  const errors = trackConsoleErrors(page);

  await page.goto("/");
  await expect(page.locator("#btn-fly")).toBeVisible({ timeout: 20_000 });
  await page.click("#btn-fly");

  // Loading overlay (min 1.5 s) + intro flythrough (5.2 s) precede the HUD.
  await expect(page.locator("#hud")).toBeAttached({ timeout: 30_000 });

  // Let the plane fly on keyboard for a few seconds (A = turn left).
  await page.keyboard.down("a");
  await page.waitForTimeout(3_000);
  await page.keyboard.up("a");

  expect(offOrigin, `off-origin requests: ${offOrigin.join(", ")}`).toHaveLength(0);

  // WebGL-in-headless warnings are environment noise; real errors fail.
  const real = errors.filter(
    (e) => !/GroupMarkerNotSet|SwiftShader|GPU stall|WebGL.*deprecated/i.test(e),
  );
  expect(real, `console errors: ${real.join(" | ")}`).toHaveLength(0);
});

test("world persists across reload (same slug rejoined)", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#btn-fly")).toBeVisible({ timeout: 20_000 });
  const first = await page.evaluate(
    () => JSON.parse(localStorage.getItem("globefly_local_worlds_v1")!).lastSlug,
  );
  await page.reload();
  await expect(page.locator("#btn-fly")).toBeVisible({ timeout: 20_000 });
  const second = await page.evaluate(
    () => JSON.parse(localStorage.getItem("globefly_local_worlds_v1")!).lastSlug,
  );
  expect(second).toBe(first);
});

test("boat and carpet fly offline (vehicle roster faithful)", async ({ page }) => {
  // Full sessions at headless ~1 rAF/s: give both runs room.
  test.setTimeout(300_000);
  const errors = trackConsoleErrors(page);
  const offOrigin = trackRequests(page);

  // Seed progression past both unlock gates (plane level 5 covers carpet ≥2
  // and boat ≥4) and ack the celebration modals so the lobby stays clean.
  await page.addInitScript(() => {
    localStorage.setItem(
      "globefly_vehicle_progress",
      JSON.stringify({ plane: { xp: 999999, level: 5, appliedUpgradeIds: [] } }),
    );
    localStorage.setItem("globefly_unlocks_ack", JSON.stringify({ carpet: true, boat: true }));
  });

  for (const vehicle of ["boat", "carpet"] as const) {
    await page.goto("/");
    await expect(page.locator("#btn-fly")).toBeVisible({ timeout: 30_000 });
    const btn = page.locator(`.lobby-vbtn[data-vehicle="${vehicle}"]`);
    await expect(btn, `${vehicle} unlocked in the lobby`).not.toHaveClass(/locked/);
    await btn.click();
    await page.click("#btn-fly");
    await expect(page.locator("#hud")).toBeAttached({ timeout: 120_000 });
    const state = await page.evaluate(() => (window as any).__FLIGHT.state());
    expect(state.vehicle).toBe(vehicle);
  }

  expect(offOrigin, `off-origin requests: ${offOrigin.join(", ")}`).toHaveLength(0);
  const real = errors.filter(
    (e) => !/GroupMarkerNotSet|SwiftShader|GPU stall|WebGL.*deprecated/i.test(e),
  );
  expect(real, `console errors: ${real.join(" | ")}`).toHaveLength(0);
});
