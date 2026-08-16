// RegionCollision — Checkpoint 09 Rapier volumetric collision (Master §5.3,
// Track B Q20/Table 9): ONE static heightfield collider (the 2049² baked
// field downsampled 513², min-over-window so the collider never stands
// ABOVE the analytic terrain — the deterministic sim's analytic contact
// keeps the dolphin off the true floor first, Rapier is the safety net
// below/beyond it) + one fixed trimesh collider per cave/arch module (the
// SAME committed GLB geometry the renderer and BVH use). The stamped seam
// bands leave the heightfield below every module floor while the module
// skirts drop below the terrain — the two colliders deliberately overlap so
// the dolphin cannot slip through a seam (Q19 collision-continuity law).
//
// The dolphin is a kinematic capsule resolved by Rapier's character
// controller INSIDE the fixed 120 Hz loop, after each deterministic sim
// step: desired movement = the step the sim just took; the controller
// shape-casts it against the static world (no tunneling at any speed) and
// the corrected movement is written back only when something actually
// blocked. In open water the analytic model keeps clearance, so the
// controller is a no-op there; inside caves it is the precise wall/ceiling
// authority over the kit-dressed trimesh. Runs only while phase = 'swim' —
// approved breach/air behavior is untouched.
//
// Determinism: fixed-step call order, pure static world, same WASM binary —
// the correction sequence is a pure function of the sim trajectory. The
// replay digest harness (runScript) intentionally runs the bare sim; live
// wall interactions beyond the analytic model are cp09 content, recorded in
// the checkpoint report.

import type RAPIER_NS from '@dimforge/rapier3d-compat';
import type { WorldData } from '../world/WorldData';
import type { CaveField } from '../world/CaveField';
import type { CaveModuleGeometry } from '../terrain/CavesPass';
import type { SimState } from './sim';

/** physics grid: 2049 → 513 samples per side (stride 4, ~3.9 m cells) */
const PHYS_N = 513;
const STRIDE = 4;
/** capsule ≈ the dolphin body: total length 2·(halfHeight+radius) = 2.9 m */
const CAPSULE_HALF = 1.0;
const CAPSULE_R = 0.45;
/** character-controller skin (the gap it preserves), m */
const CC_OFFSET = 0.05;

export interface RapierStats {
  initMs: number;
  buildMs: number;
  physGridN: number;
  /** max (analytic − collider) over the grid — the recorded downsample drop */
  maxDownsampleDropM: number;
  trimeshes: { id: string; vertices: number; triangles: number }[];
  stepMsAvg: number;
  stepCount: number;
  ccUsAvg: number;
  ccCount: number;
  corrections: number;
  lastCorrectionM: number;
}

export class RegionCollision {
  readonly stats: RapierStats;

  private readonly world: RAPIER_NS.World;
  private readonly controller: RAPIER_NS.KinematicCharacterController;
  private readonly capsule: RAPIER_NS.Collider;
  private readonly hfCollider: RAPIER_NS.Collider;
  private readonly R: typeof RAPIER_NS;
  /** cp09 local omission: heightfield excluded while inside a bore volume */
  private readonly caveField: CaveField | null;
  /** coarse grid (row-major j*PHYS_N+i) for the agreement probes */
  private readonly coarse: Float32Array;
  private readonly sizeM: number;

  private stepMsAcc = 0;
  private ccUsAcc = 0;

  private constructor(
    R: typeof RAPIER_NS,
    data: WorldData,
    caveGeoms: CaveModuleGeometry[],
    caveField: CaveField | null,
    initMs: number,
  ) {
    this.R = R;
    this.caveField = caveField;
    const t0 = performance.now();
    this.sizeM = data.header.sizeMeters[0];
    this.world = new R.World({ x: 0, y: 0, z: 0 }); // static world — no gravity use

    // --- heightfield: min-over-window downsample (collider ≤ analytic) ---
    const n = data.header.artifacts['height.r16']!.resolution!; // 2049
    const heights = new Float32Array(PHYS_N * PHYS_N); // column-major for Rapier
    this.coarse = new Float32Array(PHYS_N * PHYS_N); // row-major mirror (probes)
    let maxDrop = 0;
    for (let r = 0; r < PHYS_N; r++) {
      const j = r * STRIDE;
      for (let c = 0; c < PHYS_N; c++) {
        const i = c * STRIDE;
        let hMin = Infinity;
        for (let dj = -2; dj <= 2; dj++) {
          const jj = Math.min(n - 1, Math.max(0, j + dj));
          const row = jj * n;
          for (let di = -2; di <= 2; di++) {
            const ii = Math.min(n - 1, Math.max(0, i + di));
            const h = data.heights[row + ii]!;
            if (h < hMin) hMin = h;
          }
        }
        const exact = data.heights[j * n + i]!;
        if (exact - hMin > maxDrop) maxDrop = exact - hMin;
        // Rapier heightfield: column-major, columns along X, rows along Z
        heights[c * PHYS_N + r] = hMin;
        this.coarse[r * PHYS_N + c] = hMin;
      }
    }
    const hfDesc = R.ColliderDesc.heightfield(
      PHYS_N - 1,
      PHYS_N - 1,
      heights,
      { x: this.sizeM, y: 1, z: this.sizeM },
    );
    this.hfCollider = this.world.createCollider(hfDesc);

    // --- fixed trimesh per cave/arch module (same committed geometry) ---
    const trimeshes: RapierStats['trimeshes'] = [];
    for (const g of caveGeoms) {
      this.world.createCollider(R.ColliderDesc.trimesh(g.positions, g.indices));
      trimeshes.push({ id: g.id, vertices: g.vertices, triangles: g.triangles });
    }

    // --- the dolphin capsule (parentless kinematic query collider) ---
    this.capsule = this.world.createCollider(
      R.ColliderDesc.capsule(CAPSULE_HALF, CAPSULE_R),
    );
    this.controller = this.world.createCharacterController(CC_OFFSET);
    this.controller.setSlideEnabled(true);

    // Rapier queries the broadphase; a step after inserting static colliders
    // is required before the first castRay (otherwise every probe returns null).
    this.world.step();

    this.stats = {
      initMs,
      buildMs: performance.now() - t0,
      physGridN: PHYS_N,
      maxDownsampleDropM: Math.round(maxDrop * 1e3) / 1e3,
      trimeshes,
      stepMsAvg: 0,
      stepCount: 0,
      ccUsAvg: 0,
      ccCount: 0,
      corrections: 0,
      lastCorrectionM: 0,
    };

    // --- build-time self-check ---
    // 1. Rapier stored the height matrix we submitted (catches axis/order
    //    mistakes). 2. A downward ray at a few sites returns a finite hit
    //    at or below the coarse bilinear surface (the 4 m triangulation can
    //    sit a few tens of cm off a vertex on stamped steep cells — the
    //    0.02 m vertex identity is not a meaningful raycast bound).
    const stored = this.hfCollider.heightfieldHeights();
    if (!stored || stored.length !== PHYS_N * PHYS_N) {
      throw new Error(
        `Rapier heightfield size ${stored?.length ?? 'null'} ≠ ${PHYS_N * PHYS_N}`,
      );
    }
    let maxBufErr = 0;
    for (let k = 0; k < stored.length; k += 997) {
      const err = Math.abs(stored[k]! - heights[k]!);
      if (err > maxBufErr) maxBufErr = err;
    }
    if (maxBufErr > 1e-4) {
      throw new Error(`Rapier heightfield buffer mismatch (max ${maxBufErr} m)`);
    }
    for (const [px, pz] of [
      [0, 0], [500, -500], [-180, -380], [-40, -70],
    ] as [number, number][]) {
      const got = this.raycastHeight(px, pz);
      const grid = this.coarseBilinear(px, pz);
      if (got === null || got > grid + 0.15) {
        throw new Error(
          `Rapier heightfield raycast failed at (${px}, ${pz}): ` +
          `collider ${got}, coarse-bilinear ${grid}`,
        );
      }
    }
  }

  static async create(
    data: WorldData,
    caveGeoms: CaveModuleGeometry[],
    caveField: CaveField | null = null,
  ): Promise<RegionCollision> {
    const t0 = performance.now();
    const R = (await import('@dimforge/rapier3d-compat')).default;
    await R.init();
    const initMs = performance.now() - t0;
    return new RegionCollision(R, data, caveGeoms, caveField, initMs);
  }

  /** nearest coarse-grid VERTEX to (x, z) and its stored height */
  private coarseHeightAtVertex(x: number, z: number): { x: number; z: number; h: number } {
    const cell = this.sizeM / (PHYS_N - 1);
    const i = Math.min(PHYS_N - 1, Math.max(0, Math.round((x + this.sizeM / 2) / cell)));
    const j = Math.min(PHYS_N - 1, Math.max(0, Math.round((z + this.sizeM / 2) / cell)));
    return {
      x: -this.sizeM / 2 + i * cell,
      z: -this.sizeM / 2 + j * cell,
      h: this.coarse[j * PHYS_N + i]!,
    };
  }

  /** downward ray onto the heightfield collider only, → surface y */
  private raycastHeight(x: number, z: number): number | null {
    const ray = new this.R.Ray({ x, y: 250, z }, { x: 0, y: -1, z: 0 });
    // shape-local cast first (no broadphase) — the collider is static at identity
    const toi = this.hfCollider.castRay(ray, 500, true);
    if (toi !== undefined && toi !== null && Number.isFinite(toi) && toi >= 0 && toi < 500) {
      return 250 - toi;
    }
    const hit = this.world.castRay(
      ray, 500, true, undefined, undefined, undefined, undefined,
      (c: RAPIER_NS.Collider) => c.handle === this.hfCollider.handle,
    );
    return hit ? 250 - hit.timeOfImpact : null;
  }

  /** bilinear sample of the physics-grid heights (same cell size as Rapier) */
  private coarseBilinear(x: number, z: number): number {
    const cell = this.sizeM / (PHYS_N - 1);
    const u = Math.min(PHYS_N - 1, Math.max(0, (x + this.sizeM / 2) / cell));
    const v = Math.min(PHYS_N - 1, Math.max(0, (z + this.sizeM / 2) / cell));
    const i0 = Math.min(PHYS_N - 2, Math.floor(u));
    const j0 = Math.min(PHYS_N - 2, Math.floor(v));
    const fu = u - i0;
    const fv = v - j0;
    const g = this.coarse;
    const a = g[j0 * PHYS_N + i0]!;
    const b = g[j0 * PHYS_N + i0 + 1]!;
    const c = g[(j0 + 1) * PHYS_N + i0]!;
    const d = g[(j0 + 1) * PHYS_N + i0 + 1]!;
    return (a * (1 - fu) + b * fu) * (1 - fv) + (c * (1 - fu) + d * fu) * fv;
  }

  /** Rapier-heightfield vs analytic-terrain agreement probe (tests). */
  heightProbe(pts: [number, number][]): {
    x: number; z: number; collider: number | null; gridVertex: number; gridBilinear: number;
  }[] {
    return pts.map(([x, z]) => {
      const v = this.coarseHeightAtVertex(x, z);
      return {
        x: v.x, z: v.z,
        collider: this.raycastHeight(v.x, v.z),
        gridVertex: v.h,
        gridBilinear: this.coarseBilinear(v.x, v.z),
      };
    });
  }

  /**
   * Post-substep dolphin correction (called inside the fixed 120 Hz loop,
   * after sim.step, swim phase only). Shape-casts the step the sim took
   * against the static world; writes back the corrected position and
   * removes the blocked velocity component only when something blocked.
   * Returns true when a correction fired.
   */
  correct(prevX: number, prevY: number, prevZ: number, s: SimState): boolean {
    if (s.phase !== 'swim') return false;
    const dx = s.x - prevX;
    const dy = s.y - prevY;
    const dz = s.z - prevZ;
    const moved2 = dx * dx + dy * dy + dz * dz;
    if (moved2 < 1e-14) return false;

    const t0 = performance.now();
    this.capsule.setTranslation({ x: prevX, y: prevY, z: prevZ });
    this.capsule.setRotation(quatFromYawPitch(s.yaw, s.pitch));
    // cp09 local omission (addendum §9.1): while the capsule is inside a
    // cave bore volume, the (coarser, min-window) heightfield collider is
    // excluded — the module trimesh is the sole authority there, so the
    // physics grid can never wall off a bore the render has opened. The
    // predicate is a pure function of the committed caves.json.
    const inBore =
      this.caveField !== null && this.caveField.insideBore(prevX, prevY, prevZ, 0.6, 1.0);
    const filter = inBore
      ? (c: RAPIER_NS.Collider) => c.handle !== this.hfCollider.handle
      : undefined;
    this.controller.computeColliderMovement(
      this.capsule, { x: dx, y: dy, z: dz }, undefined, undefined, filter,
    );
    const m = this.controller.computedMovement();
    const ex = dx - m.x;
    const ey = dy - m.y;
    const ez = dz - m.z;
    const err = Math.sqrt(ex * ex + ey * ey + ez * ez);
    let corrected = false;
    if (err > 1e-6) {
      s.x = prevX + m.x;
      s.y = prevY + m.y;
      s.z = prevZ + m.z;
      // remove the blocked component of the chase velocity (slide law —
      // the same shape the analytic contact uses)
      const nl = err;
      const nx = ex / nl;
      const ny = ey / nl;
      const nz = ez / nl;
      const vDotN = s.wvx * nx + s.wvy * ny + s.wvz * nz;
      if (vDotN > 0) {
        s.wvx -= nx * vDotN;
        s.wvy -= ny * vDotN;
        s.wvz -= nz * vDotN;
      }
      this.stats.corrections++;
      this.stats.lastCorrectionM = err;
      corrected = true;
    }
    this.capsule.setTranslation({ x: s.x, y: s.y, z: s.z });
    this.ccUsAcc += (performance.now() - t0) * 1000;
    this.stats.ccCount++;
    this.stats.ccUsAvg = this.ccUsAcc / this.stats.ccCount;
    return corrected;
  }

  /** once per frame (bookkeeping + the honest step-cost measurement) */
  step(): void {
    const t0 = performance.now();
    this.world.step();
    this.stepMsAcc += performance.now() - t0;
    this.stats.stepCount++;
    this.stats.stepMsAvg = this.stepMsAcc / this.stats.stepCount;
  }
}

/** quaternion aligning the capsule axis (+Y) to the facing (yaw, pitch) */
function quatFromYawPitch(yaw: number, pitch: number): { x: number; y: number; z: number; w: number } {
  const cp = Math.cos(pitch);
  const fx = Math.sin(yaw) * cp;
  const fy = -Math.sin(pitch);
  const fz = Math.cos(yaw) * cp;
  // rotate (0,1,0) → f: axis = up × f = (fz, 0, −fx), angle = acos(fy)
  const ax = fz;
  const az = -fx;
  const al = Math.hypot(ax, az);
  if (al < 1e-9) {
    // facing ≈ ±up: identity, or 180° about X
    return fy > 0 ? { x: 0, y: 0, z: 0, w: 1 } : { x: 1, y: 0, z: 0, w: 0 };
  }
  const angle = Math.acos(Math.min(Math.max(fy, -1), 1));
  const s = Math.sin(angle / 2);
  return { x: (ax / al) * s, y: 0, z: (az / al) * s, w: Math.cos(angle / 2) };
}
