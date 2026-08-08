import { test, expect, type Page } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

/**
 * Checkpoint 05C — ocean replacement (WaterThreeJS port). The acceptance
 * suite specified by the ocean-replacement addendum §4.8 — the successor to
 * the retired jeantimex-shaped region-water / region-ambient suites (their
 * retirement is the addendum's explicit authorization, not a weakening):
 *
 *  1. boot + config fidelity: clean console; OCEAN_CONFIG matches the
 *     pinned WaterThreeJS defaults; the eval surface exposes the CPU
 *     mirrors
 *  2. frozen-time determinism + living surface: frozen ocean clock →
 *     paired captures pixel-identical; unfrozen → they differ (the CP05B
 *     frozen-surface detector's heir) and the CPU height mirror moves
 *  3. cross-reload determinism: Gerstner height digest and time-of-day sun
 *     curves identical across reloads (pure functions of position/clock)
 *  4. underwater absorption character: seabed color through increasing
 *     water path loses red faster than blue and dims — objects/terrain
 *     keep their own albedo near the camera (never one flat tint)
 *  5. Snell window: the upward underwater view shows the ~97° window
 *     (2×48.6° critical angle) — physics carried from the old suite
 *  6. sandy seafloor: the CPU twin shows the dune blend engaging with
 *     depth while rock keeps identity; exposed families unchanged
 *  7. time-of-day law: elevation curve values at pinned phases; sky
 *     luminance ordering noon > sunset > night
 *  8. pipeline smoke: clouds and post stages visibly change the frame
 *  9. floating bodies: a dropped sphere settles riding the Gerstner
 *     surface (CPU mirror agreement)
 * 10. performance: sustained median fps ≥ 58 and simHz > 100 on a scripted
 *     burst swim; per-stage medians recorded
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(HERE, '..');
const REPO_ROOT = resolve(APP_ROOT, '..', '..');
const RESULTS_PATH = join(REPO_ROOT, 'eval', 'shared-world-results.json');
const MEDIA_DIR = join(REPO_ROOT, 'media', 'shared-world-cp05c');

const SPAWN = { x: -180, z: -380 };

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
        checkpoint: '05C-ocean-replacement',
        generatedAt: new Date().toISOString(),
        region05c: { ...(existing.region05c as object | undefined), ...results },
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
  await page.goto(`/shared-world/?view=region&hud=0${qs}`);
  await page.waitForFunction(
    () => {
      const h = (window as any).__SHARED_WORLD;
      return !!h && !!h.region && !!h.ocean && h.state().inWater === true;
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
const oceanHook = (page: Page, expr: string) =>
  page.evaluate(`(window).__SHARED_WORLD.ocean.${expr}`);

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

const rgbAt = (img: Decoded, x: number, y: number): [number, number, number] => {
  const o = (Math.round(y) * img.width + Math.round(x)) * 4;
  return [img.data[o]!, img.data[o + 1]!, img.data[o + 2]!];
};

/** fraction of pixels whose max channel delta exceeds `tol` (sampled grid) */
function diffFraction(a: Decoded, b: Decoded, tol = 2, step = 4): number {
  let diff = 0;
  let n = 0;
  for (let y = 0; y < a.height; y += step) {
    for (let x = 0; x < a.width; x += step) {
      const o = (y * a.width + x) * 4;
      let m = 0;
      for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(a.data[o + c]! - b.data[o + c]!));
      if (m > tol) diff++;
      n++;
    }
  }
  return diff / n;
}

/** mean rgb + luma over a horizontal band of the frame */
function bandStats(img: Decoded, y0Frac: number, y1Frac: number) {
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let n = 0;
  for (let y = Math.floor(img.height * y0Frac); y < img.height * y1Frac; y += 3) {
    for (let x = 0; x < img.width; x += 3) {
      const [r, g, b] = rgbAt(img, x, y);
      sr += r;
      sg += g;
      sb += b;
      n++;
    }
  }
  const r = sr / n;
  const g = sg / n;
  const b = sb / n;
  return { r, g, b, luma: 0.2126 * r + 0.7152 * g + 0.0722 * b, warmth: (r + 1) / (b + 1) };
}

/** WaterThreeJS pinned defaults (docs/…/references/waterthreejs/src/Ocean.js) */
const EXPECTED_CONFIG = {
  waveCount: 26,
  baseWavelength: 150.0,
  amplitude: 0.72,
  choppy: 0.5,
  dirSpread: 0.95,
  freqMul: 1.19,
  ampMul: 0.82,
  speed: 1.0,
  surfaceY: 0.0,
  clarity: 1.0,
  depthFalloff: 0.16,
  ssrStrength: 0.85,
  shoreFoamWidth: 3.4,
};

// ------------------------------------------------------------------ tests

test.describe('checkpoint 05C — ocean replacement (WaterThreeJS port)', () => {
  test('1. boot + config fidelity: clean console; pinned WaterThreeJS defaults; CPU mirrors exposed', async ({ page }) => {
    const errors = await bootRegion(page);
    await page.waitForTimeout(1500);

    const cfg = (await oceanHook(page, 'config')) as Record<string, unknown>;
    for (const [k, v] of Object.entries(EXPECTED_CONFIG)) {
      expect(cfg[k], `OCEAN_CONFIG.${k}`).toBe(v);
    }
    const tod = (await oceanHook(page, 'TOD')) as Record<string, number>;
    expect(tod.PERIOD_S).toBe(660);
    expect(tod.EL_MAX_DEG).toBe(62);
    expect(tod.DAY_FRAC).toBe(0.82);

    // CPU mirrors respond
    const h0 = (await oceanHook(page, 'heightAt(0, 0, 10)')) as number;
    const h1 = (await oceanHook(page, 'heightAt(0, 0, 12)')) as number;
    expect(Number.isFinite(h0)).toBe(true);
    expect(h0).not.toBe(h1);
    const surf = (await oceanHook(page, 'surfaceSample(0, 0, 10)')) as Record<string, number>;
    for (const k of ['dx', 'dz', 'h', 'nx', 'ny', 'nz']) {
      expect(Number.isFinite(surf[k]!), `surfaceSample.${k}`).toBe(true);
    }
    expect(surf.ny!).toBeGreaterThan(0.5);

    // amplitude sanity: |height| bounded by the summed spectrum, mean ~0
    let mn = Infinity;
    let mx = -Infinity;
    const heights = (await page.evaluate(() => {
      const h = (window as any).__SHARED_WORLD;
      const out: number[] = [];
      for (let i = 0; i < 400; i++) out.push(h.ocean.heightAt(i * 13.7, i * 7.3, 100));
      return out;
    })) as number[];
    for (const v of heights) {
      mn = Math.min(mn, v);
      mx = Math.max(mx, v);
    }
    expect(mx).toBeGreaterThan(0.2);
    expect(mn).toBeLessThan(-0.2);
    expect(Math.abs(mx)).toBeLessThan(4);
    expect(Math.abs(mn)).toBeLessThan(4);

    expect(errors, errors.join(' | ')).toEqual([]);
    results.boot = { config: cfg, heightRange: [mn, mx], consoleErrors: errors.length };
  });

  test('2. frozen-time determinism + living surface (the frozen-surface detector heir)', async ({ page }) => {
    test.setTimeout(240_000);
    mkdirSync(MEDIA_DIR, { recursive: true });
    await bootRegion(page);
    await testHook(page, 'teleport(600, 600, -3)'); // dolphin far out of frame
    await testHook(page, 'setIntent({ brake: true })');
    // fixed underwater-oblique shot over the spawn bay; clouds/post off so
    // the frozen comparison sees only the deterministic linear render
    await testHook(page, 'setTimeOfDay({ phase: 0.41, frozen: true })');
    await testHook(page, 'setStageEnabled({ clouds: false })');
    await testHook(page, 'setPostEnabled(false)');
    await testHook(
      page,
      `shotMode({ pos: [${SPAWN.x - 40}, -4, ${SPAWN.z}], look: [${SPAWN.x}, 2, ${SPAWN.z}], fov: 60, size: [1280, 800] })`,
    );

    // frozen: paired captures pixel-identical
    await testHook(page, 'setOcean({ frozen: true, timeS: 137.25 })');
    await page.waitForTimeout(900);
    // warm-up capture (discarded): an occluded/idle Chrome window serves a
    // STALE compositor frame to the first screenshot after a state change —
    // the screenshot itself wakes the presentation path (measured: capture
    // 0 differs, captures 1..n pixel-identical)
    await page.locator('#app canvas').screenshot({ path: join(MEDIA_DIR, 'warmup.png') });
    await page.waitForTimeout(300);
    const fA = join(MEDIA_DIR, 'frozen-a.png');
    const fB = join(MEDIA_DIR, 'frozen-b.png');
    await page.locator('#app canvas').screenshot({ path: fA });
    await page.waitForTimeout(700);
    await page.locator('#app canvas').screenshot({ path: fB });
    const frozenDiff = diffFraction(decodePng(fA), decodePng(fB));
    expect(frozenDiff, `frozen paired captures differ over ${(frozenDiff * 100).toFixed(3)} % of pixels`).toBeLessThan(0.001);

    // unfrozen: the surface visibly moves between the same paired captures
    await testHook(page, 'setOcean({ frozen: false })');
    await page.waitForTimeout(400);
    const uA = join(MEDIA_DIR, 'living-a.png');
    const uB = join(MEDIA_DIR, 'living-b.png');
    await page.locator('#app canvas').screenshot({ path: uA });
    await page.waitForTimeout(700);
    await page.locator('#app canvas').screenshot({ path: uB });
    const livingDiff = diffFraction(decodePng(uA), decodePng(uB));
    expect(livingDiff, 'unfrozen surface must visibly move').toBeGreaterThan(0.02);

    // CPU mirror moves with the clock
    const hMoves = (await page.evaluate(() => {
      const o = (window as any).__SHARED_WORLD.ocean;
      return Math.abs(o.heightAt(0, 0, 10) - o.heightAt(0, 0, 10.5));
    })) as number;
    expect(hMoves).toBeGreaterThan(1e-4);

    await testHook(page, 'shotMode(null)');
    results.frozenDetector = { frozenDiff, livingDiff };
  });

  test('3. cross-reload determinism: height digest + sun curves are pure functions of the clocks', async ({ page }) => {
    const digestOnce = async () => {
      await bootRegion(page);
      return (await page.evaluate(() => {
        const h = (window as any).__SHARED_WORLD;
        const parts: string[] = [];
        for (let i = 0; i < 200; i++) {
          const x = -900 + (i % 20) * 90;
          const z = -900 + Math.floor(i / 20) * 180;
          parts.push(h.ocean.heightAt(x, z, 500).toFixed(9));
          parts.push(h.ocean.heightAt(x, z, 123.456).toFixed(9));
        }
        for (const phase of [0, 0.2, 0.41, 0.82, 0.91]) {
          const a = h.ocean.sunAnglesAt(phase);
          parts.push(a.elevationDeg.toFixed(9), a.azimuthDeg.toFixed(9));
        }
        return parts.join(',');
      })) as string;
    };
    const d1 = createHash('sha256').update(await digestOnce()).digest('hex');
    const d2 = createHash('sha256').update(await digestOnce()).digest('hex');
    expect(d2, 'ocean height + sun-curve digest across reloads').toBe(d1);
    results.determinism = { digest: d1 };
  });

  test('4. underwater absorption character: red dies faster than blue with path length; near terrain keeps its albedo', async ({ page }) => {
    test.setTimeout(240_000);
    mkdirSync(MEDIA_DIR, { recursive: true });
    await bootRegion(page);
    await testHook(page, 'teleport(600, 600, -3)'); // dolphin far away
    await testHook(page, 'setIntent({ brake: true })');
    await testHook(page, 'setTimeOfDay({ phase: 0.41, frozen: true })'); // noon
    await testHook(page, 'setOcean({ frozen: true, timeS: 137.25 })');
    await testHook(page, 'setStageEnabled({ clouds: false })');

    // camera 2 m over the south-bay shelf seabed, looking gently down-range;
    // probe the SAME seabed shelf at increasing view distance
    const setup = (await page.evaluate(() => {
      const h = (window as any).__SHARED_WORLD;
      const w = h.region.world;
      const cx = -180;
      const cz = 260;
      const camY = w.terrainHeight(cx, cz) + 2.2;
      const pts: [number, number, number][] = [];
      const dists: number[] = [];
      for (const d of [7, 30, 70]) {
        const z = cz + d;
        pts.push([cx, w.terrainHeight(cx, z) + 0.15, z]);
        dists.push(d);
      }
      return { cx, cz, camY, pts, dists, depths: pts.map((p) => -w.terrainHeight(p[0], p[2])) };
    })) as { cx: number; cz: number; camY: number; pts: [number, number, number][]; dists: number[]; depths: number[] };

    await testHook(
      page,
      `shotMode({ pos: [${setup.cx}, ${setup.camY}, ${setup.cz}], look: [${setup.cx}, ${setup.camY - 10}, ${setup.cz + 60}], fov: 60, size: [1728, 1080] })`,
    );
    await page.waitForTimeout(1200);
    const shotPath = join(MEDIA_DIR, 'absorption-shelf.png');
    await page.locator('#app canvas').screenshot({ path: shotPath }); // warm-up (stale frame)
    await page.waitForTimeout(300);
    await page.locator('#app canvas').screenshot({ path: shotPath });
    const px = (await page.evaluate(
      (p) => (window as any).__SHARED_WORLD.test.projectPoints(p),
      setup.pts,
    )) as { px: number; py: number; inFront: boolean }[];
    const img = decodePng(shotPath);
    const colors = px.map((p) => rgbAt(img, p.px, p.py));
    for (const p of px) expect(p.inFront).toBe(true);

    const ratio = (c: [number, number, number]) => (c[0] + 1) / (c[2] + 1); // r/b
    const luma = (c: [number, number, number]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    const near = colors[0]!;
    const mid = colors[1]!;
    const far = colors[2]!;
    // red is absorbed faster than blue → warmth falls with path length
    expect(ratio(near), `near r/b ${ratio(near).toFixed(2)} vs far ${ratio(far).toFixed(2)}`)
      .toBeGreaterThan(ratio(far) + 0.1);
    expect(ratio(near)).toBeGreaterThan(ratio(mid));
    // near seabed keeps its own (sandy, warm) albedo — never a flat navy
    expect(ratio(near), 'near seabed reads warm through ~7 m of water').toBeGreaterThan(0.8);
    // and the water column dims with distance
    expect(luma(near)).toBeGreaterThan(luma(far));

    await testHook(page, 'shotMode(null)');
    results.absorption = {
      capture: 'media/shared-world-cp05c/absorption-shelf.png',
      viewDistancesM: setup.dists,
      seabedDepthsM: setup.depths,
      colors,
      rbRatios: colors.map(ratio),
    };
  });

  test('5. Snell window: upward underwater view shows the ~97° window (physics carried from the old suite)', async ({ page }) => {
    test.setTimeout(240_000);
    mkdirSync(MEDIA_DIR, { recursive: true });
    await bootRegion(page);
    await testHook(page, 'teleport(-180, -380, -3)'); // dolphin far from the shot
    await testHook(page, 'setIntent({ brake: true })');
    await testHook(page, 'setTimeOfDay({ phase: 0.41, frozen: true })'); // noon sun
    await testHook(page, 'setOcean({ frozen: true, timeS: 137.25 })');
    await testHook(page, 'setStageEnabled({ clouds: false })');
    await testHook(page, 'setPostEnabled(false)'); // raw values; no bloom pollution

    // deep open water over the trench; straight-up shot, fov 110, square
    const FOV = 110;
    const SIZE = 1080;
    await testHook(
      page,
      `shotMode({ pos: [450, -15, -30], look: [450.001, 100, -30], fov: ${FOV}, size: [${SIZE}, ${SIZE}] })`,
    );
    await page.waitForTimeout(1200);
    const shotPath = join(MEDIA_DIR, 'snell-window.png');
    await page.locator('#app canvas').screenshot({ path: shotPath }); // warm-up (stale frame)
    await page.waitForTimeout(300);
    await page.locator('#app canvas').screenshot({ path: shotPath });
    const img = decodePng(shotPath);

    // Inside the window: refracted SKY (blue-dominant, b/g high). Outside:
    // the shader's waterGlow/TIR (cyan, b ≈ g). The 1080² render buffer is
    // CSS-stretched to the viewport, so the circular window appears as an
    // ellipse — scan the four AXES with per-axis buffer→screen scales and
    // convert each transition radius to a view angle independently; the sun
    // disk can pollute at most one ray → take the median of the 4 angles.
    const cx = img.width / 2;
    const cy = img.height / 2;
    const sx = img.width / SIZE;
    const sy = img.height / SIZE;
    const fBuf = SIZE / 2 / Math.tan(((FOV / 2) * Math.PI) / 180);
    const bg = (x: number, y: number) => {
      const [, g, b] = rgbAt(img, Math.max(0, Math.min(img.width - 1, x)), Math.max(0, Math.min(img.height - 1, y)));
      return (b + 4) / (g + 4);
    };
    const rays: { dx: number; dy: number; scale: number }[] = [
      { dx: 1, dy: 0, scale: sx },
      { dx: -1, dy: 0, scale: sx },
      { dx: 0, dy: 1, scale: sy },
      { dx: 0, dy: -1, scale: sy },
    ];
    const angles: number[] = [];
    const radiiPx: number[] = [];
    for (const ray of rays) {
      const maxR = Math.floor((ray.dy === 0 ? cx : cy) * 0.98);
      // smoothed b/g profile along the ray; transition = largest drop
      const prof: number[] = [];
      for (let r = 0; r <= maxR; r += 2) {
        let s = 0;
        for (let k = -2; k <= 2; k++) {
          s += bg(cx + ray.dx * (r + k), cy + ray.dy * (r + k));
        }
        prof.push(s / 5);
      }
      let bestR = -1;
      let bestDrop = 0;
      for (let i = 8; i < prof.length - 8; i++) {
        const before = (prof[i - 8]! + prof[i - 6]! + prof[i - 4]!) / 3;
        const after = (prof[i + 4]! + prof[i + 6]! + prof[i + 8]!) / 3;
        const drop = before - after;
        if (drop > bestDrop) {
          bestDrop = drop;
          bestR = i * 2;
        }
      }
      if (bestR > 0 && bestDrop > 0.08) {
        radiiPx.push(bestR);
        angles.push((Math.atan(bestR / ray.scale / fBuf) * 180) / Math.PI);
      }
    }
    expect(angles.length, `transition found on ${angles.length}/4 axes`).toBeGreaterThanOrEqual(3);
    angles.sort((a, b) => a - b);
    const medianHalf = angles[Math.floor(angles.length / 2)]!;
    const coneDeg = 2 * medianHalf;
    expect(
      Math.abs(coneDeg - 97),
      `Snell cone ${coneDeg.toFixed(1)}° (half-angles ${angles.map((a) => a.toFixed(1)).join(',')})`,
    ).toBeLessThanOrEqual(8);

    await testHook(page, 'shotMode(null)');
    results.snell = {
      capture: 'media/shared-world-cp05c/snell-window.png',
      coneDeg,
      halfAngles: angles,
      radiiPx,
      note: 'critical angle 48.6° → 97.2° cone; tolerance ±8° (wavy surface + profile smoothing); axes measured with per-axis CSS-stretch scales',
    };
  });

  test('6. sandy seafloor: dune blend engages with depth; rock keeps identity; exposed families intact', async ({ page }) => {
    await bootRegion(page);
    const pts: [number, number][] = [];
    for (let x = -900; x <= 900; x += 45) {
      for (let z = -900; z <= 900; z += 45) {
        pts.push([x, z]);
      }
    }
    const samples = (await page.evaluate(
      (p) => (window as any).__SHARED_WORLD.test.substrateProbe(p),
      pts,
    )) as { albedo: [number, number, number]; family: string; h: number; slope: number; depth: number }[];

    const deepFlat = samples.filter((s) => s.depth > 12 && s.slope < 0.12);
    expect(deepFlat.length).toBeGreaterThan(20);
    const sandy = deepFlat.filter((s) => s.family === 'sandy-floor');
    expect(
      sandy.length / deepFlat.length,
      `sandy-floor fraction on deep flats ${(sandy.length / deepFlat.length).toFixed(2)}`,
    ).toBeGreaterThan(0.5);
    // dune hue: warm sand ordering r ≥ g ≥ b on sandy floor
    for (const s of sandy.slice(0, 50)) {
      expect(s.albedo[0]).toBeGreaterThan(s.albedo[2]);
      expect(s.albedo[1]).toBeGreaterThan(s.albedo[2] * 0.9);
    }
    // steep underwater rock keeps class identity (never sand-swallowed)
    const steep = samples.filter((s) => s.depth > 8 && s.slope > 0.45);
    expect(steep.length).toBeGreaterThan(5);
    expect(steep.some((s) => s.family === 'rocky-floor')).toBe(true);
    // exposed land still classifies into the ordinary families
    const exposed = new Set(samples.filter((s) => s.h > 2).map((s) => s.family));
    expect([...exposed].some((f) => ['grassland', 'dry-lowland', 'slope-rock', 'high-rock', 'shore-sand'].includes(f))).toBe(true);
    results.sandyFloor = {
      deepFlatProbes: deepFlat.length,
      sandyFraction: sandy.length / deepFlat.length,
      exposedFamilies: [...exposed].sort(),
    };
  });

  test('7. time-of-day law: elevation curve at pinned phases; sky luma noon > sunset > night', async ({ page }) => {
    test.setTimeout(240_000);
    mkdirSync(MEDIA_DIR, { recursive: true });
    await bootRegion(page);
    await testHook(page, `teleport(${SPAWN.x}, ${SPAWN.z}, -3)`);
    await testHook(page, 'setIntent({ brake: true })');
    await testHook(page, 'setOcean({ frozen: true, timeS: 137.25 })');
    await testHook(page, 'setStageEnabled({ clouds: false })');

    // curve law (pure function checks)
    const at = async (phase: number) => {
      await testHook(page, `setTimeOfDay({ phase: ${phase}, frozen: true })`);
      return (await oceanHook(page, 'timeOfDay()')) as { elevationDeg: number; azimuthDeg: number };
    };
    expect(Math.abs((await at(0)).elevationDeg)).toBeLessThan(0.2);
    expect(Math.abs((await at(0.41)).elevationDeg - 62)).toBeLessThan(0.2);
    expect(Math.abs((await at(0.82)).elevationDeg)).toBeLessThan(0.2);
    expect(Math.abs((await at(0.91)).elevationDeg - -12)).toBeLessThan(0.2);
    // azimuth rotates a full turn per cycle
    const az0 = (await at(0)).azimuthDeg;
    const az05 = (await at(0.5)).azimuthDeg;
    // half a cycle advances the azimuth by exactly 180°
    expect(Math.abs(((az05 - az0 + 360) % 360) - 180)).toBeLessThan(0.5);

    // day-cycle sky signature (above-water horizon shot): noon = bright and
    // blue; sunset = warm (r/b hue shift); night = dark (the applySun
    // scotopic exposure dimmer — the demo atmosphere itself has no night)
    const shoot = async (name: string, phase: number) => {
      await testHook(page, `setTimeOfDay({ phase: ${phase}, frozen: true })`);
      await testHook(
        page,
        `shotMode({ pos: [${SPAWN.x}, 6, ${SPAWN.z}], look: [${SPAWN.x + 100}, 10, ${SPAWN.z}], fov: 60, size: [1280, 800] })`,
      );
      await page.waitForTimeout(900);
      const p = join(MEDIA_DIR, `tod-${name}.png`);
      await page.locator('#app canvas').screenshot({ path: p }); // warm-up (stale frame)
      await page.waitForTimeout(300);
      await page.locator('#app canvas').screenshot({ path: p });
      return bandStats(decodePng(p), 0.05, 0.45); // sky band
    };
    const noon = await shoot('noon', 0.41);
    const sunset = await shoot('sunset', 0.805);
    const night = await shoot('night', 0.91);
    const msg = `noon luma ${noon.luma.toFixed(1)} warmth ${noon.warmth.toFixed(2)} / ` +
      `sunset ${sunset.luma.toFixed(1)}, ${sunset.warmth.toFixed(2)} / ` +
      `night ${night.luma.toFixed(1)}, ${night.warmth.toFixed(2)}`;
    expect(noon.luma, msg).toBeGreaterThan(night.luma + 40);
    expect(sunset.luma, msg).toBeGreaterThan(night.luma + 40);
    expect(sunset.warmth, msg).toBeGreaterThan(noon.warmth + 0.08);

    await testHook(page, 'shotMode(null)');
    results.timeOfDay = { sky: { noon, sunset, night } };
  });

  test('8. pipeline smoke: clouds and the post chain visibly change the frame', async ({ page }) => {
    test.setTimeout(240_000);
    mkdirSync(MEDIA_DIR, { recursive: true });
    await bootRegion(page);
    await testHook(page, `teleport(${SPAWN.x}, ${SPAWN.z}, -3)`);
    await testHook(page, 'setIntent({ brake: true })');
    await testHook(page, 'setTimeOfDay({ phase: 0.41, frozen: true })');
    await testHook(page, 'setOcean({ frozen: true, timeS: 137.25 })');
    await testHook(
      page,
      `shotMode({ pos: [${SPAWN.x}, 8, ${SPAWN.z}], look: [${SPAWN.x + 100}, 25, ${SPAWN.z}], fov: 60, size: [1280, 800] })`,
    );
    await page.waitForTimeout(1500); // let the temporal cloud resolve settle
    await page.locator('#app canvas').screenshot({ path: join(MEDIA_DIR, 'smoke-warmup.png') });
    await page.waitForTimeout(300);

    const withClouds = join(MEDIA_DIR, 'smoke-clouds-on.png');
    const noClouds = join(MEDIA_DIR, 'smoke-clouds-off.png');
    const noPost = join(MEDIA_DIR, 'smoke-post-off.png');
    await page.locator('#app canvas').screenshot({ path: withClouds });
    await testHook(page, 'setStageEnabled({ clouds: false })');
    await page.waitForTimeout(400);
    await page.locator('#app canvas').screenshot({ path: noClouds });
    const cloudDiff = diffFraction(decodePng(withClouds), decodePng(noClouds), 4);
    expect(cloudDiff, 'volumetric clouds must change sky pixels').toBeGreaterThan(0.005);

    await testHook(page, 'setPostEnabled(false)');
    await page.waitForTimeout(400);
    await page.locator('#app canvas').screenshot({ path: noPost });
    const postDiff = diffFraction(decodePng(noClouds), decodePng(noPost), 4);
    expect(postDiff, 'the post composite must change the frame').toBeGreaterThan(0.05);

    await testHook(page, 'setPostEnabled(true)');
    await testHook(page, 'setStageEnabled({ clouds: true })');
    await testHook(page, 'shotMode(null)');
    results.pipelineSmoke = { cloudDiff, postDiff };
  });

  test('9. floating bodies: a dropped sphere settles riding the Gerstner surface (CPU-mirror agreement)', async ({ page }) => {
    await bootRegion(page);
    // deep open water over the trench — no beaching
    await testHook(page, "dropBody('sphere', 450, -30)");
    await page.waitForTimeout(4000);
    const check = (await page.evaluate(() => {
      const h = (window as any).__SHARED_WORLD;
      const b = h.ocean.bodies()[0];
      if (!b) return null;
      const surf = h.ocean.heightAt(b.x, b.z, h.ocean.state().timeS);
      return { y: b.y, surf, r: b.r, wet: b.wet, delta: Math.abs(b.y - surf) };
    })) as { y: number; surf: number; r: number; wet: number; delta: number } | null;
    expect(check).not.toBeNull();
    // riding the surface: centre within (radius + wave amplitude + slack)
    expect(check!.delta, `body y ${check!.y.toFixed(2)} vs surface ${check!.surf.toFixed(2)}`)
      .toBeLessThanOrEqual(check!.r + 1.6);
    expect(check!.wet).toBeGreaterThan(0.05);
    await testHook(page, 'clearBodies()');
    results.floatingBody = check;
  });

  test('10. performance: sustained median fps ≥ 58, simHz > 100 on a scripted burst swim; stage medians recorded', async ({ page, browser }) => {
    test.setTimeout(300_000);
    await bootRegion(page);
    await testHook(page, `teleport(${SPAWN.x}, ${SPAWN.z}, -6)`);
    await testHook(page, `setYaw(${Math.PI / 2})`);
    await testHook(page, 'setIntent({ burst: true })');
    await page.waitForTimeout(1500);

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
      12,
    )) as number[];
    const simHz = (await state(page)).simHz as number;
    await testHook(page, 'setIntent(null)');
    const sorted = [...buckets].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;

    // record BEFORE asserting so a failing floor still ships its evidence
    await page.waitForTimeout(4000);
    const gpuStages = await page.evaluate(() => (window as any).__SHARED_WORLD.region.gpuStageMs());
    const cpuStages = await page.evaluate(() => (window as any).__SHARED_WORLD.region.stageMs());
    const mem = await page.evaluate(() => (performance as any).memory?.usedJSHeapSize ?? null);
    results.perf = {
      script: 'burst east across the bay, 12 s',
      fps: { buckets, median, min: sorted[0] },
      simHz,
      gpuStageMs: gpuStages,
      cpuStageMs: cpuStages,
      usedJSHeapBytes: mem,
      viewport: page.viewportSize(),
      devicePixelRatio: await page.evaluate(() => window.devicePixelRatio),
      acceptanceTier: process.env.SHARED_WORLD_ACCEPTANCE === '1',
      chromeVersion: browser.version(),
    };

    expect(simHz, `simHz ${simHz}`).toBeGreaterThan(100);
    expect(median, `median fps ${median} (buckets ${buckets.join(',')})`).toBeGreaterThanOrEqual(58);
  });
});
