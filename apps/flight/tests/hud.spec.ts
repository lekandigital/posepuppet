// V1 Runtime+HUD in TinySkies/Rowing: the game page runs its own tracking
// pipeline (no PosePuppet tab), the shared HUD mounts and is fully
// keyboard-accessible, camera denial leaves keyboard flight intact, and
// the page never opens a second capture pipeline. Headed like the other
// game suites (headless WebGL is compositor-throttled).
import { test, expect, chromium, type Browser, type Page } from "@playwright/test";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(HERE, "../../..");
const FLIGHT = `http://localhost:${process.env.FLIGHT_PORT ?? "5199"}`;
const clip = resolve(repoRoot, ".local/cache/fake-camera/arms_tpose.y4m");
const clipFallback = resolve(repoRoot, "fixtures", "arms.y4m");
const fakeCam = existsSync(clip) ? clip : clipFallback;

const camArgs = [
  "--use-fake-ui-for-media-stream",
  "--use-fake-device-for-media-stream",
  `--use-file-for-fake-video-capture=${fakeCam}`,
  "--autoplay-policy=no-user-gesture-required",
];

async function countGum(page: Page) {
  await page.addInitScript(() => {
    const md = navigator.mediaDevices;
    const orig = md.getUserMedia.bind(md);
    (window as unknown as { __gumCalls: number }).__gumCalls = 0;
    md.getUserMedia = (c?: MediaStreamConstraints) => {
      (window as unknown as { __gumCalls: number }).__gumCalls++;
      return orig(c);
    };
  });
}

test.describe("runtime + HUD (live camera)", () => {
  let browser: Browser;
  let page: Page;

  test.beforeAll(async () => {
    test.skip(!existsSync(fakeCam), "fake-camera fixture missing (local file)");
    browser = await chromium.launch({ headless: false, args: camArgs });
    page = await browser.newPage();
    await countGum(page);
    await page.goto(`${FLIGHT}/?autostart=1`);
  });
  test.afterAll(async () => {
    await browser?.close();
  });

  test("HUD mounts and goes LIVE from the page's own pipeline", async () => {
    const hud = page.locator('[data-testid="pp-hud"]');
    await expect(hud).toBeVisible();
    await expect(hud).toHaveAttribute("data-state", "running", { timeout: 60_000 });
    await expect(page.locator('[data-testid="pp-hud-track"]')).toContainText("LIVE", {
      timeout: 30_000,
    });
    await expect(page.locator(".pp-hud-privacy")).toContainText("LOCAL INFERENCE");
  });

  test("exactly one getUserMedia consumer on the page", async () => {
    expect(await page.evaluate(() => (window as unknown as { __gumCalls: number }).__gumCalls)).toBe(1);
  });

  test("broadcast wire carries schema signals, no landmark arrays", async () => {
    const msgs = (await page.evaluate(
      () =>
        new Promise((res) => {
          const got: unknown[] = [];
          const bc = new BroadcastChannel("bodyarcade.body-input.v1");
          bc.onmessage = (ev) => {
            got.push(ev.data);
            if (got.length >= 5) {
              bc.close();
              res(got);
            }
          };
        }),
    )) as Array<Record<string, unknown>>;
    const landmarky = (v: unknown, seen = new Set<unknown>()): boolean => {
      if (v === null || typeof v !== "object" || seen.has(v)) return false;
      seen.add(v);
      if (Array.isArray(v)) {
        if (
          v.length >= 21 &&
          v.filter(
            (e) =>
              e && typeof e === "object" && typeof (e as { x?: unknown }).x === "number" &&
              typeof (e as { z?: unknown }).z === "number",
          ).length > v.length / 2
        ) {
          return true;
        }
        return v.some((e) => landmarky(e, seen));
      }
      return Object.values(v).some((e) => landmarky(e, seen));
    };
    for (const m of msgs) {
      expect(m.v).toBe(1);
      expect(m.axes).toBeTruthy();
      expect(landmarky(m)).toBe(false);
    }
  });

  test("expands and collapses by mouse AND keyboard; feed swap has key parity", async () => {
    const hud = page.locator('[data-testid="pp-hud"]');
    const toggle = page.locator('[data-testid="pp-hud-toggle"]');

    // mouse
    await expect(hud).toHaveAttribute("data-open", "open");
    await toggle.click();
    await expect(hud).toHaveAttribute("data-open", "collapsed");
    await toggle.click();
    await expect(hud).toHaveAttribute("data-open", "open");

    // keyboard: focus expands (hover parity), Enter toggles, Esc collapses
    await hud.focus();
    await expect(hud).toHaveAttribute("data-size", "expanded");
    await page.keyboard.press("Enter");
    await expect(hud).toHaveAttribute("data-open", "collapsed");
    await page.keyboard.press("Enter");
    await expect(hud).toHaveAttribute("data-open", "open");

    // feed swap: 'c' swaps to the live camera feed and back
    await page.keyboard.press("c");
    await expect(hud).toHaveAttribute("data-feed", "camera");
    await page.keyboard.press("c");
    await expect(hud).toHaveAttribute("data-feed", "preview");

    await page.keyboard.press("Escape");
    await expect(hud).toHaveAttribute("data-open", "collapsed");
    await page.keyboard.press("Enter"); // leave it open for later specs
  });

  test("preview degradation tiers are forceable and marked", async () => {
    const canvas = page.locator(".pp-hud-canvas");
    await expect(canvas).toHaveAttribute("data-tier", "0");
    const tiers = await page.evaluate(() => {
      const w = window as unknown as {
        __PP_HUD?: { setPreviewTier(t: number | null): void; stats(): { tier: number } };
      };
      if (!w.__PP_HUD) return null;
      const seen: number[] = [];
      for (const t of [1, 2, 3]) {
        w.__PP_HUD.setPreviewTier(t);
        seen.push(w.__PP_HUD.stats().tier);
      }
      w.__PP_HUD.setPreviewTier(null);
      return seen;
    });
    expect(tiers).toEqual([1, 2, 3]);
    await expect(canvas).toHaveAttribute("data-tier", "0");
  });
});

test.describe("camera denied", () => {
  test("keyboard still flies the plane; HUD says so", async () => {
    test.setTimeout(120_000);
    // Chromium's deny switch: a flagless Playwright launch still grants a
    // fake camera, so denial must be explicit
    const browser = await chromium.launch({
      headless: false,
      args: ["--deny-permission-prompts"],
    });
    const page = await browser.newPage();
    await page.goto(`${FLIGHT}/?autostart=1`);

    const hud = page.locator('[data-testid="pp-hud"]');
    await expect(hud).toHaveAttribute("data-state", /denied|error/, { timeout: 30_000 });
    await expect(page.locator('[data-testid="pp-hud-msg"]')).toContainText("KEYBOARD");

    // keyboard play: wait for flight, then W accelerates / A turns
    await page.waitForFunction(
      () => {
        const f = (window as unknown as { __FLIGHT?: { state(): { phase: string; controlsEnabled: boolean } } }).__FLIGHT;
        const s = f?.state();
        return !!s && s.phase === "flying" && s.controlsEnabled === true;
      },
      undefined,
      { timeout: 60_000 },
    );
    // hold A: the keyboard turn shows up as a sustained heading rate
    await page.keyboard.down("a");
    const samples: number[] = [];
    for (let i = 0; i < 10; i++) {
      samples.push(
        await page.evaluate(
          () =>
            (window as unknown as { __FLIGHT: { state(): { headingRateDegS: number } } }).__FLIGHT.state()
              .headingRateDegS ?? 0,
        ),
      );
      await page.waitForTimeout(150);
    }
    await page.keyboard.up("a");
    const mean = samples.reduce((s, v) => s + v, 0) / samples.length;
    expect(Math.abs(mean)).toBeGreaterThan(2);
    await browser.close();
  });
});
