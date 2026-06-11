// Browser smoke tests for generated candidate VRM avatars.
// These test the ?generatedAvatar= query param path and ?smoke=avatar-load-only
// mode. They do NOT require a real camera or MediaPipe — avatar-load-only
// mode skips both.
import { test, expect } from '@playwright/test';

test.describe('generated avatar smoke tests', () => {
  test('generated Woody candidate loads without crash', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto('/?generatedAvatar=woody&smoke=avatar-load-only');

    // Wait for avatar load to complete (loaded or error)
    await page.waitForFunction(
      () => window.__PP?.avatarStatus === 'loaded' || window.__PP?.avatarStatus === 'error',
      undefined,
      { timeout: 30_000 },
    );

    const status = await page.evaluate(() => window.__PP.avatarStatus);
    expect(status).toBe('loaded');

    // Stage canvas should be present and rendering
    const stage = page.locator('#stage');
    await expect(stage).toBeVisible();

    // App shell has test markers
    await expect(page.locator('[data-testid="posepuppet-app"]')).toBeVisible();
    await expect(page.locator('[data-testid="avatar-warning"]')).toBeVisible();

    // No page-level crashes
    expect(errors).toEqual([]);
  });

  test('generated Darth Vader candidate loads without crash', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto('/?generatedAvatar=darth-vader&smoke=avatar-load-only');

    await page.waitForFunction(
      () => window.__PP?.avatarStatus === 'loaded' || window.__PP?.avatarStatus === 'error',
      undefined,
      { timeout: 30_000 },
    );

    const status = await page.evaluate(() => window.__PP.avatarStatus);
    expect(status).toBe('loaded');

    const stage = page.locator('#stage');
    await expect(stage).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('missing generated avatar falls back without crash', async ({ page }) => {
    const warnings: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'warning' && m.text().includes('[generated-avatar]')) {
        warnings.push(m.text());
      }
    });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto('/?generatedAvatar=missing-test&smoke=avatar-load-only');

    await page.waitForFunction(
      () => window.__PP?.avatarStatus != null,
      undefined,
      { timeout: 15_000 },
    );

    const status = await page.evaluate(() => window.__PP.avatarStatus);
    expect(status).toBe('fallback');

    // Warning should be set
    const warning = await page.evaluate(() => window.__PP.avatarWarning);
    expect(warning).toContain('missing-test');

    // Should have logged a console warning
    expect(warnings.length).toBeGreaterThan(0);

    // No page crashes
    expect(errors).toEqual([]);
  });

  test('normal public UI cycling does not include generated avatars', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    // Load without generatedAvatar param — normal mode with camera
    await page.goto('/?avatar=robot');
    await page.waitForFunction(
      () => window.__PP?.videoReady === true || window.__PP?.cameraError != null,
      undefined,
      { timeout: 30_000 },
    );

    const btn = page.locator('#avatar-btn');
    await expect(btn).toBeVisible();

    // Avatar button text should show one of the public avatars
    const text = await btn.textContent();
    expect(text).toContain('robot');

    // Cycle through all avatars — none should be "darth-vader" from generated
    const seenLabels: string[] = [];
    for (let i = 0; i < 4; i++) {
      const label = await btn.textContent();
      seenLabels.push(label ?? '');
      await btn.click();
      await page.waitForTimeout(500);
    }

    // darth-vader should NOT appear in the cycle
    const hasDarthVader = seenLabels.some((l) => l.includes('darth-vader'));
    expect(hasDarthVader).toBe(false);

    expect(errors).toEqual([]);
  });
});
