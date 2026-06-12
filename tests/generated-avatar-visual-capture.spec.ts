import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_SLUGS = [
  'woody',
  'darth-vader',
  'fortnite-batman',
  'iron-man',
  'shrek',
  'amazing-spider-man-2',
  'terminator-t-800',
  'spider-man-no-way-home',
  'spider-man-playstation',
  'jack-sparrow',
];

const DEFAULT_POSES = [
  'neutral',
  'arms_out',
  'arms_up',
  'arms_forward',
  'elbow_bend_left',
  'elbow_bend_right',
  'wrist_rotate_left',
  'wrist_rotate_right',
  'palm_forward',
  'lean_left',
  'lean_right',
  'torso_turn_left',
  'torso_turn_right',
  'walking_stride_proxy',
  'foot_lift_left',
  'foot_lift_right',
  'foot_rotate_left',
  'foot_rotate_right',
  'rowing_stroke_start',
  'rowing_stroke_pull',
  'flying_arms_out',
  'hand_to_mouth_proxy',
  'hand_to_cheek_proxy',
  'finger_curl_left_if_fingers_exist',
  'finger_curl_right_if_fingers_exist',
];

function csvEnv(name: string, fallback: string[]): string[] {
  return (process.env[name] ?? fallback.join(','))
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const slugs = csvEnv('PP_VISUAL_QA_SLUGS', DEFAULT_SLUGS);
const poses = csvEnv('PP_VISUAL_QA_POSES', DEFAULT_POSES);
const outputRoot = process.env.PP_VISUAL_QA_OUT ?? path.resolve('model-working');
const smokeMode = process.env.PP_VISUAL_QA_SMOKE ?? 'avatar-visual-review';

test.describe('generated avatar visual capture', () => {
  test.describe.configure({ mode: 'serial' });

  for (const slug of slugs) {
    test(`capture visual rig evidence for ${slug}`, async ({ page }) => {
      test.setTimeout(240_000);
      const outDir = path.join(outputRoot, slug, 'visual-review');
      mkdirSync(outDir, { recursive: true });

      const consoleMessages: Array<{ type: string; text: string }> = [];
      const pageErrors: string[] = [];
      page.on('console', (message) => {
        const type = message.type();
        if (type === 'warning' || type === 'error' || message.text().includes('[generated-avatar]')) {
          consoleMessages.push({ type, text: message.text() });
        }
      });
      page.on('pageerror', (error) => pageErrors.push(String(error)));

      await page.setViewportSize({ width: 960, height: 960 });
      await page.goto(`/?generatedAvatar=${slug}&smoke=${smokeMode}`);
      await page.waitForFunction(
        () => window.__PP?.avatarStatus === 'loaded' || window.__PP?.avatarStatus === 'error',
        undefined,
        { timeout: 45_000 },
      );

      const status = await page.evaluate(() => window.__PP.avatarStatus);
      const statusText = await page.locator('[data-testid="avatar-status"]').textContent().catch(() => '');
      const stage = page.locator('#stage');
      await expect(stage).toBeVisible();
      await page.evaluate(() => window.__PPVisualQa?.frameAvatar());
      await page.waitForTimeout(350);
      await stage.screenshot({ path: path.join(outDir, 'browser-load.png') });

      const diagnostics = await page.evaluate(() => window.__PPVisualQa?.getDiagnostics() ?? null);
      const poseResults: unknown[] = [];
      if (status === 'loaded') {
        for (const pose of poses) {
          const result = await page.evaluate((poseName) => window.__PPVisualQa?.applyPose(poseName), pose);
          await page.evaluate(() => window.__PPVisualQa?.frameAvatar());
          await page.waitForTimeout(180);
          const filename = pose === 'neutral' ? 'neutral.png' : `pose-${pose}.png`;
          await stage.screenshot({ path: path.join(outDir, filename) });
          poseResults.push(result);
        }
        await page.evaluate(() => window.__PPVisualQa?.clearPose());
      }

      const manifest = {
        schema_version: 'posepuppet-generated-avatar-visual-capture-v1',
        slug,
        smoke_mode: smokeMode,
        url: `/?generatedAvatar=${slug}&smoke=${smokeMode}`,
        status,
        status_text: statusText,
        diagnostics,
        screenshot_paths: {
          browser_load: path.join(outDir, 'browser-load.png'),
          neutral: path.join(outDir, 'neutral.png'),
          pose_glob: path.join(outDir, 'pose-*.png'),
        },
        pose_results: poseResults,
        console_messages: consoleMessages,
        page_errors: pageErrors,
      };
      writeFileSync(path.join(outDir, 'capture-results.json'), JSON.stringify(manifest, null, 2) + '\n');
    });
  }
});
