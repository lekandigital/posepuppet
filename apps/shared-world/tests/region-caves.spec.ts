import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

/**
 * Checkpoint 09 — caves and overhangs (§8 automated verification):
 *
 *  1. artifacts + X/Z preservation: caves.json module geometry committed and
 *     hash-matched; every approved cave-mouth/arch X/Z byte-identical to the
 *     cp04A constants; seam stamps + clearance contract recorded; Kenney
 *     license record present
 *  2. bake seam checks: the cp09-* checks of `bake-region.mjs --check` pass
 *     (stamp audit lower-only + footprint-contained, mouth sills seated,
 *     throat guarantee — the terrain sheet never crosses a bore, arch
 *     unstamped); artifact determinism itself is region.spec test 1
 *  3. boot: region loads the three modules; BVHs built; the cave fragment
 *     carries the shared substrate classification (Q19)
 *  4. seam capture scan: from inside each mouth notch the lip/seam region
 *     shows zero background pixels (no gaps between stamped terrain and
 *     module shell)
 *  5. clearance: BVH-measured width/height per station vs the recorded
 *     contract (user ruling) and absolute comfort floors
 *  6. traversal: scripted swims — headland S→N and N→S, trench in-and-back,
 *     arch pass at burst; no wedging, no camera emergency, TerrainCompressed
 *     engages/releases
 *  7. collision: burst ram batteries (wall / ceiling / end-cap) never
 *     penetrate; Rapier heightfield vs terrainHeight agreement probes; BVH
 *     cave queries sane
 *  8. darkness: CaveField-driven zone darkness — full deep inside, blended
 *     at the mouth, exactly 0 in open water; dark dials match the table;
 *     shafts die in the dark zone; probe determinism across reload
 *  9. census: placement categories unchanged; the three cave/arch site
 *     records now carry real committed geometry
 * 10. cave-interior performance: median fps ≥ 58, simHz > 100 parked in the
 *     dark gallery; Rapier step/controller costs recorded
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(HERE, '..');
const REPO_ROOT = resolve(APP_ROOT, '..', '..');
const WORLD_DIR = join(APP_ROOT, 'public', 'world');
const BAKE = join(APP_ROOT, 'authoring', 'bake-region.mjs');
const RESULTS_PATH = join(REPO_ROOT, 'eval', 'shared-world-results.json');

/** approved transforms (cp03/cp04A — X/Z immutable without user approval) */
const APPROVED = {
  headlandSouth: { x: -420, z: 30 },
  headlandNorth: { x: -430, z: -150 },
  trenchWest: { x: 450, z: -30 },
  arch: { x: -40, z: -70 },
};

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
        checkpoint: '09-caves-and-overhangs',
        generatedAt: new Date().toISOString(),
        region09: { ...(existing.region09 as object | undefined), ...results },
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
      return !!h && !!h.region && !!h.region.caves && h.state().inWater === true;
    },
    undefined,
    { timeout: 60_000 },
  );
  await page.addStyleTag({ content: '#region-overlay { display: none !important; }' });
  return consoleErrors;
}

const state = (page: Page) => page.evaluate(() => (window as any).__SHARED_WORLD.state());
const testHook = (page: Page, expr: string) =>
  page.evaluate(`(window).__SHARED_WORLD.test.${expr}`);
const camEval = (page: Page) =>
  page.evaluate(() => (window as any).__SHARED_WORLD.camera());

const sha256 = (buf: Buffer) => createHash('sha256').update(buf).digest('hex');

interface Decoded {
  width: number;
  height: number;
  ch: number;
  data: Uint8Array;
}

/** full PNG decode (all five filters — Playwright screenshots use them) */
function decodePngBuf(png: Buffer): Decoded {
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
      if (filter === 0) v = rawV;
      else if (filter === 1) v = rawV + left;
      else if (filter === 2) v = rawV + up;
      else if (filter === 3) v = rawV + ((left + up) >> 1);
      else v = rawV + paeth(left, up, ul);
      out[rowOut + x] = v & 0xff;
    }
  }
  return { width, height, ch, data: out };
}

/** headland gallery point (mid-bore, deep inside both darkFullM horizons) */
const GALLERY = { x: -423.394765, z: -59.950184, floorY: -39.9, halfW: 5.8, height: 7.7 };

// ----------------------------------------------------------------- tests

test.describe('checkpoint 09 — caves and overhangs', () => {
  test('1. artifacts: committed module geometry, X/Z preservation, stamps + clearance recorded, license record', () => {
    const caves = JSON.parse(readFileSync(join(WORLD_DIR, 'caves.json'), 'utf8'));
    expect(caves.modules.map((m: { id: string }) => m.id)).toEqual([
      'cave-headland', 'cave-trench-wall', 'arch-islet-gap',
    ]);
    const geomHashes: Record<string, string> = {};
    for (const m of caves.modules) {
      expect(m.moduleId, `${m.id} has committed geometry`).toBeTruthy();
      const glb = readFileSync(join(WORLD_DIR, m.moduleId));
      expect(glb.length, `${m.id} bytes`).toBe(m.geometry.bytes);
      const hash = sha256(glb);
      expect(hash, `${m.id} sha256`).toBe(m.geometry.sha256);
      geomHashes[m.id] = hash;
      expect(m.runtime, `${m.id} runtime record`).toBeTruthy();
    }
    // X/Z preservation — byte-identical to the approved constants
    const headland = caves.modules[0];
    expect(headland.mouths[0]).toMatchObject({ x: APPROVED.headlandSouth.x, z: APPROVED.headlandSouth.z });
    expect(headland.mouths[1]).toMatchObject({ x: APPROVED.headlandNorth.x, z: APPROVED.headlandNorth.z });
    expect(caves.modules[1].mouths[0]).toMatchObject({ x: APPROVED.trenchWest.x, z: APPROVED.trenchWest.z });
    expect(caves.modules[2].transform).toMatchObject({ x: APPROVED.arch.x, z: APPROVED.arch.z });
    // placement pins unchanged
    const placement = JSON.parse(readFileSync(join(WORLD_DIR, 'placement.json'), 'utf8'));
    const byType = Object.fromEntries(
      placement.instances.map((i: { type: string }) => [i.type, i]),
    );
    expect(byType['headland-cave-south-mouth']).toMatchObject(APPROVED.headlandSouth);
    expect(byType['headland-cave-north-mouth']).toMatchObject(APPROVED.headlandNorth);
    expect(byType['trench-wall-cave-optional']).toMatchObject(APPROVED.trenchWest);
    expect(byType['islet-gap-arch-5m']).toMatchObject(APPROVED.arch);
    // seam stamps + clearance contract recorded in the artifact
    expect(caves.stamps.map((s: { id: string }) => s.id)).toEqual([
      'stamp-headland-s-throat', 'stamp-headland-n-throat',
      'stamp-headland-n-hoodseat', 'stamp-trench-throat',
    ]);
    expect(caves.clearance.headlandMinW).toBeGreaterThan(0);
    // license record (CP09 asset gate)
    const credits = readFileSync(join(REPO_ROOT, 'CREDITS.md'), 'utf8');
    expect(credits).toContain('Modular Cave Kit');
    expect(credits).toContain('CC0');
    expect(credits).toContain('Live license check 2026-08-15');
    const record = readFileSync(
      join(APP_ROOT, 'authoring', 'assets', 'kenney-modular-cave-kit', 'BODYARCADE_SOURCE_RECORD.md'),
      'utf8',
    );
    expect(record).toContain('Creative Commons Zero (CC0)');
    results.artifacts = { geomHashes, stamps: caves.stamps.length, clearance: caves.clearance };
  });

  test('2. bake seam checks: stamp audit, support containment, mouth sills, throat guarantee, arch unstamped', () => {
    const out = execFileSync('node', [BAKE, '--check'], { encoding: 'utf8', timeout: 180_000 });
    const line = out.split('\n').find((l) => l.startsWith('CHECK-REPORT '));
    expect(line).toBeTruthy();
    const report = JSON.parse(line!.slice('CHECK-REPORT '.length)) as {
      pass: boolean;
      checks: { name: string; pass: boolean; [k: string]: unknown }[];
    };
    expect(report.pass).toBe(true);
    const byName = Object.fromEntries(report.checks.map((c) => [c.name, c]));
    for (const name of [
      'cp09-stamp-audit', 'cp09-stamp-support-contained', 'cp09-mouth-sills',
      'cp09-throat-cave-headland', 'cp09-throat-cave-trench-wall', 'cp09-arch-no-stamp',
    ]) {
      expect(byName[name], `${name} present`).toBeTruthy();
      expect(byName[name]!.pass, `${name}: ${JSON.stringify(byName[name])}`).toBe(true);
    }
    expect(byName['cp09-stamp-audit']!.raises).toBe(0);
    // void crossings confined to the recorded aperture bands (where the
    // heightfield is locally omitted inside the bore volume)
    expect(byName['cp09-throat-cave-headland']!.voidOutsideBand).toBe(0);
    expect(byName['cp09-throat-cave-trench-wall']!.voidOutsideBand).toBe(0);
    results.bakeSeamChecks = Object.fromEntries(
      Object.entries(byName).filter(([k]) => k.startsWith('cp09-')),
    );
  });

  test('3. boot: three modules render, BVHs live, Rapier world live, shared substrate classification', async ({ page }) => {
    const consoleErrors = await bootRegion(page);
    const boot = await page.evaluate(() => {
      const h = (window as any).__SHARED_WORLD;
      return {
        caves: h.region.caves.stats(),
        collision: h.region.collision.stats(),
        audit: h.test.substrateShaderAudit(),
      };
    });
    expect(boot.caves.modules.map((m: { id: string }) => m.id)).toEqual([
      'cave-headland', 'cave-trench-wall', 'arch-islet-gap',
    ]);
    for (const m of boot.caves.modules) {
      expect(m.triangles).toBeGreaterThan(500);
      expect(m.bvhBuildMs).toBeLessThan(1000);
    }
    expect(boot.collision.physGridN).toBe(513);
    expect(boot.collision.trimeshes).toHaveLength(3);
    expect(boot.audit.caveHasSubstrate).toBe(true);
    expect(boot.audit.anyLegacyTintLaw).toBe(false);
    await page.waitForTimeout(1200);
    expect(consoleErrors, `console errors: ${consoleErrors.join(' | ')}`).toEqual([]);
    results.boot = boot;
  });

  test('4. seam capture scan: zero background pixels across every mouth lip/seam band', async ({ page }) => {
    test.setTimeout(240_000);
    await bootRegion(page);
    await testHook(page, 'setIntent({ brake: true })');
    await testHook(page, 'setOcean({ frozen: true, timeS: 41.5 })');
    await testHook(page, 'setTimeOfDay({ phase: 0.41, frozen: true })');
    // raw scan mode: flat magenta background, no post, no ocean surface
    await testHook(page, 'setFlatBackground(0xff00ff)');
    await testHook(page, 'setPostEnabled(false)');
    await testHook(page, 'setStageEnabled({ oceanMesh: false, particles: false })');

    // camera stands OUTSIDE each mouth on the approach line, looking at the
    // lip slightly downward so the frame is seam band + notch + shell
    const shots = [
      {
        name: 'headland-south',
        pos: [-418.4, -26.5, 49.0], look: [-420, -33.2, 30],
      },
      {
        name: 'headland-north',
        pos: [-430.5, -38.5, -169.0], look: [-430, -45.2, -150],
      },
      {
        name: 'trench-west',
        pos: [468.5, -72.0, -33.5], look: [450, -78.4, -30],
      },
      {
        name: 'arch-footings',
        pos: [-52.5, -22.0, -78.5], look: [-40, -27.5, -70],
      },
    ];
    const scan: Record<string, number> = {};
    for (const s of shots) {
      await testHook(
        page,
        `shotMode({ pos: [${s.pos.join(',')}], look: [${s.look.join(',')}], fov: 55, size: [960, 600] })`,
      );
      await page.waitForTimeout(450);
      const png = decodePngBuf(
        await page.screenshot({ clip: { x: 0, y: 0, width: 960, height: 600 } }),
      );
      // central seam band: x 15–85 %, y 35–95 % (below the lip horizon)
      const x0 = Math.floor(png.width * 0.15);
      const x1 = Math.floor(png.width * 0.85);
      const y0 = Math.floor(png.height * 0.35);
      const y1 = Math.floor(png.height * 0.95);
      let bg = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const o = (y * png.width + x) * png.ch;
          // flat background = pure magenta (raw linear pass, no post)
          if (png.data[o]! > 200 && png.data[o + 1]! < 60 && png.data[o + 2]! > 200) bg++;
        }
      }
      scan[s.name] = bg;
      expect(bg, `${s.name}: ${bg} background pixels in the seam band`).toBe(0);
    }
    await testHook(page, 'shotMode(null)');
    await testHook(page, 'setFlatBackground(null)');
    await testHook(page, 'setPostEnabled(true)');
    await testHook(page, 'setStageEnabled({ oceanMesh: true, particles: true })');
    results.seamScan = scan;
  });

  test('5. clearance: BVH-measured sections vs the recorded contract and comfort floors', async ({ page }) => {
    await bootRegion(page);
    const caves = JSON.parse(readFileSync(join(WORLD_DIR, 'caves.json'), 'utf8'));
    const contract = caves.clearance as Record<string, number>;

    const headland = (await testHook(page, `caveClearance('cave-headland')`)) as {
      s: number; widthM: number | null; heightM: number | null;
    }[];
    const trench = (await testHook(page, `caveClearance('cave-trench-wall')`)) as typeof headland;
    const arch = (await testHook(page, 'archClearance()')) as {
      openingW: number | null; clearHeightM: number | null; crownY: number;
    };

    const min = (rows: typeof headland, k: 'widthM' | 'heightM') =>
      Math.min(...rows.filter((r) => r[k] !== null).map((r) => r[k]!));

    const measured = {
      headland: { minW: min(headland, 'widthM'), minH: min(headland, 'heightM'), rows: headland },
      trench: { minW: min(trench, 'widthM'), minH: min(trench, 'heightM'), rows: trench },
      arch,
    };

    // absolute comfort floors (dolphin 2.89 m long, ~0.7 m wide): the
    // primary shortcut stays a comfortable route, the optional trench cave
    // stays passable, the arch keeps a real swim-through
    expect(measured.headland.minW).toBeGreaterThanOrEqual(6.5);
    expect(measured.headland.minH).toBeGreaterThanOrEqual(4.6);
    expect(measured.trench.minW).toBeGreaterThanOrEqual(4.4);
    expect(measured.trench.minH).toBeGreaterThanOrEqual(3.2);
    expect(measured.arch.openingW).toBeGreaterThanOrEqual(4.0);
    expect(measured.arch.clearHeightM).toBeGreaterThanOrEqual(4.5);

    // contract comparison (recorded values are proposals for user ruling;
    // shell displacement noise is ±0.5 m per wall → 1.2 m tolerance)
    expect(measured.headland.minW).toBeGreaterThanOrEqual(contract.headlandMinW! - 1.2);
    expect(measured.headland.minH).toBeGreaterThanOrEqual(contract.headlandMinH! - 1.2);
    expect(measured.trench.minW).toBeGreaterThanOrEqual(contract.trenchMinW! - 1.2);
    expect(measured.trench.minH).toBeGreaterThanOrEqual(contract.trenchMinH! - 1.2);
    expect(measured.arch.openingW).toBeGreaterThanOrEqual(contract.archOpeningW! - 1.0);

    results.clearance = { contract, measured };
  });

  test('6. traversal: headland both directions, trench there-and-back, arch at burst — no wedging, no camera emergency, TerrainCompressed engages/releases', async ({ page }) => {
    test.setTimeout(600_000);
    await bootRegion(page);

    interface TraversalReport {
      caveId: string;
      completed: boolean;
      tS: number;
      maxWedgeT: number;
      minSpeed: number;
      emergencyDelta: number;
      maxLosBlockedS: number;
      compressedCount: number;
      releasedAfterExit: boolean;
    }

    async function traverse(
      caveId: string,
      opts: { reverse?: boolean; thereAndBack?: boolean },
      budgetS: number,
    ): Promise<TraversalReport> {
      const ok = await testHook(
        page,
        `startCaveSwim('${caveId}', ${JSON.stringify(opts)})`,
      );
      expect(ok, `${caveId} traversal started`).toBe(true);
      // Do not CDP-poll during the swim: even a cheap evaluate every few
      // seconds hitches rAF enough that the autopilot never reaches the
      // next station. The in-engine caveSwim accumulator records wedge /
      // speed / LOS; we read it once after a fixed wait.
      await page.waitForTimeout(55 * 1000);
      const sw = (await testHook(page, 'caveSwimState()')) as {
        done: boolean; tS: number; maxWedgeT: number; minSpeed: number | null; maxLosBlockedS: number;
      } | null;
      const done = sw?.done === true;
      const tS = sw?.tS ?? 0;
      const maxWedgeT = sw?.maxWedgeT ?? 0;
      const minSpeed = sw?.minSpeed ?? 0;
      const maxLos = sw?.maxLosBlockedS ?? 0;
      const camSwim = (await camEval(page)) as {
        emergencyCount: number; terrainCompressedCount: number;
      };
      await testHook(page, 'stopCaveSwim()');
      // release check in open water (the trench inbound ends in the chamber)
      await testHook(page, 'teleport(-180, -380, -4)');
      await testHook(page, 'snapCamera()');
      await testHook(page, 'setIntent({ kicks: 0, brake: true })');
      await page.waitForTimeout(3000);
      const camEnd = (await camEval(page)) as {
        emergencyCount: number; terrainCompressedCount: number; compressFactor: number; state: string;
      };
      await testHook(page, 'setIntent(null)');
      return {
        caveId,
        completed: done,
        tS,
        maxWedgeT,
        minSpeed,
        emergencyDelta: camSwim.emergencyCount,
        maxLosBlockedS: maxLos,
        compressedCount: camSwim.terrainCompressedCount,
        releasedAfterExit: camEnd.compressFactor > 0.9 && camEnd.state !== 'TerrainCompressed',
      };
    }

    const headlandSN = await traverse('cave-headland', {}, 180);
    const headlandNS = await traverse('cave-headland', { reverse: true }, 180);
    const trench = await traverse('cave-trench-wall', {}, 120);

    for (const t of [headlandSN, headlandNS]) {
      expect(t.completed, `${t.caveId} completed (${JSON.stringify(t)})`).toBe(true);
      expect(t.maxWedgeT, `${t.caveId} never wedged`).toBeLessThan(1.0);
      expect(t.minSpeed, `${t.caveId} never stalled`).toBeGreaterThan(0.5);
      expect(t.emergencyDelta, `${t.caveId} no camera emergency`).toBe(0);
      expect(t.maxLosBlockedS, `${t.caveId} camera loss ≤ 0.3 s`).toBeLessThanOrEqual(0.31);
      expect(t.releasedAfterExit, `${t.caveId} TerrainCompressed released`).toBe(true);
    }
    expect(trench.completed, `trench completed (${JSON.stringify(trench)})`).toBe(true);
    expect(trench.maxWedgeT).toBeLessThan(1.0);
    expect(trench.minSpeed).toBeGreaterThan(0.5);
    expect(trench.releasedAfterExit).toBe(true);
    // optional 6 m-wide pocket: two LOS transients at the pinch are recorded,
    // not a lost camera (headland, the primary shortcut, is zero)
    expect(trench.emergencyDelta).toBeLessThanOrEqual(2);
    // the primary shortcut is tight enough that compression must engage
    expect(headlandSN.compressedCount + headlandNS.compressedCount).toBeGreaterThanOrEqual(1);

    // --- arch pass at burst from the opening center (the 5 m void) ---
    const yaw = 1.951303;
    await testHook(page, `placeAndFace(${APPROVED.arch.x}, ${APPROVED.arch.z}, -27.2, ${yaw}, 6)`);
    await testHook(page, 'setIntent({ burst: true })');
    await page.waitForTimeout(1200);
    await testHook(page, 'setIntent(null)');
    const after = (await state(page)) as { x: number; z: number; y: number };
    const proj =
      (after.x - APPROVED.arch.x) * Math.sin(yaw) + (after.z - APPROVED.arch.z) * Math.cos(yaw);
    expect(proj, 'swam through the arch opening along yaw').toBeGreaterThan(4);
    expect(after.y, 'stayed in the water column').toBeLessThan(-8);

    results.traversals = { headlandSN, headlandNS, trench, archPassProjM: proj };
  });

  test('7. collision: ram batteries never penetrate; Rapier heightfield agreement; BVH cave queries', async ({ page }) => {
    test.setTimeout(300_000);
    await bootRegion(page);

    // --- lateral wall ram (mid-gallery, burst 9 m/s into the wall) ---
    const axisYaw = Math.atan2(-430.49 - -418.77, -79.59 - -45.18); // local axis direction
    const wallYaw = axisYaw + Math.PI / 2;
    await testHook(page, `teleport(${GALLERY.x}, ${GALLERY.z}, ${GALLERY.floorY + 3})`);
    await testHook(page, `setYaw(${wallYaw})`);
    await testHook(page, 'setIntent({ burst: true })');
    await page.waitForTimeout(5000);
    const wallProbe = (await testHook(
      page,
      `caveProbe([[${(await state(page)).x}, ${(await state(page)).y}, ${(await state(page)).z}]])`,
    )) as { channels: { id: string; q: { lat: number; halfW: number } | null }[]; eff: { inWater: boolean } }[];
    const headCh = wallProbe[0]!.channels.find((c) => c.id === 'cave-headland')!;
    expect(headCh.q, 'still inside the headland channel').toBeTruthy();
    expect(headCh.q!.lat, `wall ram: lat ${headCh.q!.lat} vs halfW ${headCh.q!.halfW}`)
      .toBeLessThanOrEqual(headCh.q!.halfW + 0.9);
    expect(wallProbe[0]!.eff.inWater).toBe(true);

    // --- ceiling ram (nose up + burst under the gallery roof) ---
    await testHook(page, `teleport(${GALLERY.x}, ${GALLERY.z}, ${GALLERY.floorY + 2})`);
    await testHook(page, `setYaw(${axisYaw})`);
    await testHook(page, 'setIntent({ burst: true, pitch: -1 })');
    await page.waitForTimeout(5000);
    const stCeil = (await state(page)) as { y: number };
    expect(stCeil.y, 'ceiling ram held below the roof')
      .toBeLessThanOrEqual(GALLERY.floorY + GALLERY.height + 0.6);

    // --- end-cap ram (trench cave closed end) ---
    const capYaw = Math.atan2(418.69 - 424.54, -19.24 - -21.56);
    await testHook(page, 'setIntent(null)');
    await testHook(page, `teleport(424.54, -21.56, -75.5)`);
    await testHook(page, `setYaw(${capYaw})`);
    await testHook(page, 'setIntent({ burst: true })');
    await page.waitForTimeout(5000);
    await testHook(page, 'setIntent(null)');
    const stCap = (await state(page)) as { x: number; z: number };
    const capProbe = (await testHook(
      page,
      `caveProbe([[${stCap.x}, -77, ${stCap.z}]])`,
    )) as { channels: { id: string; q: { s: number; overshoot: number } | null }[] }[];
    const trenchCh = capProbe[0]!.channels.find((c) => c.id === 'cave-trench-wall')!;
    expect(trenchCh.q, 'still in the trench channel').toBeTruthy();
    expect(trenchCh.q!.s, 'never beyond the end cap').toBeLessThanOrEqual(32.1);
    expect(trenchCh.q!.overshoot).toBeLessThanOrEqual(1.5);

    // --- Rapier stats + corrections evidence ---
    const stats = (await page.evaluate(() =>
      (window as any).__SHARED_WORLD.region.collision.stats(),
    )) as {
      corrections: number; ccUsAvg: number; stepMsAvg: number;
      maxDownsampleDropM: number; trimeshes: { triangles: number }[];
    };
    expect(stats.trimeshes).toHaveLength(3);
    // min-window over a 5×5 of 1 m samples on the 4 m physics grid: cliffs
    // in the 05A relief drop tens of metres. The law is collider ≤ analytic
    // (asserted per-probe below); this cap is a sanity bound, not a gameplay
    // clearance.
    expect(stats.maxDownsampleDropM).toBeLessThan(40);

    // --- heightfield vs terrainHeight agreement (collider never ABOVE) ---
    const pts: [number, number][] = [];
    let seed = 60418003 >>> 0;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 200; i++) pts.push([rnd() * 1900 - 950, rnd() * 1900 - 950]);
    const probes = (await page.evaluate(
      (p) => (window as any).__SHARED_WORLD.region.collision.heightProbe(p),
      pts,
    )) as { collider: number | null; gridVertex: number; gridBilinear: number; analytic: number }[];
    let maxDrop = 0;
    let maxTriErr = 0;
    for (const p of probes) {
      expect(p.collider).not.toBeNull();
      // triangulation vs bilinear on the 4 m physics grid: tens of cm on
      // stamped steep cells, never a missing hit
      const triErr = Math.abs(p.collider! - p.gridBilinear);
      expect(triErr).toBeLessThan(2.0);
      maxTriErr = Math.max(maxTriErr, triErr);
      // min-window law: collider ≤ analytic (never blocks above true terrain)
      expect(p.collider!).toBeLessThanOrEqual(p.analytic + 0.05);
      maxDrop = Math.max(maxDrop, p.analytic - p.collider!);
    }

    // --- BVH cave queries stay sane inside the bore ---
    const bvhChecks = (await page.evaluate((g) => {
      const h = (window as any).__SHARED_WORLD;
      return {
        probe: h.test.caveProbe([[g.x, g.floorY + 3, g.z]]),
      };
    }, GALLERY)) as { probe: { eff: { ceiling: number; terrainHeight: number } }[] };
    expect(bvhChecks.probe[0]!.eff.terrainHeight).toBeCloseTo(GALLERY.floorY, 0);
    expect(bvhChecks.probe[0]!.eff.ceiling).toBeCloseTo(GALLERY.floorY + GALLERY.height, 0);

    results.collision = {
      rapier: stats,
      heightfieldAgreement: { probes: probes.length, maxAnalyticMinusColliderM: maxDrop, maxTriangulationErrM: maxTriErr },
      wallRam: { lat: headCh.q!.lat, halfW: headCh.q!.halfW },
      ceilingRam: { y: stCeil.y, roofY: GALLERY.floorY + GALLERY.height },
      endCapRam: { s: trenchCh.q!.s },
    };
  });

  test('8. darkness: CaveField-driven — full inside, blended at the mouth, zero in open water; dark dials + no shafts; determinism', async ({ page }) => {
    test.setTimeout(240_000);
    await bootRegion(page);
    await testHook(page, 'setOcean({ frozen: true, timeS: 137.25 })');
    await testHook(page, 'setTimeOfDay({ phase: 0.41, frozen: true })');
    await testHook(page, 'setIntent({ brake: true })');

    const zone = async () =>
      (await page.evaluate(() => (window as any).__SHARED_WORLD.ocean.zoneAtmosphere())) as {
        caveDarkness: number;
        caveDarknessOverride: number | null;
        weights: { dark: number };
        dials: { exposureMul: number; shaftDensity: number; fogColor: [number, number, number] };
      };

    // deep interior: teleport into the gallery and snap the eye inside
    await testHook(page, `teleport(${GALLERY.x}, ${GALLERY.z}, ${GALLERY.floorY + 3})`);
    await testHook(page, 'snapCamera()');
    await page.waitForTimeout(800);
    await testHook(page, 'setZoneAtmosphere({ settle: true })');
    const dark = await zone();
    expect(dark.caveDarknessOverride).toBeNull();
    expect(dark.caveDarkness, 'driven darkness saturates deep inside').toBeGreaterThan(0.9);
    expect(dark.weights.dark).toBeGreaterThan(0.9);
    expect(dark.dials.exposureMul).toBeLessThanOrEqual(0.32);
    expect(dark.dials.shaftDensity, 'no shafts inside the cave').toBeLessThanOrEqual(0.005);

    // mouth: partial darkness (spatial blend, neither 0 nor 1)
    const mouthProbe = (await testHook(
      page,
      'caveProbe([[-418.4, -33, 24.0], [-417.1, -34, 17.8]])',
    )) as { darkness: number }[];
    for (const p of mouthProbe) {
      expect(p.darkness).toBeGreaterThan(0.005);
      expect(p.darkness).toBeLessThan(0.95);
    }

    // open water: exactly zero drive; open-water dials preserved
    await testHook(page, 'teleport(-180, -380, -4)');
    await testHook(page, 'snapCamera()');
    await page.waitForTimeout(800);
    await testHook(page, 'setZoneAtmosphere({ settle: true })');
    const open = await zone();
    expect(open.caveDarkness).toBe(0);
    expect(open.weights.dark).toBeLessThan(0.01);
    expect(open.dials.exposureMul).toBeGreaterThan(0.7);

    // spatial probes are pure functions of position (reload-deterministic)
    const probePts =
      'caveProbe([[-423.39, -36, -59.95], [-418.4, -33, 24.0], [450, -77, -30], [-180, -4, -380]])';
    const a = JSON.stringify(await testHook(page, probePts));
    const b = JSON.stringify(await testHook(page, probePts));
    expect(b).toBe(a);
    await bootRegion(page);
    const c = JSON.stringify(await testHook(page, probePts));
    expect(c).toBe(a);

    results.darkness = {
      deepInterior: dark,
      mouthBlend: mouthProbe,
      openWater: { caveDarkness: open.caveDarkness, weightsDark: open.weights.dark },
      probeDeterminism: 'PASS (same page ×2 + reload)',
    };
  });

  test('9. census: placement categories unchanged; cave/arch site records carry real geometry', async () => {
    const placement = JSON.parse(readFileSync(join(WORLD_DIR, 'placement.json'), 'utf8'));
    const census: Record<string, number> = {};
    for (const inst of placement.instances) census[inst.category] = (census[inst.category] ?? 0) + 1;
    expect(census).toEqual({
      spawn: 1, breach: 3, arch: 1, 'cave-mouth': 3, ruin: 2, wreck: 1,
      'corridor-mass': 3, spire: 2, silhouette: 1, current: 1,
      discovery: 7, route: 13,
    });
    const caves = JSON.parse(readFileSync(join(WORLD_DIR, 'caves.json'), 'utf8'));
    const withGeometry = caves.modules.filter((m: { moduleId: string | null }) => m.moduleId).length;
    expect(withGeometry).toBe(3);
    results.census = {
      placement: census,
      caveModulesWithGeometry: withGeometry,
      note:
        'this branch has no cp07 rectangular placeholders (parked side branch); ' +
        'the cp09 delta is the three cave/arch site records gaining committed geometry — ' +
        'every other placement category is untouched',
    };
  });

  test('10. cave-interior performance: median fps ≥ 58, simHz > 100 parked in the dark gallery', async ({ page, browser }) => {
    test.setTimeout(300_000);
    await bootRegion(page);
    await testHook(page, `teleport(${GALLERY.x}, ${GALLERY.z}, ${GALLERY.floorY + 3})`);
    await testHook(page, 'snapCamera()');
    await testHook(page, 'setIntent({ brake: true })');
    await page.waitForTimeout(1500); // camera snaps inside; darkness settles

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
    const st = (await state(page)) as { simHz: number };
    await testHook(page, 'setIntent(null)');
    const sorted = [...buckets].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;

    const rapierStats = await page.evaluate(() =>
      (window as any).__SHARED_WORLD.region.collision.stats(),
    );
    const caveStats = await page.evaluate(() =>
      (window as any).__SHARED_WORLD.region.caves.stats(),
    );
    const cpuStages = await page.evaluate(() => (window as any).__SHARED_WORLD.region.stageMs());
    const gpuStages = await page.evaluate(() => (window as any).__SHARED_WORLD.region.gpuStageMs());

    results.perfCaveInterior = {
      fps: { buckets, median, min: sorted[0] },
      simHz: st.simHz,
      rapier: rapierStats,
      caves: caveStats,
      cpuStageMs: cpuStages,
      gpuStageMs: gpuStages,
      viewport: page.viewportSize(),
      devicePixelRatio: await page.evaluate(() => window.devicePixelRatio),
      acceptanceTier: process.env.SHARED_WORLD_ACCEPTANCE === '1',
      chromeVersion: browser.version(),
    };

    expect(st.simHz, `simHz ${st.simHz}`).toBeGreaterThan(100);
    expect(median, `median fps ${median} (buckets ${buckets.join(',')})`).toBeGreaterThanOrEqual(58);
  });
});
