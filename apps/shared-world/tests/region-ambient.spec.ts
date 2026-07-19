import { test, expect, type Page } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { AMBIENT, ambientSurfCpu } from '../src/water/ambientCpu';

/**
 * Checkpoint 05B — ambient ocean surface motion and terrain-boundary
 * interaction (checkpoint prompt §8; launch prompt §11):
 *
 *  1. production state + documented bounds: the ambient CPU-twin field is
 *     nonzero over time, stays within AMBIENT.MAX_HEIGHT_M, varies at a
 *     fixed point, and zeroes exactly when disabled
 *  2. frozen-surface detector: stationary underwater camera looking up for
 *     > 20 s — successive capture deltas strictly positive (temporal
 *     variance of the underside refraction > 0); the same pose with
 *     ambient disabled and the sim cleared is pixel-frozen (the
 *     pre-CP05B comparison state); above-water normals also change
 *  3. deterministic fixed-time captures: frozen clock + cleared sim →
 *     the same frame across settles and across a full page reload
 *  4. hierarchy (addendum §5.2): ambient < terrain-boundary response <
 *     near-surface swimming wake; ambient never enters the sim texture
 *  5. shoreline attenuation continuity (CPU twin): geometric field is
 *     exactly zero at/inside 0.5 m of shore, continuous outward, and the
 *     boundary response decays seaward
 *  6. terrain stays dry with ambient active: crescent-shore and
 *     corridor-islet cameras — surface on/off leaves land pixels
 *     unchanged (no water over land, no new shoreline gaps, islets
 *     correctly masked)
 *  7. stock view boots clean (the pristine reference is untouched;
 *     byte-identity is enforced by scaffold.spec's vendored hash guard)
 *  8. checkpoint-§5.4 evidence captures under media/shared-world-cp05b/
 *     (underside idle series, oblique-over-terrain, swimming wake over
 *     ambient, breach + downward crossing, above-water comparison,
 *     waterline, shoreline idle/swim/re-entry, islets, ambient off/on)
 *  9. fps floor guard with ambient active (the strict §10 gate stays in
 *     region-water.spec test 9 / the acceptance run)
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(HERE, '..');
const REPO_ROOT = resolve(APP_ROOT, '..', '..');
const RESULTS_PATH = join(REPO_ROOT, 'eval', 'shared-world-results.json');
const MEDIA_DIR = join(REPO_ROOT, 'media', 'shared-world-cp05b');

const SPAWN = { x: -180, z: -380 };
/** approved Sketch C corridor islet chain (REGION_SKETCHES § APPROVED). */
const ISLET = { x: 90, z: -80 };

/** Measured-then-fixed deterministic thresholds (report §6): the underside
 *  idle delta measured ≈ 0.010–0.012 mean |Δlum|/px, above-water ≈ 0.010,
 *  ambient-off delta measured 0.000000 — thresholds sit 3× below / above
 *  the measured values, never tuned to pass. */
const MOTION_DELTA_MIN = 0.003;
const FROZEN_DELTA_MAX = 0.0005;
const DETERMINISM_DELTA_MAX = 0.002;

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
        checkpoint: '05B-ambient-ocean-motion',
        generatedAt: new Date().toISOString(),
        region05b: { ...(existing.region05b as object | undefined), ...results },
      },
      null,
      2,
    ) + '\n',
  );
});

// ---------------------------------------------------------------- helpers

async function bootRegion(page: Page): Promise<string[]> {
  const consoleErrors: string[] = [];
  const isFavicon = (s: string) => s.includes('favicon');
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!isFavicon(text)) consoleErrors.push(text);
    }
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));
  await page.goto('/shared-world/?view=region&hud=0');
  await page.waitForFunction(
    () => {
      const h = (window as any).__SHARED_WORLD;
      return !!h && !!h.region && h.state().inWater === true;
    },
    undefined,
    { timeout: 40_000 },
  );
  await page.addStyleTag({ content: '#region-overlay { display: none !important; }' });
  return consoleErrors;
}

const state = (page: Page) => page.evaluate(() => (window as any).__SHARED_WORLD.state());
const testHook = (page: Page, expr: string) =>
  page.evaluate(`(window).__SHARED_WORLD.test.${expr}`);
const regionHook = (page: Page, expr: string) =>
  page.evaluate(`(window).__SHARED_WORLD.region.${expr}`);

interface Decoded {
  width: number;
  height: number;
  data: Uint8Array;
}

function decodePng(path: string): Decoded {
  const png = readFileSync(path);
  expect(png.readUInt32BE(0)).toBe(0x89504e47);
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const colorType = png[25]!;
  const ch = colorType === 2 ? 3 : 4;
  const idat: Buffer[] = [];
  let off = 8;
  while (off < png.length) {
    const len = png.readUInt32BE(off);
    const type = png.toString('ascii', off + 4, off + 8);
    if (type === 'IDAT') idat.push(png.subarray(off + 8, off + 8 + len));
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * ch;
  const out = new Uint8Array(height * stride);
  const paeth = (a: number, b: number, c: number) => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const rowIn = y * (stride + 1) + 1;
    const rowOut = y * stride;
    for (let x = 0; x < stride; x++) {
      const rawV = raw[rowIn + x]!;
      const left = x >= ch ? out[rowOut + x - ch]! : 0;
      const up = y > 0 ? out[rowOut - stride + x]! : 0;
      const ul = y > 0 && x >= ch ? out[rowOut - stride + x - ch]! : 0;
      let v: number;
      switch (filter) {
        case 0: v = rawV; break;
        case 1: v = rawV + left; break;
        case 2: v = rawV + up; break;
        case 3: v = rawV + ((left + up) >> 1); break;
        case 4: v = rawV + paeth(left, up, ul); break;
        default: throw new Error(`PNG filter ${filter}`);
      }
      out[rowOut + x] = v & 0xff;
    }
  }
  if (ch === 4) return { width, height, data: out };
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = out[i * 3]!;
    rgba[i * 4 + 1] = out[i * 3 + 1]!;
    rgba[i * 4 + 2] = out[i * 3 + 2]!;
    rgba[i * 4 + 3] = 255;
  }
  return { width, height, data: rgba };
}

/** mean per-pixel |Δ luminance| between two same-size captures, 0..1 */
function meanAbsDelta(a: Decoded, b: Decoded): number {
  expect(a.width).toBe(b.width);
  expect(a.height).toBe(b.height);
  let s = 0;
  const n = a.width * a.height;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const la = 0.2126 * a.data[o]! + 0.7152 * a.data[o + 1]! + 0.0722 * a.data[o + 2]!;
    const lb = 0.2126 * b.data[o]! + 0.7152 * b.data[o + 1]! + 0.0722 * b.data[o + 2]!;
    s += Math.abs(la - lb);
  }
  return s / n / 255;
}

async function capture(page: Page, name: string): Promise<string> {
  mkdirSync(MEDIA_DIR, { recursive: true });
  const p = join(MEDIA_DIR, name);
  await page.locator('#app canvas').screenshot({ path: p });
  expect(statSync(p).size).toBeGreaterThan(1000);
  return p;
}

/** park the dolphin (and its wake) away from a capture point while keeping
 *  the sim window over it: 70 m behind the camera axis */
async function park(page: Page, x: number, z: number) {
  await testHook(page, `teleport(${x}, ${z}, -6)`);
  await testHook(page, 'setIntent({ brake: true })');
  await page.waitForTimeout(600);
  await testHook(page, 'setIntent(null)');
}

// ------------------------------------------------------------------ tests

test.describe('checkpoint 05B — ambient ocean motion and boundary interaction', () => {
  test('1. production state + documented bounds (CPU-twin field)', async ({ page }) => {
    await bootRegion(page);
    const st0 = (await regionHook(page, 'ambient.state()')) as Record<string, number | boolean>;
    expect(st0.ampScale).toBe(AMBIENT.AMP_SCALE);
    expect(st0.boundaryScale).toBe(AMBIENT.BOUNDARY_SCALE);
    expect(st0.underMul).toBe(AMBIENT.UNDER_MUL);
    expect(st0.frozen).toBe(false);
    await page.waitForTimeout(1100);
    const st1 = (await regionHook(page, 'ambient.state()')) as { timeS: number };
    expect(st1.timeS).toBeGreaterThan(st0.timeS as number);

    const stats = (await page.evaluate(() => {
      const h = (window as any).__SHARED_WORLD;
      const pts: [number, number][] = [];
      for (let x = -100; x <= 100; x += 20)
        for (let z = -460; z <= -300; z += 20)
          if (h.region.world.shoreDistance(x, z) > 25) pts.push([x, z]);
      let maxH = 0;
      let sumSq = 0;
      let n = 0;
      let fixedMin = Infinity;
      let fixedMax = -Infinity;
      for (let t = 0; t < 60; t += 0.4) {
        const rows = h.region.ambient.probe(pts, t);
        for (const r of rows) {
          maxH = Math.max(maxH, Math.abs(r.carrierH));
          sumSq += r.carrierH * r.carrierH;
          n++;
        }
        const f = h.region.ambient.probe([[0, -400]], t)[0];
        fixedMin = Math.min(fixedMin, f.h);
        fixedMax = Math.max(fixedMax, f.h);
      }
      return { pts: pts.length, maxH, rmsH: Math.sqrt(sumSq / n), fixedRange: fixedMax - fixedMin };
    })) as { pts: number; maxH: number; rmsH: number; fixedRange: number };
    // bounded, nonzero, and moving at a fixed point
    expect(stats.maxH).toBeLessThanOrEqual(AMBIENT.MAX_HEIGHT_M);
    expect(stats.maxH).toBeGreaterThan(0.03);
    expect(stats.fixedRange).toBeGreaterThan(0.03);

    // disabled → the additive contribution is exactly zero
    await testHook(page, 'setAmbient({ enabled: false, boundary: false })');
    const off = (await regionHook(page, 'ambient.probe([[0, -400], [-560, -300]], 12.5)')) as {
      h: number; sx: number; sz: number;
    }[];
    for (const r of off) {
      expect(Math.abs(r.h)).toBe(0);
      expect(Math.abs(r.sx)).toBe(0);
      expect(Math.abs(r.sz)).toBe(0);
    }
    await testHook(page, 'setAmbient({ enabled: true, boundary: true })');
    results.field = { ...stats, maxBoundM: AMBIENT.MAX_HEIGHT_M };
  });

  test('2. frozen-surface detector: >20 s underside idle motion; disabled = frozen', async ({ page }) => {
    test.setTimeout(300_000);
    await bootRegion(page);
    await park(page, SPAWN.x - 60, SPAWN.z + 60);
    await testHook(
      page,
      `shotMode({ pos: [${SPAWN.x}, -4, ${SPAWN.z}], look: [${SPAWN.x + 0.001}, 10, ${SPAWN.z}], fov: 80, size: [1365, 768] })`,
    );
    await testHook(page, 'clearSim()');
    await page.waitForTimeout(1500);

    // 8 captures over > 21 s of idle — the checkpoint-§5.4 item-1 evidence
    const paths: string[] = [];
    for (let i = 0; i < 8; i++) {
      paths.push(await capture(page, `underside-idle-t${i * 3}s.png`));
      if (i < 7) await page.waitForTimeout(3000);
    }
    const imgs = paths.map(decodePng);
    const deltas: number[] = [];
    for (let i = 1; i < imgs.length; i++) deltas.push(meanAbsDelta(imgs[i - 1]!, imgs[i]!));
    for (const d of deltas) {
      expect(d, `underside idle delta ${d.toFixed(5)} (all: ${deltas.map((x) => x.toFixed(4)).join(',')})`)
        .toBeGreaterThan(MOTION_DELTA_MIN);
    }

    // ambient disabled + cleared sim = the pre-CP05B frozen rest state
    await testHook(page, 'setAmbient({ enabled: false, boundary: false })');
    await testHook(page, 'clearSim()');
    await page.waitForTimeout(1500);
    const off0 = await capture(page, 'underside-ambient-off-a.png');
    await page.waitForTimeout(3000);
    const off1 = await capture(page, 'underside-ambient-off-b.png');
    const frozenDelta = meanAbsDelta(decodePng(off0), decodePng(off1));
    expect(frozenDelta, `ambient-off delta ${frozenDelta.toFixed(6)}`).toBeLessThan(FROZEN_DELTA_MAX);
    await testHook(page, 'setAmbient({ enabled: true, boundary: true })');

    // above-water normals also change over time
    await testHook(
      page,
      `shotMode({ pos: [${SPAWN.x - 30}, 6, ${SPAWN.z}], look: [${SPAWN.x + 60}, -1, ${SPAWN.z}], fov: 55, size: [1365, 768] })`,
    );
    await testHook(page, 'clearSim()');
    await page.waitForTimeout(1500);
    const a0 = await capture(page, 'above-idle-t0s.png');
    await page.waitForTimeout(2500);
    const a1 = await capture(page, 'above-idle-t2.5s.png');
    await page.waitForTimeout(2500);
    const a2 = await capture(page, 'above-idle-t5s.png');
    const aDeltas = [
      meanAbsDelta(decodePng(a0), decodePng(a1)),
      meanAbsDelta(decodePng(a1), decodePng(a2)),
    ];
    for (const d of aDeltas) expect(d, `above idle delta ${d.toFixed(5)}`).toBeGreaterThan(MOTION_DELTA_MIN);
    await testHook(page, 'shotMode(null)');
    results.frozenSurfaceDetector = {
      undersideDeltas: deltas,
      ambientOffDelta: frozenDelta,
      aboveDeltas: aDeltas,
      idleSpanS: 21,
    };
  });

  test('3. deterministic fixed-time output across settles and reloads', async ({ page }) => {
    test.setTimeout(240_000);
    const setup = async () => {
      await bootRegion(page);
      await park(page, SPAWN.x - 60, SPAWN.z + 60);
      await testHook(
        page,
        `shotMode({ pos: [${SPAWN.x}, -4, ${SPAWN.z}], look: [${SPAWN.x + 0.001}, 10, ${SPAWN.z}], fov: 80, size: [1365, 768] })`,
      );
      await testHook(page, 'setAmbient({ frozen: true, timeS: 137.25 })');
      await testHook(page, 'clearSim()');
      await page.waitForTimeout(1200);
    };
    await setup();
    const p0 = await capture(page, 'determinism-a.png');
    await page.waitForTimeout(1500);
    const p1 = await capture(page, 'determinism-b.png');
    await setup(); // full reload
    const p2 = await capture(page, 'determinism-reload.png');
    const settleDelta = meanAbsDelta(decodePng(p0), decodePng(p1));
    const reloadDelta = meanAbsDelta(decodePng(p0), decodePng(p2));
    expect(settleDelta, `same-session frozen delta ${settleDelta.toFixed(6)}`).toBeLessThan(
      DETERMINISM_DELTA_MAX,
    );
    expect(reloadDelta, `cross-reload frozen delta ${reloadDelta.toFixed(6)}`).toBeLessThan(
      DETERMINISM_DELTA_MAX,
    );
    results.determinism = { settleDelta, reloadDelta, frozenTimeS: 137.25 };
  });

  test('4. hierarchy: ambient < boundary response < near-surface wake', async ({ page }) => {
    test.setTimeout(240_000);
    await bootRegion(page);

    // CPU-twin slope comparison: open water vs the shoreline band (sdf 1–8 m)
    const slopes = (await page.evaluate(() => {
      const h = (window as any).__SHARED_WORLD;
      const open: [number, number][] = [];
      for (let x = -100; x <= 100; x += 20)
        for (let z = -460; z <= -300; z += 20)
          if (h.region.world.shoreDistance(x, z) > 25) open.push([x, z]);
      const band: [number, number][] = [];
      for (let x = -680; x <= -480; x += 6)
        for (let z = -380; z <= -220; z += 6) {
          const sd = h.region.world.shoreDistance(x, z);
          if (sd >= 1 && sd <= 8) band.push([x, z]);
        }
      const rms = (pts: [number, number][]) => {
        let s = 0;
        let n = 0;
        for (let t = 0; t < 30; t += 0.4) {
          for (const r of h.region.ambient.probe(pts, t)) {
            s += r.sx * r.sx + r.sz * r.sz;
            n++;
          }
        }
        return Math.sqrt(s / n);
      };
      return { openRms: rms(open.slice(0, 80)), bandRms: rms(band.slice(0, 80)), bandPts: band.length };
    })) as { openRms: number; bandRms: number; bandPts: number };
    expect(slopes.bandPts).toBeGreaterThan(20);
    expect(
      slopes.bandRms,
      `boundary-band slope RMS ${slopes.bandRms.toFixed(4)} vs open ${slopes.openRms.toFixed(4)}`,
    ).toBeGreaterThan(slopes.openRms * 1.5);

    // ambient never enters the sim texture (additive separation)
    await testHook(page, `teleport(${SPAWN.x}, ${SPAWN.z}, -6)`);
    await testHook(page, 'clearSim()');
    await testHook(page, 'setIntent({ brake: true })');
    await page.waitForTimeout(1500);
    const calm = (await regionHook(page, 'simTexProbe()')) as { maxDispM: number; nanCount: number };
    expect(calm.nanCount).toBe(0);
    expect(calm.maxDispM, `sim texture after clear+idle: ${calm.maxDispM}`).toBeLessThan(0.005);

    // near-surface cruise wake: clearly stronger than the ambient bound
    await testHook(page, `teleport(${SPAWN.x}, ${SPAWN.z}, -1.2)`);
    await testHook(page, `setYaw(${Math.PI / 2})`);
    await testHook(page, 'setIntent({ kicks: 1, kickRate: 1.6, kickAmp: 0.7 })');
    await page.waitForTimeout(6000);
    let wakeMax = 0;
    for (let i = 0; i < 5; i++) {
      const p = (await regionHook(page, 'simTexProbe()')) as { maxDispM: number };
      wakeMax = Math.max(wakeMax, p.maxDispM);
      await page.waitForTimeout(400);
    }
    await testHook(page, 'setIntent(null)');
    // gate: the local cruise wake must clear the ENTIRE ambient bound with
    // headroom. Measured (gain 0.09): 0.111 m on the authoritative
    // acceptance tier (~120 Hz built-in), ≈ 1 m on the 60 Hz dev tier
    // (frame-driven vendored sim — fewer, larger injections; reported).
    // 1.2× sits 32 % under the acceptance-tier measurement.
    expect(
      wakeMax,
      `near-surface cruise wake ${wakeMax.toFixed(3)} m vs ambient bound ${AMBIENT.MAX_HEIGHT_M} m`,
    ).toBeGreaterThan(AMBIENT.MAX_HEIGHT_M * 1.2);

    results.hierarchy = {
      ambientMaxHeightM: AMBIENT.MAX_HEIGHT_M,
      openSlopeRms: slopes.openRms,
      boundaryBandSlopeRms: slopes.bandRms,
      nearSurfaceCruiseWakeM: wakeMax,
      simTexAfterClearM: calm.maxDispM,
      note:
        'wake is depth-dependent by the vendored sphere kernel: near-surface swimming ' +
        'dominates ambient; deep swimming leaves the ambient surface (physical, reported)',
    };
  });

  test('5. shoreline attenuation continuity (CPU twin sweep)', () => {
    // geometric field vs synthetic sdf at a fixed point/time — continuity
    // and the exact zero inside 0.5 m (no crest can reach dry land)
    let prev: number | null = null;
    for (let sdf = -2; sdf <= 12; sdf += 0.02) {
      const r = ambientSurfCpu(-40, -400, 17.3, sdf, 1, 0);
      if (sdf <= 0.5) expect(Math.abs(r.h), `h at sdf ${sdf.toFixed(2)}`).toBe(0);
      if (prev !== null) {
        expect(Math.abs(r.h - prev), `Δh at sdf ${sdf.toFixed(2)}`).toBeLessThan(0.002);
      }
      prev = r.h;
    }
    // boundary response decays seaward (envelope comparison)
    const near = Math.abs(ambientSurfCpu(-40, -400, 17.3, 2, 1, 0).boundaryMag);
    const far = Math.abs(ambientSurfCpu(-40, -400, 17.3, 40, 1, 0).boundaryMag);
    expect(near).toBeGreaterThan(far);
    results.shorelineAttenuation = { sweep: 'sdf −2…12 m @ 0.02 m, Δh < 2 mm', nearMag: near, farMag: far };
  });

  test('6. terrain stays dry with ambient active: crescent shore + corridor islets', async ({ page }) => {
    test.setTimeout(300_000);
    await bootRegion(page);
    // ambient GEOMETRY stays present (displaced surface at a fixed phase);
    // only the clock is frozen so the on/off pair compares identical water
    // (the same paired-capture instrument condition as region-terrain
    // test 2 / region-water test 6 — motion itself is proven by test 2)
    await testHook(page, 'setAmbient({ frozen: true, timeS: 137.25 })');

    const checkDry = async (
      name: string,
      cam: { pos: [number, number, number]; look: [number, number, number] },
      scan: { x0: number; x1: number; z0: number; z1: number },
      minLand: number,
    ) => {
      await park(page, cam.pos[0] + 60, cam.pos[2] + 40);
      await testHook(
        page,
        `shotMode({ pos: [${cam.pos.join(',')}], look: [${cam.look.join(',')}], fov: 55, size: [1365, 768] })`,
      );
      await page.waitForTimeout(2000);
      const pts = (await page.evaluate((s) => {
        const h = (window as any).__SHARED_WORLD;
        const land: [number, number, number][] = [];
        const waterPts: [number, number, number][] = [];
        for (let x = s.x0; x <= s.x1; x += 1.5) {
          for (let z = s.z0; z <= s.z1; z += 1.5) {
            const sd = h.region.world.shoreDistance(x, z);
            const th = h.region.world.terrainHeight(x, z);
            // near-shore land band (the shoreline-gap surface, cp04B law)
            if (sd <= -1.0 && sd >= -15 && th >= 0.2 && land.length < 900) land.push([x, th + 0.05, z]);
            else if (sd >= 3 && sd <= 25 && waterPts.length < 200) waterPts.push([x, 0, z]);
          }
        }
        return {
          landPx: h.test.projectPoints(land),
          waterPx: h.test.projectPoints(waterPts),
        };
      }, scan)) as {
        landPx: { px: number; py: number; inFront: boolean }[];
        waterPx: { px: number; py: number; inFront: boolean }[];
      };
      const inFrame = (p: { px: number; py: number; inFront: boolean }) =>
        p.inFront && p.px > 8 && p.px < 1357 && p.py > 8 && p.py < 760;
      const landPx = pts.landPx.filter(inFrame).slice(0, 600);
      const waterPx = pts.waterPx.filter(inFrame).slice(0, 60);
      expect(landPx.length, `${name}: land samples ${landPx.length}`).toBeGreaterThanOrEqual(minLand);
      expect(waterPx.length, `${name}: water controls`).toBeGreaterThanOrEqual(10);

      const onPath = await capture(page, `${name}-surface-on.png`);
      await testHook(page, 'setSurfaceVisible(false)');
      await page.waitForTimeout(400);
      const offPath = await capture(page, `${name}-surface-off.png`);
      await testHook(page, 'setSurfaceVisible(true)');
      const on = decodePng(onPath);
      const off = decodePng(offPath);
      const maxChannelDelta = (px: number, py: number) => {
        const o = (Math.round(py) * on.width + Math.round(px)) * 4;
        let m = 0;
        for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(on.data[o + c]! - off.data[o + c]!));
        return m;
      };
      // cp05A instrument law (recorded forensics: single-pixel compares
      // flag MSAA silhouette / crest-adjacency pixels that show LEGAL
      // water behind a land crest): a violation must hold on the 3×3
      // MEDIAN around the sample — real water-over-land lights a
      // contiguous patch, an edge artifact lights isolated pixels.
      const medianDelta = (px: number, py: number) => {
        const ds: number[] = [];
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) ds.push(maxChannelDelta(px + dx, py + dy));
        ds.sort((a, b) => a - b);
        return ds[4]!;
      };
      let landViolations = 0;
      const forensics: { px: number; py: number }[] = [];
      for (const p of landPx) {
        if (medianDelta(p.px, p.py) > 4) {
          landViolations++;
          if (forensics.length < 10) forensics.push({ px: p.px, py: p.py });
        }
      }
      let waterChanged = 0;
      for (const p of waterPx) if (maxChannelDelta(p.px, p.py) > 10) waterChanged++;
      expect(
        landViolations,
        `${name}: water-surface 3×3 patches over land (forensics ${JSON.stringify(forensics)})`,
      ).toBe(0);
      expect(waterChanged, `${name}: positive control`).toBeGreaterThanOrEqual(5);
      return { landSamples: landPx.length, landViolations, waterControls: waterPx.length, waterChanged };
    };

    results.dryLandShore = await checkDry(
      'shore-crescent',
      { pos: [-470, 80, -300], look: [-580, 0, -300] },
      { x0: -660, x1: -500, z0: -380, z1: -220 },
      400,
    );
    // Islet camera is near-overhead: at grazing angles the low islet
    // silhouettes produce crest-adjacency pixels (a land sample's rounded
    // pixel legitimately shows water BEHIND the crest) — measured 9
    // violations at a 20° view WITH AMBIENT FULLY DISABLED, i.e. a
    // pre-existing cp05-era view-geometry property, not a cp05B effect
    // (forensics in the report). The steep view keeps the land-pixel
    // instrument sound with an absolute zero gate.
    results.dryLandIslets = await checkDry(
      'islet-chain',
      { pos: [ISLET.x - 15, 160, ISLET.z + 35], look: [ISLET.x, 0, ISLET.z] },
      { x0: 20, x1: 200, z0: -130, z1: -40 },
      60,
    );
    await testHook(page, 'shotMode(null)');
  });

  test('7. stock view boots clean (pristine reference untouched)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(String(err)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const loc = msg.location();
        const text = `${msg.text()}${loc.url ? ` [${loc.url}]` : ''}`;
        if (!text.includes('favicon')) errors.push(text);
      }
    });
    await page.goto('/shared-world/?view=stock');
    await page.waitForSelector('#loading', { state: 'hidden', timeout: 30_000 });
    await page.waitForTimeout(1500);
    expect(errors, errors.join(' | ')).toEqual([]);
    await capture(page, 'stock-reference.png');
    results.stockBoot = { errors: errors.length };
  });

  test('8. checkpoint §5.4 evidence captures', async ({ page }) => {
    test.setTimeout(420_000);
    await bootRegion(page);

    // (2) stationary underwater oblique view: surface distortion over terrain
    await park(page, -480, -300);
    await testHook(
      page,
      'shotMode({ pos: [-520, -8, -300], look: [-600, -1, -300], fov: 65, size: [1365, 768] })',
    );
    await testHook(page, 'clearSim()');
    await page.waitForTimeout(1500);
    await capture(page, 'underwater-oblique-terrain-a.png');
    await page.waitForTimeout(3000);
    await capture(page, 'underwater-oblique-terrain-b.png');

    // (6) half-submerged waterline pair (the cp02 anti-shimmer offsets)
    for (const [tag, y] of [
      ['above-lip', 0.35],
      ['below-lip', -0.35],
    ] as const) {
      await testHook(
        page,
        `shotMode({ pos: [${SPAWN.x - 20}, ${y}, ${SPAWN.z}], look: [${SPAWN.x + 60}, ${y - 0.6}, ${SPAWN.z}], fov: 55, size: [1365, 768] })`,
      );
      await page.waitForTimeout(1500);
      await capture(page, `waterline-${tag}.png`);
    }

    // (5) above-water stock-like comparison (region side; stock side is
    // stock-reference.png from test 7)
    await testHook(
      page,
      `shotMode({ pos: [${SPAWN.x - 30}, 8, ${SPAWN.z}], look: [${SPAWN.x + 60}, -2, ${SPAWN.z}], fov: 45, size: [1365, 768] })`,
    );
    await page.waitForTimeout(1500);
    await capture(page, 'above-water-comparison.png');

    // (7) idle shoreline and steep-shore contact, with motion series
    await park(page, -440, -300);
    await testHook(
      page,
      'shotMode({ pos: [-500, 6, -300], look: [-585, 0, -300], fov: 50, size: [1365, 768] })',
    );
    await testHook(page, 'clearSim()');
    await page.waitForTimeout(1500);
    await capture(page, 'shoreline-idle-a.png');
    await page.waitForTimeout(2500);
    await capture(page, 'shoreline-idle-b.png');
    await page.waitForTimeout(2500);
    await capture(page, 'shoreline-idle-c.png');
    // steep NE-island rocky shore (Sketch C)
    await park(page, 420, -520);
    await testHook(
      page,
      'shotMode({ pos: [420, 8, -560], look: [480, 0, -560], fov: 50, size: [1365, 768] })',
    );
    await page.waitForTimeout(1500);
    await capture(page, 'shoreline-steep-a.png');
    await page.waitForTimeout(3000);
    await capture(page, 'shoreline-steep-b.png');

    // rocky corridor islets, oblique review view (evidence only — the
    // gated land-pixel check runs at the overhead camera in test 6)
    await park(page, ISLET.x, ISLET.z + 40);
    await testHook(
      page,
      `shotMode({ pos: [${ISLET.x - 60}, 30, ${ISLET.z + 40}], look: [${ISLET.x}, 0, ${ISLET.z}], fov: 55, size: [1365, 768] })`,
    );
    await page.waitForTimeout(1500);
    await capture(page, 'islets-oblique-a.png');
    await page.waitForTimeout(3000);
    await capture(page, 'islets-oblique-b.png');

    // (3) dolphin swimming beneath the surface — wake over ambient baseline
    await testHook(page, 'shotMode(null)');
    await testHook(page, `teleport(${SPAWN.x}, ${SPAWN.z}, -1.2)`);
    await testHook(page, `setYaw(${Math.PI / 2})`);
    await testHook(page, 'setIntent({ kicks: 1, kickRate: 1.6, kickAmp: 0.7 })');
    await page.waitForTimeout(4000);
    await capture(page, 'swimming-wake-over-ambient.png');
    // (8a) the same shoreline boundary while swimming toward it
    await testHook(page, `teleport(-520, -300, -1.2)`);
    await testHook(page, `setYaw(${-Math.PI / 2})`);
    await page.waitForTimeout(2500);
    await capture(page, 'shoreline-during-swim.png');
    await testHook(page, 'setIntent(null)');

    // (4)+(8b) breach: exit, downward crossing, re-entry decay
    await testHook(page, `teleport(${SPAWN.x}, ${SPAWN.z}, -8)`);
    await testHook(page, `setYaw(${Math.PI / 2})`);
    await testHook(page, 'setIntent({ burst: true, pitch: -0.9 })');
    const t0 = Date.now();
    let sawAir = false;
    while (Date.now() - t0 < 20_000) {
      const s = (await state(page)) as { phase: string };
      if (s.phase === 'air') {
        sawAir = true;
        break;
      }
      await page.waitForTimeout(100);
    }
    expect(sawAir, 'breach reached the airborne phase').toBe(true);
    await capture(page, 'breach-airborne.png');
    await testHook(page, 'setIntent(null)');
    const t1 = Date.now();
    while (Date.now() - t1 < 10_000) {
      const s = (await state(page)) as { phase: string };
      if (s.phase === 'swim') break;
      await page.waitForTimeout(80);
    }
    await capture(page, 'reentry-crossing-down.png');
    await page.waitForTimeout(1500);
    await capture(page, 'reentry-disturbance.png');
    await page.waitForTimeout(6000);
    await capture(page, 'reentry-decay-to-ambient.png');

    // (9)/(10) ambient disabled vs enabled, same pose
    await park(page, SPAWN.x - 60, SPAWN.z + 60);
    await testHook(
      page,
      `shotMode({ pos: [${SPAWN.x}, -4, ${SPAWN.z}], look: [${SPAWN.x + 0.001}, 10, ${SPAWN.z}], fov: 80, size: [1365, 768] })`,
    );
    await testHook(page, 'setAmbient({ enabled: false, boundary: false })');
    await testHook(page, 'clearSim()');
    await page.waitForTimeout(1500);
    await capture(page, 'ambient-disabled.png');
    await testHook(page, 'setAmbient({ enabled: true, boundary: true })');
    await page.waitForTimeout(1500);
    await capture(page, 'ambient-enabled.png');
    await testHook(page, 'shotMode(null)');

    results.evidence = { dir: 'media/shared-world-cp05b/', breachReached: sawAir };
  });

  test('9. fps floor guard with ambient active', async ({ page }) => {
    test.setTimeout(180_000);
    await bootRegion(page);
    await testHook(page, `teleport(${SPAWN.x}, ${SPAWN.z}, -2.5)`);
    await testHook(page, 'setIntent({ kicks: 1, kickRate: 1.6, kickAmp: 0.7 })');
    const buckets = (await page.evaluate(
      (n) =>
        new Promise<number[]>((done) => {
          const out: number[] = [];
          let frames = 0;
          const bucket = () => {
            out.push(frames);
            frames = 0;
            if (out.length >= n) done(out);
            else setTimeout(bucket, 1000);
          };
          const tick = () => {
            frames++;
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          setTimeout(bucket, 1000);
        }),
      10,
    )) as number[];
    await testHook(page, 'setIntent(null)');
    for (const b of buckets) {
      expect(b, `fps bucket ${b} (all: ${buckets.join(',')})`).toBeGreaterThanOrEqual(45);
    }
    const st = (await state(page)) as { simHz: number };
    expect(st.simHz).toBeGreaterThan(100);
    results.fpsGuard = { buckets, simHz: st.simHz };
  });
});
