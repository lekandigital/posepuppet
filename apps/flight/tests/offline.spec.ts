import { test, expect, type Page } from "@playwright/test";

/**
 * P1 offline parity: the whole game runs single-player with no server, no
 * Postgres, and zero non-same-origin network traffic. Guards both the
 * LocalWorldProvider and the "nothing phones home" non-negotiable.
 */

const ORIGIN = "http://localhost:5199";

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
