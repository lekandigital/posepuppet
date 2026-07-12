// O1: the capability manifest matches ground truth on the known roster,
// and a deliberately mislabeled entry is CAUGHT by the same comparison the
// regen script runs (scripts/capability-lib.mjs — one rule set, two callers).

import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — plain JS module shared with scripts/capability-report.mjs
import { buildInspection, checkManifest, compareEntry } from '../scripts/capability-lib.mjs';

const PP_PORT = process.env.PP_PORT ?? '5173';
const BASE = `http://localhost:${PP_PORT}`;
const manifestPath = resolve(here, '..', 'data', 'avatar-capabilities.json');

declare global {
  interface Window {
    __PPCaps?: () => { id: string; name: string; report: unknown | null };
  }
}

test('manifest matches live roster inspection; mislabels are caught', async ({ page }) => {
  test.setTimeout(300_000);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const roster = Object.keys(manifest.avatars) as string[];
  expect(roster.length).toBeGreaterThanOrEqual(3);

  // live inspection through the real app + loaders (the report script's path)
  const liveById: Record<string, unknown> = {};
  for (const id of roster) {
    await page.goto(`${BASE}/?avatar=${id}`);
    try {
      await page.waitForFunction(
        (want) => {
          const caps = window.__PPCaps?.();
          return Boolean(caps && caps.report && caps.id === want);
        },
        id,
        { timeout: 60_000 },
      );
      const caps = await page.evaluate(() => window.__PPCaps!());
      liveById[id] = buildInspection(caps.report);
    } catch {
      liveById[id] = null; // absent local-only file — localOnly entries skip
    }
  }

  // 1) the reviewed manifest is truthful
  const { issues, checked, skipped } = checkManifest(manifest, liveById);
  expect(checked.length, 'at least robot+astronaut+erika inspected').toBeGreaterThanOrEqual(3);
  expect(issues, `manifest drift:\n${issues.join('\n')}`).toEqual([]);
  for (const id of skipped) {
    expect(manifest.avatars[id].localOnly, `${id} skipped but not localOnly`).toBe(true);
  }

  // 2) a deliberately mislabeled entry is caught — silently demote erika
  // (chains exist, no fingersNote justifying the downgrade)
  const badFingers = JSON.parse(JSON.stringify(manifest));
  badFingers.avatars.erika.capabilities.fingers = false;
  const caught = checkManifest(badFingers, liveById);
  expect(caught.issues.some((i: string) => i.includes('MISLABEL') && i.includes('erika'))).toBe(true);

  // …and the inverse lie (a chainless rig promoted to fingers) is caught too
  const badMitts = JSON.parse(JSON.stringify(manifest));
  badMitts.avatars.robot.capabilities.fingers = true;
  const caught2 = compareEntry('robot', badMitts.avatars.robot, liveById['robot']);
  expect(caught2.some((i: string) => i.includes('MISLABEL'))).toBe(true);

  // the astronaut's DOCUMENTED demotion (fingersNote) is accepted as-is
  expect(manifest.avatars.astronaut.capabilities.fingers).toBe(false);
  expect(Boolean(manifest.avatars.astronaut.capabilities.fingersNote)).toBe(true);

  // 3) inspection drift is caught (stale manifest after a rig change)
  const badFeet = JSON.parse(JSON.stringify(manifest));
  badFeet.avatars.robot.inspection.feet = false;
  const caught3 = compareEntry('robot', badFeet.avatars.robot, liveById['robot']);
  expect(caught3.length).toBeGreaterThan(0);
});
