import { test, expect, type Page } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Checkpoint 07 — Placeholder World (§8 automated verification):
 *  1. region boots with the placeholder system live, no console errors
 *  2. placeholder census vs placement.json (Master §11.1): every approved
 *     instance/cluster represented, zero omissions; counts per category
 *  3. category completeness vs the addendum §2.5 minimum list; §8.3 legend
 *     colors exact (independent copy of the master table)
 *  4. per-instance ground-contact on the revised CP05A heightfield,
 *     INDEPENDENTLY recomputed through region.world.terrainHeight (never
 *     the plan's own contact record): no float beyond tolerance, no
 *     burial beyond the exposure floor, volumes fully submerged with
 *     seabed clearance
 *  5. X/Z preservation: approved X/Z placed exactly (=== on the JSON
 *     values); cluster members stay inside their cluster footprint
 *  6. seam reservations: no density-scattered placeholder inside the
 *     cave/arch/ruin/structure/spawn exclusion radii
 *  7. plan determinism: identical digest across two reloads
 *  8. performance with ALL placeholders visible: scripted swim through
 *     the placeholder-dense south bay — simHz > 100, median fps ≥ 58;
 *     placeholder draw-cost attribution via the visibility toggle
 *
 * The existing suites (04B four-shot, containment, replay, camera, pool,
 * scaffold, terrain, substrate, ambient, optics) re-run unchanged in the
 * same invocation — the §13 guardrail that approved systems are untouched.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(HERE, '..');
const REPO_ROOT = resolve(APP_ROOT, '..', '..');
const WORLD_DIR = join(APP_ROOT, 'public', 'world');
const RESULTS_PATH = join(REPO_ROOT, 'eval', 'shared-world-results.json');

/** Master §8.3 legend — independent copy for the color assertion. */
const MASTER_LEGEND: Record<string, string> = {
  rock: '#7C8468',
  coral: '#D97A4A',
  kelp: '#3E9B3A',
  seagrass: '#5E8A50',
  tree: '#3E6B2E',
  flower: '#C05A9E',
  ruin: '#9AA79A',
  building: '#A9784A',
  wreck: '#8C9296',
  fish: '#D0452F',
  animal: '#D08038',
  cave: '#6E6E76',
  audio: '#8E5AD0',
};

/** addendum §2.5 minimum categories → how this layout satisfies each. */
const MINIMUM_CATEGORIES: { name: string; placedAs: string[] | null }[] = [
  { name: 'kelp', placedAs: ['kelp'] },
  { name: 'seagrass', placedAs: ['seagrass'] },
  { name: 'coral', placedAs: ['coral'] },
  { name: 'freestanding rocks/boulders', placedAs: ['rock'] },
  { name: 'trees', placedAs: ['tree'] },
  { name: 'shrubs', placedAs: ['tree'] },
  { name: 'grass clumps', placedAs: ['seagrass'] },
  { name: 'caves/arches pre-geometry', placedAs: ['cave'] },
  { name: 'ruins', placedAs: ['ruin'] },
  { name: 'wrecks', placedAs: ['wreck'] },
  { name: 'buildings/structures', placedAs: null }, // no approved site — must be in notPlaced
  { name: 'fish schools', placedAs: ['fish'] },
  { name: 'larger wildlife', placedAs: ['animal'] },
  { name: 'interactable/landmark props', placedAs: ['rock', 'ruin'] },
];

const results: Record<string, unknown> = {};

test.afterAll(async () => {
  mkdirSync(dirname(RESULTS_PATH), { recursive: true });
  const existing = existsSync(RESULTS_PATH)
    ? (JSON.parse(readFileSync(RESULTS_PATH, 'utf8')) as Record<string, unknown>)
    : {};
  writeFileSync(
    RESULTS_PATH,
    JSON.stringify(
      {
        ...existing,
        checkpoint: '07-placeholder-world',
        generatedAt: new Date().toISOString(),
        region07: { ...(existing.region07 as object | undefined), ...results },
      },
      null,
      2,
    ) + '\n',
  );
});

// ---------------------------------------------------------------- helpers

async function bootRegion(page: Page, qs = ''): Promise<string[]> {
  const consoleErrors: string[] = [];
  const isFavicon = (s: string) => s.includes('favicon');
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const loc = msg.location();
      const text = `${msg.text()}${loc.url ? ` [${loc.url}]` : ''}`;
      if (!isFavicon(text)) consoleErrors.push(text);
    }
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));
  page.on('response', (res) => {
    if (res.status() >= 400 && !isFavicon(res.url())) {
      consoleErrors.push(`HTTP ${res.status()} ${res.url()}`);
    }
  });
  await page.goto(`/shared-world/?view=region&hud=0${qs}`);
  await page.waitForFunction(
    () => {
      const h = (window as any).__SHARED_WORLD;
      return !!h && !!h.region?.placeholders && h.state().inWater === true;
    },
    undefined,
    { timeout: 40_000 },
  );
  return consoleErrors;
}

const ph = (page: Page, expr: string) =>
  page.evaluate(`(window).__SHARED_WORLD.region.placeholders.${expr}`);
const testHook = (page: Page, expr: string) =>
  page.evaluate(`(window).__SHARED_WORLD.test.${expr}`);

interface Inst {
  id: string;
  category: string;
  source: string;
  cluster: string;
  x: number;
  z: number;
  y: number;
  yaw: number;
  size: [number, number, number];
  align: 'up' | 'normal';
  grounded: boolean;
  contact: { steepFlag: boolean };
}

const placementJson = JSON.parse(readFileSync(join(WORLD_DIR, 'placement.json'), 'utf8')) as {
  instances: { category: string; type: string; x: number; z: number; yaw: number }[];
};

// ------------------------------------------------------------------- tests

test('1. region boots with the placeholder world live (production + debug views)', async ({ page }) => {
  const errors = await bootRegion(page);
  expect(errors).toEqual([]);
  const stats = (await ph(page, 'drawStats()')) as { meshes: number; instances: number; labels: number };
  expect(stats.instances).toBeGreaterThan(100);
  expect(stats.meshes).toBeLessThanOrEqual(13); // one InstancedMesh per legend category
  results.drawStats = stats;
  results.ySampling = await ph(page, 'ySampling');

  // debug view boots too (labels + site markers are debug-only)
  const errors2 = await bootRegion(page, '&debug=1');
  expect(errors2).toEqual([]);
});

test('2. census vs placement.json — every approved instance represented, zero omissions', async ({ page }) => {
  await bootRegion(page);
  const map = (await ph(page, 'placementMap()')) as {
    category: string; type: string; x: number; z: number; representation: string;
  }[];

  for (const p of placementJson.instances) {
    const hit = map.find(
      (m) => m.category === p.category && m.type === p.type && m.x === p.x && m.z === p.z,
    );
    expect(hit, `placement.json ${p.category}/${p.type} must be represented`).toBeTruthy();
  }
  expect(map.length).toBe(placementJson.instances.length);

  const census = (await ph(page, 'census()')) as {
    category: string; label: string; hex: string; clusters: number; instances: number;
  }[];
  results.census = census;
  results.placementMap = map;
  results.totalInstances = (await ph(page, 'instances()') as Inst[]).length;
});

test('3. category completeness (addendum §2.5) + exact §8.3 legend colors', async ({ page }) => {
  await bootRegion(page);
  const census = (await ph(page, 'census()')) as { category: string; hex: string; instances: number }[];
  const notPlaced = (await ph(page, 'notPlaced()')) as { category: string; reason: string }[];
  const placedCats = new Set(census.map((c) => c.category));

  for (const row of MINIMUM_CATEGORIES) {
    if (row.placedAs === null) {
      const np = notPlaced.find((n) => n.category === 'building');
      expect(np, `${row.name}: must be explicitly reported as not-placed with a reason`).toBeTruthy();
      expect(np!.reason.length).toBeGreaterThan(20);
    } else {
      const found = row.placedAs.some((c) => placedCats.has(c));
      expect(found, `${row.name}: no placeholder category ${row.placedAs.join('/')} placed`).toBe(true);
    }
  }
  // every placed category carries the exact master hex
  for (const c of census) {
    expect(c.hex, `legend color for ${c.category}`).toBe(MASTER_LEGEND[c.category]);
  }
  // categories not placed must each carry a reason (never silently dropped)
  for (const np of notPlaced) {
    expect(Object.keys(MASTER_LEGEND)).toContain(np.category);
    expect(np.reason.length).toBeGreaterThan(20);
  }
  results.notPlaced = notPlaced;
});

test('4. ground contact independently recomputed on the CP05A heightfield', async ({ page }) => {
  await bootRegion(page);
  const instances = (await ph(page, 'instances()')) as Inst[];
  const constants = (await ph(page, 'constants')) as {
    EMBED_M: number; EMBED_FRAC: number; FLOAT_TOL_M: number;
    EXPOSED_MIN_SCATTER: number; EXPOSED_MIN_FIXED: number;
    VOLUME_TOP_MAX_Y: number; VOLUME_BOTTOM_CLEAR_M: number;
  };

  // independent recomputation: sample the heightfield through the eval
  // surface at each instance's footprint (center + 4 yaw-rotated corners)
  const pts: [number, number][] = [];
  for (const inst of instances) {
    const c = Math.cos(inst.yaw);
    const s = Math.sin(inst.yaw);
    pts.push([inst.x, inst.z]);
    for (const [ux, uz] of [
      [-inst.size[0] / 2, -inst.size[2] / 2],
      [inst.size[0] / 2, -inst.size[2] / 2],
      [-inst.size[0] / 2, inst.size[2] / 2],
      [inst.size[0] / 2, inst.size[2] / 2],
    ] as [number, number][]) {
      pts.push([inst.x + ux * c + uz * s, inst.z - ux * s + uz * c]);
    }
  }
  const heights = (await page.evaluate(
    (p) => p.map(([x, z]: [number, number]) => (window as any).__SHARED_WORLD.region.world.terrainHeight(x, z)),
    pts,
  )) as number[];

  let steepFlagged = 0;
  const failures: string[] = [];
  instances.forEach((inst, i) => {
    const hs = heights.slice(i * 5, i * 5 + 5);
    const hMin = Math.min(...hs);
    const hMean = hs.reduce((a, b) => a + b, 0) / hs.length;
    const sy = inst.size[1];
    const top = inst.y + sy / 2;
    const bottom = inst.y - sy / 2;
    if (!inst.grounded) {
      // wildlife volume: fully submerged, clear of the seabed
      if (top > constants.VOLUME_TOP_MAX_Y + 1e-6) failures.push(`${inst.id}: volume above top limit`);
      if (bottom < hs[0]! + constants.VOLUME_BOTTOM_CLEAR_M - 1e-6) {
        failures.push(`${inst.id}: volume intersects seabed`);
      }
      return;
    }
    if (inst.contact.steepFlag) steepFlagged++;
    if (inst.align === 'up') {
      // float law: the base must not hang above the lowest footprint sample
      if (bottom > hMin + constants.FLOAT_TOL_M) {
        failures.push(`${inst.id}: floating (base ${bottom.toFixed(2)} > hMin ${hMin.toFixed(2)})`);
      }
    } else {
      // normal-aligned: center embed law (base plane through the tangent
      // point) — center must sit at/below the center terrain + box height
      if (inst.y - sy / 2 > hs[0]! + constants.FLOAT_TOL_M + sy * 0.1) {
        failures.push(`${inst.id}: normal-aligned box off the surface at center`);
      }
    }
    // burial law: exposure above the MEAN footprint sample
    const exposedFrac = (top - hMean) / sy;
    const floor = inst.source === 'density' ? constants.EXPOSED_MIN_SCATTER : constants.EXPOSED_MIN_FIXED;
    if (exposedFrac < floor - 0.02 && !inst.contact.steepFlag) {
      failures.push(`${inst.id}: buried (exposed ${exposedFrac.toFixed(2)} < ${floor})`);
    }
  });
  expect(failures, failures.join('\n')).toEqual([]);
  results.contact = {
    instances: instances.length,
    grounded: instances.filter((i) => i.grounded).length,
    volumes: instances.filter((i) => !i.grounded).length,
    steepFlagged,
    tolerances: constants,
  };
  // the revised terrain introduced no unresolved placement conflict
  results.steepFlaggedIds = instances.filter((i) => i.contact.steepFlag).map((i) => i.id);
});

test('5. X/Z preservation — approved coordinates placed exactly', async ({ page }) => {
  await bootRegion(page);
  const instances = (await ph(page, 'instances()')) as Inst[];

  // exact-transform categories: every approved instance must have a
  // placeholder at EXACTLY the JSON x/z (and yaw)
  const exactCats: Record<string, string> = {
    discovery: 'ruin',
    wreck: 'wreck',
    'cave-mouth': 'cave',
    arch: 'cave',
    spire: 'rock',
    silhouette: 'rock',
  };
  for (const p of placementJson.instances) {
    const target = exactCats[p.category];
    if (!target) continue;
    const hit = instances.find(
      (i) => i.category === target && i.source === p.category && i.x === p.x && i.z === p.z,
    );
    expect(hit, `${p.category}/${p.type} must sit at exactly (${p.x}, ${p.z})`).toBeTruthy();
    expect(hit!.yaw, `${p.category}/${p.type} yaw`).toBe(p.yaw);
  }

  // cluster-class ruins: members stay inside the cluster footprint around
  // the approved anchor; the settlement core sits at the exact anchor
  for (const p of placementJson.instances.filter((q) => q.category === 'ruin')) {
    const members = instances.filter((i) => i.cluster === p.type);
    expect(members.length, `${p.type} cluster members`).toBeGreaterThanOrEqual(6);
    const maxR = p.type === 'shoreline-settlement' ? 16.5 : 17;
    for (const m of members) {
      const d = Math.hypot(m.x - p.x, m.z - p.z);
      expect(d, `${m.id} distance from approved anchor`).toBeLessThanOrEqual(maxR);
    }
    if (p.type === 'shoreline-settlement') {
      const core = members.find((m) => m.id.endsWith('-core'));
      expect(core!.x).toBe(p.x);
      expect(core!.z).toBe(p.z);
    }
  }
  results.xzPreservation = 'exact (===) for all approved discrete transforms';
});

test('6. seam reservations — density scatter stays clear of reserved sites', async ({ page }) => {
  await bootRegion(page);
  const instances = (await ph(page, 'instances()')) as Inst[];
  const constants = (await ph(page, 'constants')) as {
    RESERVE_M: number; CAVE_RESERVE_M: number; SPAWN_CLEAR_M: number;
  };
  const reserves: { id: string; x: number; z: number; r: number }[] = [
    { id: 'spawn', x: -180, z: -380, r: constants.SPAWN_CLEAR_M },
  ];
  for (const p of placementJson.instances) {
    if (p.category === 'cave-mouth' || p.category === 'arch') {
      reserves.push({ id: `${p.category}/${p.type}`, x: p.x, z: p.z, r: constants.CAVE_RESERVE_M });
    } else if (['ruin', 'wreck', 'spire', 'silhouette', 'discovery'].includes(p.category)) {
      reserves.push({ id: `${p.category}/${p.type}`, x: p.x, z: p.z, r: constants.RESERVE_M });
    }
  }
  const violations: string[] = [];
  for (const inst of instances) {
    if (inst.source !== 'density' || !inst.grounded) continue;
    for (const rv of reserves) {
      const d = Math.hypot(inst.x - rv.x, inst.z - rv.z);
      if (d <= rv.r) violations.push(`${inst.id} inside ${rv.id} reserve (${d.toFixed(1)} m)`);
    }
  }
  expect(violations, violations.join('\n')).toEqual([]);
  results.reserves = { count: reserves.length, violations: 0 };
});

test('7. plan determinism — identical digest across reloads', async ({ page }) => {
  await bootRegion(page);
  const d1 = (await ph(page, 'digest()')) as string;
  await bootRegion(page);
  const d2 = (await ph(page, 'digest()')) as string;
  expect(d1.length).toBeGreaterThan(1000);
  expect(d2).toBe(d1);
  results.digestLength = d1.length;
});

test('8. performance with all placeholders visible — simHz > 100, median fps ≥ 58', async ({ page }) => {
  await bootRegion(page);
  // south bay: the placeholder-dense leg (kelp fields, coral, column
  // field, spires, schools all in range)
  await testHook(page, 'teleport(-180, 300, -6)');
  await testHook(page, 'setIntent({ kicks: 0, kickRate: 1.4, pitch: 0, lean: 0.2 })');
  const perf = await page.evaluate(
    () =>
      new Promise<{ fpsBuckets: number[]; simHz: number }>((done) => {
        const buckets: number[] = [];
        let frames = 0;
        const tick = () => {
          frames++;
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        const iv = setInterval(() => {
          buckets.push(frames);
          frames = 0;
          if (buckets.length >= 10) {
            clearInterval(iv);
            done({ fpsBuckets: buckets, simHz: (window as any).__SHARED_WORLD.state().simHz });
          }
        }, 1000);
      }),
  );
  await testHook(page, 'setIntent(null)');
  const sorted = [...perf.fpsBuckets].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;

  // placeholder draw-cost attribution: frame ms with the placeholders
  // hidden vs visible (report-only; the assertion is the visible fps)
  const stageOn = await page.evaluate(() => (window as any).__SHARED_WORLD.region.stageMs());
  await testHook(page, 'setPlaceholdersVisible(false)');
  await page.waitForTimeout(2500);
  const stageOff = await page.evaluate(() => (window as any).__SHARED_WORLD.region.stageMs());
  await testHook(page, 'setPlaceholdersVisible(true)');

  results.performance = {
    viewport: page.viewportSize(),
    fpsBuckets: perf.fpsBuckets,
    medianFps: median,
    simHz: perf.simHz,
    stageMsPlaceholdersOn: stageOn,
    stageMsPlaceholdersOff: stageOff,
  };
  expect(perf.simHz, `simHz ${perf.simHz}`).toBeGreaterThan(100);
  expect(median, `median fps ${median} (buckets: ${perf.fpsBuckets.join(',')})`).toBeGreaterThanOrEqual(58);
});
