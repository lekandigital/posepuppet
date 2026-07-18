import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

/**
 * Checkpoint 04A — region bake and loader (§8 automated verification):
 *  1. bake determinism (two in-memory runs + disk, SHA-256 per artifact)
 *  2. bake schema/layout-fidelity/SDF checks (--check JSON report re-asserted)
 *  3. independent schema audit of the committed artifacts (sizes, ranges,
 *     height↔shore sign consistency on 10 000 texels — own PNG decode, no
 *     bake code involved)
 *  4. preview boots with no console errors; loader validation passed
 *  5. loader round-trip: terrainHeight at the 20 committed probes ± 0.01 m
 *  6. containment battery re-pointed: 8 yaws × 11 s full burst from spawn
 *     against RegionSampler (never exits water, minShore > −0.5, min speed
 *     > 0.5 m/s, max decel per 200 ms < 3.5 m/s [DERIVED, flagged]) + the
 *     depth-clamp dive run
 *  7. region replay self-consistency (same script → same digest, across
 *     reloads)
 *  8. preview performance: median fps ≥ 58 over a 10 s scripted orbit
 *
 * The pool/camera/scaffold suites run unchanged alongside (§8.8 regression).
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(HERE, '..');
const REPO_ROOT = resolve(APP_ROOT, '..', '..');
const WORLD_DIR = join(APP_ROOT, 'public', 'world');
const BAKE = join(APP_ROOT, 'authoring', 'bake-region.mjs');
const RESULTS_PATH = join(REPO_ROOT, 'eval', 'shared-world-results.json');

const N = 2049;
const TEXEL = 2000 / 2048;
const SEED = 60418003;

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
        checkpoint: '04A-region-bake-loader',
        region: { ...(existing.region as object | undefined), ...results },
      },
      null,
      2,
    ) + '\n',
  );
});

// --- artifact decode helpers (independent of the bake script) ---

const qDecode = (v: number) => -80 + (v / 65535) * 280;

function readU16(name: string): Uint16Array {
  const buf = readFileSync(join(WORLD_DIR, name));
  return new Uint16Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

/** Minimal PNG decode for the bake's own encoding (8-bit, filter 0 rows). */
function decodePng(name: string): { width: number; height: number; bpp: number; data: Buffer } {
  const png = readFileSync(join(WORLD_DIR, name));
  expect(png.readUInt32BE(0)).toBe(0x89504e47);
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const colorType = png[25]!;
  const bpp = colorType === 0 ? 1 : 4;
  const idat: Buffer[] = [];
  let off = 8;
  while (off < png.length) {
    const len = png.readUInt32BE(off);
    const type = png.toString('ascii', off + 4, off + 8);
    if (type === 'IDAT') idat.push(png.subarray(off + 8, off + 8 + len));
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = 1 + width * bpp;
  const data = Buffer.alloc(width * height * bpp);
  for (let y = 0; y < height; y++) {
    expect(raw[y * stride]).toBe(0); // filter 0 only (the bake's encoding)
    raw.copy(data, y * width * bpp, y * stride + 1, (y + 1) * stride);
  }
  return { width, height, bpp, data };
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function bootPreview(page: import('@playwright/test').Page): Promise<string[]> {
  const consoleErrors: string[] = [];
  const isFavicon = (s: string) => s.includes('/favicon.ico');
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
  await page.goto('/shared-world/?view=region-preview');
  await page.waitForFunction(() => (window as any).__REGION_PREVIEW?.ready === true, undefined, {
    timeout: 30_000,
  });
  return consoleErrors;
}

test.describe('checkpoint 04A — region bake and loader', () => {
  test('1. bake determinism: two runs → identical SHA-256 per artifact, matching disk', () => {
    const out = execFileSync('node', [BAKE, '--verify'], { encoding: 'utf8', timeout: 120_000 });
    expect(out).toContain('VERIFY PASS: byte-identical across runs and vs disk.');
    expect(out).not.toContain('MISMATCH');
    results.bakeDeterminism = 'PASS (SHA-256 per artifact, in-memory ×2 + disk)';
  });

  test('2. bake schema/layout-fidelity/SDF checks all pass, with the committed fidelity numbers', () => {
    const out = execFileSync('node', [BAKE, '--check'], { encoding: 'utf8', timeout: 120_000 });
    const line = out.split('\n').find((l) => l.startsWith('CHECK-REPORT '));
    expect(line).toBeTruthy();
    const report = JSON.parse(line!.slice('CHECK-REPORT '.length)) as {
      pass: boolean;
      seed: number;
      checks: { name: string; pass: boolean; [k: string]: unknown }[];
    };
    expect(report.pass).toBe(true);
    expect(report.seed).toBe(SEED);
    const byName = Object.fromEntries(report.checks.map((c) => [c.name, c]));
    // re-assert the §8.3 bounds independently of the script's own verdicts
    expect(byName['coastline-iou-vs-sketch']!.iou as number).toBeGreaterThanOrEqual(0.92);
    expect(byName['coastline-iou-vs-sketch']!.coastlineDeviationMeters as number).toBeLessThanOrEqual(25);
    expect(byName['summit-position-and-height']!.deviationM as number).toBeLessThanOrEqual(25);
    expect(byName['summit-position-and-height']!.heightM as number).toBeGreaterThanOrEqual(195);
    expect(byName['trench-floor']!.minAlongSpineM as number).toBeLessThanOrEqual(-70);
    expect(byName['lagoon-depth-band']!.fracIn3to10 as number).toBeGreaterThanOrEqual(0.8);
    for (const c of report.checks) {
      if (c.name.startsWith('island-centroid-')) {
        expect(c.deviationM as number, c.name).toBeLessThanOrEqual(50);
      }
    }
    expect(byName['sdf-sign-matches-inwater']!.agree).toBe(1000);
    results.fidelity = report.checks;
  });

  test('3. schema audit of the committed artifacts (independent decode)', () => {
    // sizes on disk
    const sizes: Record<string, number> = {};
    for (const name of [
      'height.r16', 'shore.png', 'shore_sdf.r16', 'biome.png',
      'placement.json', 'caves.json', 'world.json',
    ]) {
      sizes[name] = statSync(join(WORLD_DIR, name)).size;
    }
    expect(sizes['height.r16']).toBe(N * N * 2);
    expect(sizes['shore_sdf.r16']).toBe(N * N * 2);
    results.artifactBytes = sizes;

    const h16 = readU16('height.r16');
    expect(h16.length).toBe(N * N);
    let min = Infinity;
    let max = -Infinity;
    for (let k = 0; k < h16.length; k++) {
      const h = qDecode(h16[k]!);
      if (h < min) min = h;
      if (h > max) max = h;
    }
    expect(min).toBeGreaterThanOrEqual(-80 - 1e-6);
    expect(max).toBeLessThanOrEqual(200 + 1e-6);
    results.heightRange = { min, max };

    const shore = decodePng('shore.png');
    expect(shore.width).toBe(N);
    expect(shore.height).toBe(N);
    expect(shore.bpp).toBe(1);
    const biome = decodePng('biome.png');
    expect(biome.width).toBe(1025);
    expect(biome.bpp).toBe(4);

    // sea-level sign consistency on 10 000 seeded texels (§8.2)
    const rnd = mulberry32(SEED ^ 0xa0d17);
    let agree = 0;
    for (let s = 0; s < 10_000; s++) {
      const k = Math.floor(rnd() * N * N);
      const land = qDecode(h16[k]!) >= 0;
      if (land === (shore.data[k]! >= 128)) agree++;
    }
    expect(agree).toBe(10_000);
    results.heightShoreSignAgree = agree;

    // world.json header vs payloads
    const world = JSON.parse(readFileSync(join(WORLD_DIR, 'world.json'), 'utf8'));
    expect(world.magic).toBe('bodyarcade-region-world/1');
    expect(world.seed).toBe(SEED);
    expect(world.heightRange).toEqual([-80, 200]);
    expect(world.seaLevel).toBe(0);
    expect(world.spawn.x).toBe(-180);
    expect(world.spawn.z).toBe(-380);
    expect(world.attribution.join(' ')).toContain('original BodyArcade authored terrain');
    expect(world.verification.probes).toHaveLength(20);
    for (const name of Object.keys(world.artifacts)) {
      expect(world.artifacts[name].bytes, name).toBe(sizes[name]);
    }
    // the approved sites are all present in placement.json
    const placement = JSON.parse(readFileSync(join(WORLD_DIR, 'placement.json'), 'utf8'));
    const census: Record<string, number> = {};
    for (const inst of placement.instances) census[inst.category] = (census[inst.category] ?? 0) + 1;
    expect(census).toEqual({
      spawn: 1, breach: 3, arch: 1, 'cave-mouth': 3, ruin: 2, wreck: 1,
      'corridor-mass': 3, spire: 2, silhouette: 1, current: 1,
      discovery: 7, route: 13,
    });
    results.placementCensus = census;
    const caves = JSON.parse(readFileSync(join(WORLD_DIR, 'caves.json'), 'utf8'));
    expect(caves.modules.map((m: { id: string }) => m.id)).toEqual([
      'cave-headland', 'cave-trench-wall', 'arch-islet-gap',
    ]);
    // approved: no E2 shaft anywhere
    expect(JSON.stringify(placement) + JSON.stringify(caves)).not.toContain('E2');
  });

  test('4. preview boots: loader validation passes, no console errors, overlay live', async ({ page }) => {
    const consoleErrors = await bootPreview(page);
    const handle = await page.evaluate(() => {
      const h = (window as any).__REGION_PREVIEW;
      return { decodeMs: h.decodeMs, meshBuildMs: h.meshBuildMs, decodedBytes: h.decodedBytes };
    });
    expect(handle.decodedBytes).toBe(N * N * 4 * 2 + N * N); // two Float32 fields + mask
    await expect(page.locator('#region-preview-overlay')).toContainText('REGION PREVIEW');
    await page.waitForTimeout(1500);
    expect(consoleErrors, `console errors: ${consoleErrors.join(' | ')}`).toEqual([]);
    results.previewBoot = { ...handle, consoleErrors: consoleErrors.length };
  });

  test('5. loader round-trip: terrainHeight at the 20 committed probes within 0.01 m', async ({ page }) => {
    await bootPreview(page);
    const deltas = await page.evaluate(() => {
      const h = (window as any).__REGION_PREVIEW;
      return h.header.verification.probes.map(
        (p: { x: number; z: number; h: number }) => Math.abs(h.world.terrainHeight(p.x, p.z) - p.h),
      );
    });
    expect(deltas).toHaveLength(20);
    for (const d of deltas) expect(d).toBeLessThan(0.01);
    results.roundTripMaxDeltaM = Math.max(...deltas);
  });

  test('6. containment battery re-pointed at RegionSampler: 8 yaws × 11 s full burst from spawn', async ({ page }) => {
    test.setTimeout(180_000);
    await bootPreview(page);
    const battery: Record<string, unknown>[] = [];
    for (let d = 0; d < 8; d++) {
      const yaw = (d / 8) * Math.PI * 2;
      const samples = (await page.evaluate(
        (y) => (window as any).__REGION_PREVIEW.test.containmentRun(y, 11),
        yaw,
      )) as { t: number; inWater: boolean; shore: number; speed: number }[];
      expect(samples.length).toBeGreaterThanOrEqual(55);
      let minShore = Infinity;
      let minSpeed = Infinity;
      let maxDecel = 0;
      for (let s = 0; s < samples.length; s++) {
        const smp = samples[s]!;
        expect(smp.inWater, `yaw ${yaw.toFixed(2)} t=${smp.t}s left the water`).toBe(true);
        minShore = Math.min(minShore, smp.shore);
        // min-speed floor after the initial 2 s (burst spin-up from spawn speed 2)
        if (smp.t >= 2) minSpeed = Math.min(minSpeed, smp.speed);
        if (s > 0) maxDecel = Math.max(maxDecel, samples[s - 1]!.speed - smp.speed);
      }
      expect(minShore).toBeGreaterThan(-0.5);
      expect(minSpeed).toBeGreaterThan(0.5);
      expect(maxDecel).toBeLessThan(3.5);
      battery.push({ yaw, minShore, minSpeed, maxDecelPer200ms: maxDecel });
    }
    results.containmentBattery = battery;

    // engagement battery (beyond the §8.5 contract, which starts at the
    // lagoon-center spawn — ≈ 95 m of travel in 11 s never reaches the 55 m
    // shore band there): same assertions from 28 m off the headland's north
    // shore, where several headings drive straight at real shoreline and the
    // soft containment + slide must redirect without a hard wall
    const engagement: Record<string, unknown>[] = [];
    for (let d = 0; d < 8; d++) {
      const yaw = (d / 8) * Math.PI * 2;
      const samples = (await page.evaluate(
        (y) =>
          (window as any).__REGION_PREVIEW.test.containmentRun(y, 11, {}, { x: -320, z: -120 }),
        yaw,
      )) as { t: number; inWater: boolean; shore: number; speed: number }[];
      let minShore = Infinity;
      let minSpeed = Infinity;
      let maxDecel = 0;
      for (let s = 0; s < samples.length; s++) {
        const smp = samples[s]!;
        expect(smp.inWater, `cove yaw ${yaw.toFixed(2)} t=${smp.t}s left the water`).toBe(true);
        minShore = Math.min(minShore, smp.shore);
        if (smp.t >= 2) minSpeed = Math.min(minSpeed, smp.speed);
        if (s > 0) maxDecel = Math.max(maxDecel, samples[s - 1]!.speed - smp.speed);
      }
      expect(minShore).toBeGreaterThan(-0.5);
      expect(minSpeed).toBeGreaterThan(0.5);
      expect(maxDecel).toBeLessThan(3.5);
      engagement.push({ yaw, minShore, minSpeed, maxDecelPer200ms: maxDecel });
    }
    results.containmentEngagementCove = engagement;

    // depth clamps against the region field: full-burst dive — y respects the
    // seabed clearance floor everywhere along the run
    const dive = (await page.evaluate(() =>
      (window as any).__REGION_PREVIEW.test.containmentRun(Math.PI / 2, 11, { pitch: 1 }),
    )) as { y: number; depth: number }[];
    let worstBelowFloor = Infinity;
    for (const s of dive) {
      worstBelowFloor = Math.min(worstBelowFloor, s.y - (-s.depth + 1.2));
    }
    expect(worstBelowFloor).toBeGreaterThan(-0.5); // soft spring tolerance
    results.depthClampWorstBelowFloorM = worstBelowFloor;
  });

  test('7. region replay self-consistency: same script → same digest, across reloads', async ({ page }) => {
    await bootPreview(page);
    const script = JSON.stringify([
      { steps: 240, intent: { kicks: 1, kickAmp: 0.8 } },
      { steps: 480, intent: { pitch: 0.5, roll: 0.3 } },
      { steps: 480, intent: { burst: true } },
      { steps: 240, intent: { autopilot: true } },
    ]);
    const run = (p: import('@playwright/test').Page) =>
      p.evaluate(`(window).__REGION_PREVIEW.test.runScript(${script})`);
    const a = await run(page);
    const b = await run(page);
    expect(b).toBe(a);
    await bootPreview(page);
    const c = await run(page);
    expect(c).toBe(a);
    results.regionReplayDigest = String(a).slice(0, 64);
  });

  test('8. preview performance: median fps ≥ 58 over a 10 s scripted orbit of the full region', async ({ page }) => {
    test.setTimeout(120_000);
    await bootPreview(page);
    await page.evaluate(() => (window as any).__REGION_PREVIEW.test.setAutoOrbit(8));
    await page.waitForTimeout(2000); // warm up
    const perf = await page.evaluate(
      () =>
        new Promise<{ fpsBuckets: number[] }>((done) => {
          const fpsBuckets: number[] = [];
          let frames = 0;
          const bucket = () => {
            fpsBuckets.push(frames);
            frames = 0;
            if (fpsBuckets.length >= 10) done({ fpsBuckets });
            else setTimeout(bucket, 1000);
          };
          const tick = () => {
            frames++;
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          setTimeout(bucket, 1000);
        }),
    );
    await page.evaluate(() => (window as any).__REGION_PREVIEW.test.setAutoOrbit(null));
    const sorted = [...perf.fpsBuckets].sort((x, y) => x - y);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    const mem = await page.evaluate(() => (performance as any).memory?.usedJSHeapSize ?? null);
    results.previewPerf = {
      fpsBuckets: perf.fpsBuckets,
      median,
      min: sorted[0],
      viewport: { width: 1728, height: 1080 },
      usedJSHeapBytes: mem,
    };
    expect(median, `median fps ${median} (buckets: ${perf.fpsBuckets.join(',')})`).toBeGreaterThanOrEqual(58);
  });
});
