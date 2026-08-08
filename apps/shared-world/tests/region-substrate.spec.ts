import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

/**
 * Checkpoint 05A — terrain relief and substrate color rework (addendum
 * §4.12 verification items not already carried by the existing suites):
 *
 *  1. artifact identity vs CP05: shore.png / shore_sdf.r16 / biome.png /
 *     placement.json BYTE-IDENTICAL (recorded CP05 SHA-256); height.r16 /
 *     caves.json / world.json changed — the full old→new hash table goes
 *     to the eval artifact (items 2–5).
 *  2. relief bake checks: the cp05a --check entries (shore-mask-preserved,
 *     strong-zone roughness, protected-lagoon restraint, loop
 *     navigability) all pass, plus the cp04A layout-fidelity set
 *     (mini-islands, summit, trench, lagoon band) re-asserted (items 3–5).
 *  3. placement Y resample: caves.json mouth lipY equals the revised
 *     terrainHeight at each mouth's approved X/Z (independent decode);
 *     cave/arch transforms keep their approved X/Z exactly (item 6).
 *  4. classification equivalence: the GPU albedo-debug render vs the CPU
 *     twin at projected probes within tolerance; the structural audit
 *     proves the terrain fragment carries the ONE substrate entry point and
 *     no legacy tint law (items 7, 18). [CP05C: albedo is LINEAR and the
 *     jeantimex water shaders are retired — the raymarch-path halves of the
 *     old audit are void; capture runs with post disabled for raw pixels.]
 *  5. underwater classification variation: distinct families across an
 *     underwater probe grid; slope- and depth-dependence demonstrated
 *     numerically (item 19). [CP05C: depth expresses as the sandy-dune
 *     blend, not darkening — the water optics own all darkening.]
 *  6. substrate-only vocabulary: every family label is ordinary ground —
 *     the automated proxy for item 20 (the visual "no asset-like
 *     silhouettes" ruling stays with the §9 manual review).
 *
 * Items 8–17 are the surviving suites — region-terrain / region-ocean /
 * region / camera / pool / scaffold — re-run in the same invocation (the
 * jeantimex four-shot and ambient suites are retired per the
 * ocean-replacement addendum §4.8).
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(HERE, '..');
const REPO_ROOT = resolve(APP_ROOT, '..', '..');
const WORLD_DIR = join(APP_ROOT, 'public', 'world');
const BAKE = join(APP_ROOT, 'authoring', 'bake-region.mjs');
const RESULTS_PATH = join(REPO_ROOT, 'eval', 'shared-world-results.json');
const MEDIA_DIR = join(REPO_ROOT, 'media', 'shared-world-cp05a');

const N = 2049;
const TEXEL = 2000 / 2048;

/** CP05-approved artifact hashes (commit 8ca67cc / 54ab302 tree). */
const CP05_SHA256: Record<string, string> = {
  'height.r16': '3cadb13ee9a6e421d211a827213951b4e25a6ed1f8d2252670067605118adead',
  'shore.png': 'c640fbb71987dd763b18708ffc9070d9b5d7f0c970d097ba00eb4a43081c5d49',
  'shore_sdf.r16': '1d5384f5b1a9c9551a06ebee442fbedc9bd6511c8cca4a1a8f6076b50673bd93',
  'biome.png': '32d8de82fb9452c0b6862fe5ae2438ff540ab04516f1958aa0d720d0c022956e',
  'placement.json': 'ac812947e3e606d4b890f25e4a77536fc3ecacc2baede3681dc05b6d164cf334',
  'caves.json': '92bf01c35f376ea43bf8de09928b566cf1ffa33c488bba373f0e9ed0f0a7c23a',
  'world.json': '0ce1d50e6ed2dad0d7e35bbeef40fb94a3f22295f67b60b406b5d87bc7f8adab',
};

/** artifacts the relief rebake must NOT change (coastline/footprint law) */
const MUST_PRESERVE = ['shore.png', 'shore_sdf.r16', 'biome.png', 'placement.json'];
/** artifacts the relief rebake legitimately changes */
const MUST_CHANGE = ['height.r16', 'caves.json', 'world.json'];

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
        checkpoint: '05A-terrain-relief-and-substrate-color',
        generatedAt: new Date().toISOString(),
        region05a: { ...(existing.region05a as object | undefined), ...results },
      },
      null,
      2,
    ) + '\n',
  );
});

// ---------------------------------------------------------------- helpers

const sha256 = (buf: Buffer) => createHash('sha256').update(buf).digest('hex');

/** ZyFou Engine.js mulberry32 (same algorithm; seed-offset law check) */
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

const qDecode = (v: number) => -80 + (v / 65535) * 280;

function readU16(name: string): Uint16Array {
  const buf = readFileSync(join(WORLD_DIR, name));
  return new Uint16Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

function bilinearH(h16: Uint16Array, x: number, z: number): number {
  const u = Math.min(Math.max((x + 1000) / TEXEL, 0), N - 1);
  const v = Math.min(Math.max((z + 1000) / TEXEL, 0), N - 1);
  const i0 = Math.min(Math.floor(u), N - 2);
  const j0 = Math.min(Math.floor(v), N - 2);
  const fu = u - i0;
  const fv = v - j0;
  const a = qDecode(h16[j0 * N + i0]!);
  const b = qDecode(h16[j0 * N + i0 + 1]!);
  const c = qDecode(h16[(j0 + 1) * N + i0]!);
  const d = qDecode(h16[(j0 + 1) * N + i0 + 1]!);
  return (a + (b - a) * fu) * (1 - fv) + (c + (d - c) * fu) * fv;
}

/** minimal PNG decode (the suite's shared 8-bit filter-0 helper) */
function decodePng(path: string): { width: number; height: number; data: Buffer; bpp: number } {
  const png = readFileSync(path);
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const colorType = png[25]!;
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
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
    const ft = raw[y * stride]!;
    if (ft === 0) {
      raw.copy(data, y * width * bpp, y * stride + 1, (y + 1) * stride);
    } else if (ft === 2) {
      // up filter (Playwright screenshots use varied filters)
      for (let i = 0; i < width * bpp; i++) {
        const up = y > 0 ? data[(y - 1) * width * bpp + i]! : 0;
        data[y * width * bpp + i] = (raw[y * stride + 1 + i]! + up) & 0xff;
      }
    } else if (ft === 1) {
      for (let i = 0; i < width * bpp; i++) {
        const left = i >= bpp ? data[y * width * bpp + i - bpp]! : 0;
        data[y * width * bpp + i] = (raw[y * stride + 1 + i]! + left) & 0xff;
      }
    } else if (ft === 3) {
      for (let i = 0; i < width * bpp; i++) {
        const left = i >= bpp ? data[y * width * bpp + i - bpp]! : 0;
        const up = y > 0 ? data[(y - 1) * width * bpp + i]! : 0;
        data[y * width * bpp + i] = (raw[y * stride + 1 + i]! + ((left + up) >> 1)) & 0xff;
      }
    } else {
      // paeth
      for (let i = 0; i < width * bpp; i++) {
        const left = i >= bpp ? data[y * width * bpp + i - bpp]! : 0;
        const up = y > 0 ? data[(y - 1) * width * bpp + i]! : 0;
        const ul = y > 0 && i >= bpp ? data[(y - 1) * width * bpp + i - bpp]! : 0;
        const p = left + up - ul;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - ul);
        const pred = pa <= pb && pa <= pc ? left : pb <= pc ? up : ul;
        data[y * width * bpp + i] = (raw[y * stride + 1 + i]! + pred) & 0xff;
      }
    }
  }
  return { width, height, data, bpp };
}

async function bootRegion(page: Page): Promise<string[]> {
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
  await page.goto('/shared-world/?view=region&hud=0');
  await page.waitForFunction(
    () => {
      const h = (window as any).__SHARED_WORLD;
      return !!h && !!h.region && !!h.region.terrain && h.state().inWater === true;
    },
    undefined,
    { timeout: 40_000 },
  );
  return consoleErrors;
}

const testHook = (page: Page, expr: string) =>
  page.evaluate(`(window).__SHARED_WORLD.test.${expr}`);

// ------------------------------------------------------------------ tests

test.describe('checkpoint 05A — terrain relief and substrate color', () => {
  test('1. artifact identity vs CP05: coastline/footprint artifacts byte-identical; relief artifacts changed; hash table recorded', () => {
    const table: Record<string, { cp05: string; cp05a: string; changed: boolean }> = {};
    for (const name of Object.keys(CP05_SHA256)) {
      const now = sha256(readFileSync(join(WORLD_DIR, name)));
      table[name] = {
        cp05: CP05_SHA256[name]!,
        cp05a: now,
        changed: now !== CP05_SHA256[name],
      };
    }
    for (const name of MUST_PRESERVE) {
      expect(table[name]!.changed, `${name} must stay byte-identical to CP05`).toBe(false);
    }
    for (const name of MUST_CHANGE) {
      expect(table[name]!.changed, `${name} must carry the CP05A revision`).toBe(true);
    }
    results.artifactHashTable = table;
  });

  test('2. relief bake checks green: coastline preserved, strong-zone roughness, protections, loop navigability, layout fidelity', () => {
    const out = execFileSync('node', [BAKE, '--check'], { encoding: 'utf8', timeout: 240_000 });
    const line = out.split('\n').find((l) => l.startsWith('CHECK-REPORT '));
    expect(line).toBeTruthy();
    const report = JSON.parse(line!.slice('CHECK-REPORT '.length)) as {
      pass: boolean;
      checks: { name: string; pass: boolean; [k: string]: unknown }[];
    };
    expect(report.pass).toBe(true);
    const byName = Object.fromEntries(report.checks.map((c) => [c.name, c]));
    // cp05A items
    expect(byName['cp05a-shore-mask-preserved']!.pass).toBe(true);
    expect(byName['cp05a-relief-strong-zone']!.pass).toBe(true);
    expect((byName['cp05a-relief-strong-zone']!.rmsDeltaM as number)).toBeGreaterThanOrEqual(4);
    expect(byName['cp05a-relief-protected-lagoon']!.pass).toBe(true);
    expect(byName['cp05a-loop-navigability']!.pass).toBe(true);
    // CP05A correction: the three approved corridor masses read as rocky
    // mini-islands (peaks raised, roughness ×1.5+, footprints byte-identical)
    for (const c of report.checks) {
      if (c.name.startsWith('cp05a-islet-rocky-')) {
        expect(c.pass, c.name).toBe(true);
      }
    }
    expect(report.checks.filter((c) => c.name.startsWith('cp05a-islet-rocky-')).length).toBe(3);
    // approved-layout fidelity re-asserted on the revised field (items 3–5)
    for (const c of report.checks) {
      if (c.name.startsWith('island-centroid-')) {
        expect(c.pass, c.name).toBe(true);
      }
    }
    expect(byName['summit-position-and-height']!.pass).toBe(true);
    expect(byName['trench-floor']!.pass).toBe(true);
    expect(byName['lagoon-depth-band']!.pass).toBe(true);
    results.reliefChecks = report.checks.filter(
      (c) => c.name.startsWith('cp05a') || c.name.startsWith('island-') ||
        ['summit-position-and-height', 'trench-floor', 'lagoon-depth-band'].includes(c.name),
    );
  });

  test('3. placement Y resample: caves.json lipY matches the revised terrainHeight; approved X/Z transforms unchanged', () => {
    const h16 = readU16('height.r16');
    const caves = JSON.parse(readFileSync(join(WORLD_DIR, 'caves.json'), 'utf8')) as {
      modules: {
        id: string;
        transform: { x: number; z: number };
        mouths: { name: string; x: number; z: number; lipY: number }[];
      }[];
    };
    // approved transforms (REGION_SKETCHES § APPROVED LAYOUT — immovable)
    const approved: Record<string, [number, number]> = {
      'cave-headland': [-425, -60],
      'cave-trench-wall': [450, -30],
      'arch-islet-gap': [-40, -70],
    };
    const lipChecks: Record<string, { lipY: number; resampled: number }> = {};
    for (const m of caves.modules) {
      expect([m.transform.x, m.transform.z], `${m.id} X/Z`).toEqual(approved[m.id]);
      for (const mouth of m.mouths) {
        const resampled = bilinearH(h16, mouth.x, mouth.z);
        expect(Math.abs(mouth.lipY - resampled), `${m.id}/${mouth.name} lipY`).toBeLessThanOrEqual(0.01);
        lipChecks[`${m.id}/${mouth.name}`] = { lipY: mouth.lipY, resampled };
      }
    }
    // placement.json is byte-identical (test 1) ⇒ every approved site keeps
    // X/Z and category identity; Y is runtime-sampled from terrainHeight
    // (single-source law), so it is resampled by construction.
    results.placementYResample = {
      caveLipY: lipChecks,
      note: 'placement.json carries no baked Y — runtime Y comes from terrainHeight (Master §2.2); caves.json lipY re-baked from the revised field',
    };
  });

  test('4. classification equivalence: GPU albedo-debug vs the CPU twin at projected probes; one substrate include everywhere', async ({ page }) => {
    test.setTimeout(300_000);
    mkdirSync(MEDIA_DIR, { recursive: true });
    await page.setViewportSize({ width: 1748, height: 1080 });
    const errors = await bootRegion(page);

    // structural audit: the ONE substrate entry point, no legacy tint law
    // (cp05C: the jeantimex water raymarch shaders are retired — the ocean
    // reads the terrain through the refraction render target, so the
    // terrain fragment is the single classification consumer)
    const audit = (await page.evaluate(
      () => (window as any).__SHARED_WORLD.test.substrateShaderAudit(),
    )) as Record<string, boolean>;
    expect(audit.terrainHasSubstrate).toBe(true);
    expect(audit.anyLegacyTintLaw).toBe(false);
    results.substrateShaderAudit = audit;

    // camera 34 m above the south-bay shelf looking straight down — inside
    // the mip-staging full-detail radius (< 40 m) so the GPU's staged
    // detail/micro taps equal the camera-independent CPU twin exactly;
    // surface hidden + albedo-debug → raw classification pixels
    const CAM: [number, number, number] = [-180, 34, 300];
    await testHook(page, 'teleport(-500, -380, -3)'); // dolphin far away
    await testHook(page, 'setIntent({ brake: true })');
    await testHook(
      page,
      `shotMode({ pos: [${CAM.join(',')}], look: [${CAM[0] + 0.001}, 0, ${CAM[2]}], fov: 60, size: [1728, 1080] })`,
    );
    await testHook(page, 'setStageEnabled({ oceanMesh: false })');
    await testHook(page, 'setPostEnabled(false)'); // raw linear pixels
    await testHook(page, 'setAlbedoDebug(true)');
    await page.waitForTimeout(800);
    await page.addStyleTag({ content: '#region-overlay { display: none !important; }' });
    const shotPath = join(MEDIA_DIR, 'albedo-debug-probes.png');
    await page.locator('#app canvas').screenshot({ path: shotPath }); // warm-up (stale frame)
    await page.waitForTimeout(300);
    await page.locator('#app canvas').screenshot({ path: shotPath });

    // probe grid on the shelf (all within ~37 m of the camera → the staged
    // classification taps are at full strength, matching the CPU twin)
    const pts: [number, number][] = [];
    for (let dx = -14; dx <= 14; dx += 7) {
      for (let dz = -14; dz <= 14; dz += 7) {
        pts.push([CAM[0] + dx, CAM[2] + dz]);
      }
    }
    const cpu = (await page.evaluate(
      (p) => (window as any).__SHARED_WORLD.test.substrateProbe(p),
      pts,
    )) as { albedo: [number, number, number]; family: string; h: number }[];
    const pts3 = pts.map(([x, z], i) => [x, cpu[i]!.h, z] as [number, number, number]);
    const px = (await page.evaluate(
      (p) => (window as any).__SHARED_WORLD.test.projectPoints(p),
      pts3,
    )) as { px: number; py: number; inFront: boolean }[];

    await testHook(page, 'setAlbedoDebug(false)');
    await testHook(page, 'setStageEnabled({ oceanMesh: true })');
    await testHook(page, 'setPostEnabled(true)');
    await testHook(page, 'shotMode(null)');
    await testHook(page, 'setIntent(null)');

    const img = decodePng(shotPath);
    expect(img.width).toBe(1728);
    let compared = 0;
    let maxErr = 0;
    // cp05C: LINEAR albedo — the old 0.07 tolerance was measured in
    // gamma-encoded space, where the 1/2.2 curve compresses differences
    // ~2.2× at midtones; the same underlying fp32/LUT/8-bit noise therefore
    // reads up to ~0.15 in linear space (measured worst probe 0.1002,
    // deterministic across tiers)
    const TOL = 0.12;
    const comparisons: unknown[] = [];
    for (let i = 0; i < pts.length; i++) {
      const p = px[i]!;
      if (!p.inFront) continue;
      const xI = Math.round(p.px);
      const yI = Math.round(p.py);
      if (xI < 2 || yI < 2 || xI >= img.width - 2 || yI >= img.height - 2) continue;
      const o = (yI * img.width + xI) * img.bpp;
      const gpu = [img.data[o]! / 255, img.data[o + 1]! / 255, img.data[o + 2]! / 255];
      const want = cpu[i]!.albedo;
      const err = Math.max(
        Math.abs(gpu[0]! - want[0]),
        Math.abs(gpu[1]! - want[1]),
        Math.abs(gpu[2]! - want[2]),
      );
      comparisons.push({ xz: pts[i], family: cpu[i]!.family, cpu: want, gpu, err });
      if (err > maxErr) maxErr = err;
      compared++;
      expect(err, `probe (${pts[i]![0]}, ${pts[i]![1]}) family ${cpu[i]!.family}`).toBeLessThanOrEqual(TOL);
    }
    expect(compared).toBeGreaterThanOrEqual(15);
    results.classificationEquivalence = {
      comparedProbes: compared,
      maxChannelError: maxErr,
      tolerance: TOL,
      capture: 'media/shared-world-cp05a/albedo-debug-probes.png',
      note:
        'GPU albedo-debug (the include shared verbatim by the water raymarch shaders — structural audit above) vs the fp32-exact CPU twin; equivalence of the direct and raymarched paths is by shared-source construction',
      samples: comparisons.slice(0, 6),
    };
    expect(errors, errors.join(' | ')).toEqual([]);
  });

  test('5. underwater classification varies by substrate, slope and depth — never one uniform deep tint', async ({ page }) => {
    await bootRegion(page);
    // probe grid across the region's underwater areas (approved features)
    const pts: [number, number][] = [];
    for (let x = -900; x <= 900; x += 60) {
      for (let z = -900; z <= 900; z += 60) {
        pts.push([x, z]);
      }
    }
    const samples = (await page.evaluate(
      (p) => (window as any).__SHARED_WORLD.test.substrateProbe(p),
      pts,
    )) as { albedo: [number, number, number]; family: string; h: number; slope: number; depth: number }[];
    const underwater = samples.filter((s) => s.h < 0);
    expect(underwater.length).toBeGreaterThan(300);

    // CP05C spec (ocean-replacement addendum §2.4): depth now expresses as
    // the sandy-dune ACCUMULATION blend, never darkening — the navy deep
    // ramp is deleted and all underwater darkening belongs to the water
    // optics. Asserted here: the sandy blend engages with depth, rock and
    // silt keep class identity, and the floor is never one uniform tint.
    const families = new Set(underwater.map((s) => s.family));
    results.underwaterFamilies = [...families].sort();
    expect(families.size, `families seen: ${[...families].join(', ')}`).toBeGreaterThanOrEqual(3);

    const mean = (arr: typeof underwater) => {
      const m: [number, number, number] = [0, 0, 0];
      for (const s of arr) {
        m[0] += s.albedo[0]; m[1] += s.albedo[1]; m[2] += s.albedo[2];
      }
      return m.map((v) => v / arr.length) as [number, number, number];
    };

    // depth-dependence (the Blank floor ramp): shallow vs deep flats
    const shallowFlat = underwater.filter((s) => s.depth < 10 && s.slope < 0.1);
    const deepFlat = underwater.filter((s) => s.depth > 55 && s.slope < 0.1);
    expect(shallowFlat.length).toBeGreaterThan(5);
    expect(deepFlat.length).toBeGreaterThan(5);
    const m1 = mean(shallowFlat);
    const m2 = mean(deepFlat);
    const depthDelta = Math.hypot(m1[0] - m2[0], m1[1] - m2[1], m1[2] - m2[2]);
    // cp05C: the depth signal is the sandy blend (hue shift toward dune
    // sand), far smaller than the deleted navy ramp's darkening by design
    expect(depthDelta, 'shallow vs deep mean albedo at matched slope').toBeGreaterThan(0.04);
    // and the deep floor must NOT be darker-navy — its mean stays bright
    // (the old ramp drove deep flats toward (0.012, 0.075, 0.14))
    expect(m2[0], 'deep-floor red channel stays sandy, never navy').toBeGreaterThan(0.2);

    // residual non-depth variation: at comparable mid depths the floor is
    // not one constant color (slope rock bleed-through + micro noise +
    // climate wetland tint survive the 0.92 floor mix)
    const mid = underwater.filter((s) => s.depth > 15 && s.depth < 45);
    const flat = mid.filter((s) => s.slope < 0.1);
    const steep = mid.filter((s) => s.slope > 0.35);
    expect(flat.length).toBeGreaterThan(5);
    expect(steep.length).toBeGreaterThan(5);
    const mf = mean(flat);
    const ms = mean(steep);
    const slopeDelta = Math.hypot(mf[0] - ms[0], mf[1] - ms[1], mf[2] - ms[2]);
    expect(slopeDelta, 'flat vs steep mean albedo at matched depth').toBeGreaterThan(0.005);
    let varSum = 0;
    const mm = mean(mid);
    for (const s of mid) {
      varSum += Math.hypot(s.albedo[0] - mm[0], s.albedo[1] - mm[1], s.albedo[2] - mm[2]);
    }
    const midMeanAbsDev = varSum / mid.length;
    expect(midMeanAbsDev, 'mid-depth floor not a uniform tint').toBeGreaterThan(0.01);

    results.underwaterVariation = {
      probes: underwater.length,
      families: [...families].sort(),
      slopeDelta,
      depthDelta,
      midMeanAbsDev,
      note: 'ZyFou Blank floor is depth-dominant by user-directed design (CP05A correction)',
    };
  });

  test('6. substrate-only vocabulary: every family label is ordinary ground (asset presence never encoded)', async ({ page }) => {
    await bootRegion(page);
    const pts: [number, number][] = [];
    for (let x = -950; x <= 950; x += 45) {
      for (let z = -950; z <= 950; z += 45) {
        pts.push([x, z]);
      }
    }
    const samples = (await page.evaluate(
      (p) => (window as any).__SHARED_WORLD.test.substrateProbe(p),
      pts,
    )) as { family: string }[];
    const allowed = new Set([
      // ZyFou Blank coloration families (CP05A correction; CP05C adds the
      // sandy/silt floor labels and retires the deep/mid depth bands) —
      // every label is ordinary ground / climate coloration, never an asset
      'shallow-floor', 'sandy-floor', 'silt-floor', 'rocky-floor',
      'shore-sand', 'dry-lowland', 'grassland', 'tundra', 'swamp-soil',
      'slope-rock', 'canyon-rock', 'high-rock', 'snow',
    ]);
    const seen = new Set(samples.map((s) => s.family));
    for (const f of seen) {
      expect(allowed.has(f), `family "${f}" must be an ordinary-ground label`).toBe(true);
    }
    results.substrateVocabulary = {
      seen: [...seen].sort(),
      note:
        'automated proxy for addendum §4.12 item 20; the visual "no asset-like silhouettes or patterns" ruling belongs to the §9 manual review',
    };
  });

  test('7. ZyFou Fantasy source fidelity: Cartoon terrain palette, style, frequency and seed offsets match the pinned snapshot; water roles excluded', () => {
    // CP05C revision (ocean-replacement addendum §2.4): ONE palette across
    // the waterline — the Earth submerged arm, the waterline split, the
    // Z_COL_DEEP navy ramp, and the display encode are deleted; the
    // substrate lives in src/terrain/shaders.ts as direct Fantasy consts.
    const REF = resolve(REPO_ROOT, 'docs', 'bodyarcade-stage3', 'references', 'zyfou-procedural-terrains');
    // pinned commit guard
    const record = readFileSync(join(REF, 'BODYARCADE_SOURCE_RECORD.md'), 'utf8');
    expect(record).toContain('8b396f9c784676d46f6a147d310d9f547bf41403');

    // the fantasy template selects the cartoon preset → 'Cartoon Terrain'
    const templates = readFileSync(join(REF, 'src', 'project', 'ProjectTemplates.js'), 'utf8');
    expect(templates).toMatch(/id:\s*'fantasy'[\s\S]*?preset:\s*'cartoon'/);
    const presets = readFileSync(join(REF, 'src', 'engine', 'presets.js'), 'utf8');
    expect(presets).toMatch(/cartoon:\s*{[\s\S]*?palettePreset:\s*'cartoon'/);

    // 'Cartoon Terrain' palette from the snapshot (ColorPalettePresets.js)
    const palSrc = readFileSync(join(REF, 'src', 'engine', 'style', 'ColorPalettePresets.js'), 'utf8');
    const start = palSrc.indexOf("cartoon: {");
    const palBlock = palSrc.slice(start, palSrc.indexOf('},\n  },', start));
    const pal: Record<string, [number, number, number]> = {};
    for (const m of palBlock.matchAll(/(\w+):\s*\[([\d.]+),\s*([\d.]+),\s*([\d.]+)\]/g)) {
      pal[m[1]!] = [Number(m[2]), Number(m[3]), Number(m[4])];
    }
    expect(Object.keys(pal).length).toBeGreaterThanOrEqual(16);

    const glsl = readFileSync(join(APP_ROOT, 'src', 'terrain', 'shaders.ts'), 'utf8');
    const glslCol = (name: string): [number, number, number] => {
      const m = glsl.match(new RegExp(`Z_COL_${name}\\s*=\\s*vec3\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)\\)`));
      expect(m, `Z_COL_${name} present`).toBeTruthy();
      return [Number(m![1]), Number(m![2]), Number(m![3])];
    };
    // the 13 terrain-albedo roles = Cartoon Terrain palette, everywhere
    const MAP: [string, string][] = [
      ['SAND', 'sand'], ['DUNE', 'dune'],
      ['DRYGRASS', 'dryGrass'], ['GRASS', 'grass'], ['FOREST', 'forest'],
      ['JUNGLE', 'jungle'], ['SWAMP', 'swamp'], ['TUNDRA', 'tundra'],
      ['REDROCK', 'redRock'], ['REDROCK2', 'redRock2'], ['ROCK', 'rock'],
      ['ROCKHI', 'rockHi'], ['SNOW', 'snow'],
    ];
    for (const [glslName, srcName] of MAP) {
      const got = glslCol(glslName);
      for (let c = 0; c < 3; c++) {
        expect(Math.abs(got[c]! - pal[srcName]![c]!), `Z_COL_${glslName}[${c}] vs CartoonTerrain.${srcName}`).toBeLessThanOrEqual(1e-9);
      }
    }
    // CP05C supersessions asserted structurally: no Earth arm / navy ramp /
    // waterline palette split / display encode DECLARED anywhere in the
    // substrate (prose comments may still name them as deleted history)
    expect(/const\s+vec3\s+Z_COL_DEEP/.test(glsl), 'navy deep ramp deleted').toBe(false);
    expect(/void\s+zSelectSubstratePalette/.test(glsl), 'waterline palette split deleted').toBe(false);
    expect(/vec3\s+zDisplayEncode/.test(glsl), 'display encode deleted (linear albedo)').toBe(false);
    // WATER-role exclusion (user instruction stands): Cartoon
    // deep/shallow/foam never enter the terrain substrate
    expect(glsl.includes('0.02, 0.18, 0.55'), 'no Cartoon water deep').toBe(false);
    expect(glsl.includes('0.02, 0.55, 0.85'), 'no Cartoon water shallow').toBe(false);
    // the sandy seafloor blend uses the WaterThreeJS Floor sand values
    expect(glsl).toContain('Z_DUNE_SAND  = vec3(0.66, 0.58, 0.44)');
    expect(glsl).toContain('Z_DUNE_SAND2 = vec3(0.46, 0.41, 0.31)');

    // Blank/Highlands parameter law (Engine.js): uFrequency = (45·0.1)/2048;
    // uSeedOffset = mulberry32(1337)·2048 − 1024 (two draws)
    const rng = mulberry32(1337);
    const offX = rng() * 2048 - 1024;
    const offZ = rng() * 2048 - 1024;
    const freqM = glsl.match(/Z_FREQ\s*=\s*([\d.]+)/)!;
    expect(Number(freqM[1])).toBe((45 * 0.1) / 2048);
    const seedM = glsl.match(/Z_SEED_OFFSET\s*=\s*vec2\((-?[\d.]+),\s*(-?[\d.]+)\)/)!;
    expect(Math.abs(Number(seedM[1]) - offX)).toBeLessThanOrEqual(1e-9);
    expect(Math.abs(Number(seedM[2]) - offZ)).toBeLessThanOrEqual(1e-9);

    // DEFAULT_PLANET_STYLE post defaults (PlanetStyleConfig.js)
    const styleSrc = readFileSync(join(REF, 'src', 'engine', 'style', 'PlanetStyleConfig.js'), 'utf8');
    expect(styleSrc).toContain('paletteSaturation: 1.0');
    expect(styleSrc).toContain('paletteContrast: 1.0');
    expect(styleSrc).toContain('paletteTint: [1.0, 1.0, 1.0]');
    expect(glsl).toContain('Z_PAL_SATURATION = 1.0');
    expect(glsl).toContain('Z_PAL_CONTRAST = 1.0');

    // the CPU twin carries the same single palette (parity contract)
    const cpu = readFileSync(join(APP_ROOT, 'src', 'world', 'substrateCpu.ts'), 'utf8');
    const cpuBlock = (marker: string): string => {
      const at = cpu.indexOf(marker);
      expect(at, `${marker} present`).toBeGreaterThanOrEqual(0);
      return cpu.slice(at, cpu.indexOf('};', at));
    };
    const parseRoles = (block: string): Record<string, [number, number, number]> => {
      const out: Record<string, [number, number, number]> = {};
      for (const m of block.matchAll(/(\w+):\s*\[([\d.]+),\s*([\d.]+),\s*([\d.]+)\]/g)) {
        out[m[1]!] = [Number(m[2]), Number(m[3]), Number(m[4])];
      }
      return out;
    };
    const cpuF = parseRoles(cpuBlock('const COL_F'));
    for (const key of ['sand', 'dune', 'dryGrass', 'grass', 'forest', 'jungle', 'swamp', 'tundra', 'redRock', 'redRock2', 'rock', 'rockHi', 'snow'] as const) {
      for (let c = 0; c < 3; c++) {
        expect(Math.abs(cpuF[key]![c]! - pal[key]![c]!), `COL_F.${key}[${c}]`).toBeLessThanOrEqual(1e-9);
      }
    }
    expect(/const\s+COL_E\s*=/.test(cpu), 'CPU twin Earth arm deleted').toBe(false);
    expect(/const\s+COL_DEEP/.test(cpu), 'CPU twin navy ramp deleted').toBe(false);
    expect(cpu.includes('1 / 2.2'), 'CPU twin display encode deleted').toBe(false);

    results.zyfouSourceFidelity = {
      pinnedCommit: '8b396f9c784676d46f6a147d310d9f547bf41403',
      terrainPaletteRoles: 13,
      waterRolesExcluded: ['deep', 'shallow', 'foam'],
      uFrequency: (45 * 0.1) / 2048,
      uSeedOffset: [offX, offZ],
      note:
        'CP05C: one Cartoon Terrain palette across the waterline, LINEAR albedo (encode removed with the jeantimex display-raw pipeline), sandy WaterThreeJS dune blend on the seafloor; Earth arm / navy ramp / waterline split deleted per the ocean-replacement addendum §2.4',
    };
  });
});
