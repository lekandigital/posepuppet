import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const DEFAULT_SLUGS = [
  'amazing-spider-man-2',
  'terminator-t-800',
  'spider-man-no-way-home',
  'spider-man-playstation',
  'jack-sparrow',
  'elsa',
  'buzz-lightyear',
  'teal-v2',
];

const POSES = [
  'arms_forward',
  'arms_out',
  'arms_up',
  'elbow_bend_left',
  'elbow_bend_right',
  'finger_curl_left_if_fingers_exist',
  'finger_curl_right_if_fingers_exist',
  'flying_arms_out',
  'foot_lift_left',
  'foot_lift_right',
  'foot_rotate_left',
  'foot_rotate_right',
  'hand_to_cheek_proxy',
  'hand_to_mouth_proxy',
  'lean_left',
  'lean_right',
  'palm_forward',
  'rowing_stroke_pull',
  'rowing_stroke_start',
  'torso_turn_left',
  'torso_turn_right',
  'walking_stride_proxy',
  'wrist_rotate_left',
  'wrist_rotate_right',
];

function requestedSlugs(): string[] {
  const raw = process.env.VISUAL_SLUGS;
  if (!raw) return DEFAULT_SLUGS;
  return raw.split(',').map((slug) => slug.trim()).filter(Boolean);
}

async function captureStage(page: Page, path: string): Promise<void> {
  mkdirSync(dirname(path), { recursive: true });
  await page.locator('#stage').screenshot({ path });
}

for (const slug of requestedSlugs()) {
  test(`captures generated avatar visual pose suite: ${slug}`, async ({ page }) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const consoleMessages: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      const text = `[${m.type()}] ${m.text()}`;
      consoleMessages.push(text);
      if (m.type() === 'warning') warnings.push(text);
    });

    const outRoot = resolve(process.env.VISUAL_OUT_DIR ?? 'model-working-hard-fix');
    const attemptId = process.env.VISUAL_ATTEMPT_ID ?? 'attempt-visual-capture';
    const attemptDir = join(outRoot, slug, 'attempts', attemptId, 'visual-review');
    const latestDir = join(outRoot, slug, 'visual-review');
    const poseDir = join(attemptDir, 'pose-suite');
    const latestPoseDir = join(latestDir, 'pose-suite');
    mkdirSync(poseDir, { recursive: true });
    mkdirSync(latestPoseDir, { recursive: true });

    const extraQuery = process.env.VISUAL_QUERY ? `&${process.env.VISUAL_QUERY.replace(/^[?&]+/, '')}` : '';
    await page.goto(`/?generatedAvatar=${encodeURIComponent(slug)}&smoke=avatar-visual-review${extraQuery}`);
    await page.waitForFunction(
      () => window.__PP?.avatarStatus === 'loaded' || window.__PP?.avatarStatus === 'error' || window.__PP?.avatarStatus === 'fallback',
      undefined,
      { timeout: 45_000 },
    );
    await page.waitForTimeout(500);

    const status = await page.evaluate(() => window.__PP?.avatarStatus ?? 'missing');
    const warning = await page.evaluate(() => window.__PP?.avatarWarning ?? '');
    const normalization = await page.evaluate(() => window.__PP?.avatarNormalization ?? null);
    const browserDiagnostics = await page.evaluate(() => window.__PP?.avatarDiagnostics?.() ?? null);

    await captureStage(page, join(attemptDir, 'browser-load.png'));
    copyFileSync(join(attemptDir, 'browser-load.png'), join(latestDir, 'browser-load.png'));

    const frameResult = await page.evaluate(() => window.__PP?.frameAvatar?.() ?? null);
    await page.waitForTimeout(250);
    const neutralDiagnostics = await page.evaluate(() => window.__PP?.applyVisualPose?.('neutral') ?? null);
    await captureStage(page, join(attemptDir, 'neutral.png'));
    copyFileSync(join(attemptDir, 'neutral.png'), join(latestDir, 'neutral.png'));

    const poseDiagnostics: Record<string, unknown> = {};
    for (const pose of POSES) {
      poseDiagnostics[pose] = await page.evaluate((poseName) => window.__PP?.applyVisualPose?.(poseName) ?? null, pose);
      await page.waitForTimeout(120);
      const posePath = join(poseDir, `pose-${pose}.png`);
      await captureStage(page, posePath);
      copyFileSync(posePath, join(latestPoseDir, `pose-${pose}.png`));
    }

    const results = {
      schema_version: 'posepuppet-generated-avatar-visual-capture-v1',
      slug,
      attempt_id: attemptId,
      status,
      warning,
      extra_query: extraQuery,
      errors,
      warnings,
      console_messages: consoleMessages.slice(-80),
      normalization,
      browser_diagnostics: browserDiagnostics,
      frame_result: frameResult,
      neutral_diagnostics: neutralDiagnostics,
      pose_diagnostics: poseDiagnostics,
      screenshots: {
        browser_load: join(attemptDir, 'browser-load.png'),
        neutral: join(attemptDir, 'neutral.png'),
        pose_suite_dir: poseDir,
      },
    };
    writeFileSync(join(attemptDir, 'capture-results.json'), `${JSON.stringify(results, null, 2)}\n`);
    writeFileSync(join(latestDir, 'capture-results.json'), `${JSON.stringify({ ...results, latest_copy: true }, null, 2)}\n`);

    expect(status).toBe('loaded');
    expect(errors).toEqual([]);
  });
}
