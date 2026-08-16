// CaveField — Checkpoint 09 analytic cave-interior model (Master §5.3 /
// CP09 §6: "sim-side cave containment stays analytic … inside the 120 Hz
// step"). Pure, deterministic functions of the COMMITTED caves.json runtime
// records (station centerlines baked by bake-region.mjs from the
// hand-authored cave plan). No mesh, no BVH, no Rapier here: this is the
// data the deterministic sim and the zone-atmosphere darkness driver read.
//
// Model: each cave is a channel around its baked station polyline. A query
// point projects onto the polyline → arc-length s, lateral offset lat, and
// interpolated station values (floorY, halfW, height). The interior is the
// box-ish channel |lat| ≤ halfW, floorY ≤ y ≤ floorY + height; the precise
// dome/noise surface is owned by the trimesh (Rapier volumetric collision +
// BVH camera queries) — the analytic field is the deterministic cushion the
// sim steers by, exactly like the shore SDF (walls are water that pushes
// back, Track A F7).
//
// The containment weight w(x,z) ramps 1 → 0 laterally past the wall plane
// and longitudinally past open mouths, so every sampler answer the sim
// consumes (terrainHeight / shoreDistance / inWater / depthAt / ceilingAt)
// blends smoothly between the open-water law and the cave law — no
// thresholds, no pops, replay-stable.

import type { CavesData } from './WorldData';

export interface CaveStationRec {
  s: number;
  x: number;
  z: number;
  floorY: number;
  halfW: number;
  height: number;
}

export interface CaveChannelQuery {
  /** arc-length along the polyline, clamped to [s0, sEnd] */
  s: number;
  /** unsigned lateral distance from the centerline, m */
  lat: number;
  /** axial overshoot past the nearer end (0 when between the end rings) */
  overshoot: number;
  /** interpolated interior values at s */
  floorY: number;
  halfW: number;
  height: number;
  /** containment weight 0..1 (lateral × mouth fades; 2D — the column) */
  w: number;
  /** arc-length distance to the nearest OPEN mouth (endCap end excluded) */
  mouthDist: number;
}

export interface CaveFieldProbe {
  id: string;
  q: CaveChannelQuery | null;
  darkness: number;
}

/** lateral fade band beyond the wall plane, m (wall at halfW; w = 0 by
 *  halfW + LAT_FADE_M — the wall itself acts through the blended sampler
 *  answers plus the trimesh) */
const LAT_FADE_M = 1.5;
/** longitudinal fade past an open mouth, m (w = 0 this far outside) */
const MOUTH_FADE_M = 6;
/** end-cap wall band: the cave shoreDistance ramps to 0 over the last
 *  CAP_BAND_M before a closed end (same soft-wall law as shorelines) */
const CAP_BAND_M = 5;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const sstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

interface Channel {
  id: string;
  stations: CaveStationRec[];
  endCap: boolean;
  darkFullM: number;
  sEnd: number;
}

export class CaveField {
  readonly channels: Channel[] = [];

  constructor(caves: CavesData) {
    for (const m of caves.modules) {
      const rt = m.runtime;
      if (!rt || !rt.stations || rt.stations.length < 2) continue; // the arch has no interior
      this.channels.push({
        id: m.id,
        stations: rt.stations,
        endCap: rt.endCap ?? false,
        darkFullM: rt.darkFullM ?? 0,
        sEnd: rt.stations[rt.stations.length - 1]!.s,
      });
    }
  }

  /** Closest-segment projection of (x, z) onto a channel's polyline. */
  private project(ch: Channel, x: number, z: number): CaveChannelQuery {
    const st = ch.stations;
    let bestD2 = Infinity;
    let bestS = st[0]!.s;
    let bestOver = 0;
    for (let i = 0; i < st.length - 1; i++) {
      const a = st[i]!;
      const b = st[i + 1]!;
      const ex = b.x - a.x;
      const ez = b.z - a.z;
      const len2 = ex * ex + ez * ez || 1e-9;
      const tRaw = ((x - a.x) * ex + (z - a.z) * ez) / len2;
      const t = clamp(tRaw, 0, 1);
      const cx = a.x + ex * t;
      const cz = a.z + ez * t;
      const dx = x - cx;
      const dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) {
        bestD2 = d2;
        bestS = a.s + (b.s - a.s) * t;
        // axial overshoot exists only past the extreme rings
        const segLen = Math.sqrt(len2);
        if (i === 0 && tRaw < 0) bestOver = -tRaw * segLen;
        else if (i === st.length - 2 && tRaw > 1) bestOver = (tRaw - 1) * segLen;
        else bestOver = 0;
      }
    }
    const v = this.stationAt(ch, bestS);
    // lateral distance measured to the clamped closest point; past an end
    // the radial distance splits into axial overshoot + lateral remainder
    const lat = Math.max(0, Math.sqrt(Math.max(0, bestD2 - bestOver * bestOver)));

    // containment weight: 1 inside the wall plane, 0 past the fade bands
    const wLat = 1 - sstep(v.halfW, v.halfW + LAT_FADE_M, lat);
    let wMouth = 1;
    if (bestOver > 0) {
      // past which end? (nearest ring decides; the endCap end is solid rock
      // — fading back to the real land answers there is correct)
      wMouth = 1 - sstep(0, MOUTH_FADE_M, bestOver);
    }
    const w = wLat * wMouth;

    // distance to the nearest OPEN mouth along the bore
    const dS0 = bestS - st[0]!.s + (bestOver > 0 && bestS === st[0]!.s ? -bestOver : 0);
    const dS1 = ch.sEnd - bestS;
    const mouthDist = ch.endCap ? dS0 : Math.min(dS0, dS1);

    return {
      s: bestS,
      lat,
      overshoot: bestOver,
      floorY: v.floorY,
      halfW: v.halfW,
      height: v.height,
      w,
      mouthDist,
    };
  }

  private stationAt(ch: Channel, s: number): { floorY: number; halfW: number; height: number } {
    const st = ch.stations;
    const sc = clamp(s, st[0]!.s, st[st.length - 1]!.s);
    let i = 0;
    while (i < st.length - 2 && st[i + 1]!.s < sc) i++;
    const a = st[i]!;
    const b = st[i + 1]!;
    const t = b.s === a.s ? 0 : (sc - a.s) / (b.s - a.s);
    return {
      floorY: mix(a.floorY, b.floorY, t),
      halfW: mix(a.halfW, b.halfW, t),
      height: mix(a.height, b.height, t),
    };
  }

  /** Strongest channel query at (x, z), or null when every w = 0. */
  queryColumn(x: number, z: number): { ch: Channel; q: CaveChannelQuery } | null {
    let best: { ch: Channel; q: CaveChannelQuery } | null = null;
    for (const ch of this.channels) {
      // cheap reject: outside the polyline AABB inflated by the fade bands
      const q = this.project(ch, x, z);
      if (q.w <= 0) continue;
      if (!best || q.w > best.q.w) best = { ch, q };
    }
    return best;
  }

  // --- sampler answers (consumed by RegionSampler; pure + deterministic) ---

  /** Effective terrain height override: real → cave floor as w → 1. */
  effTerrainHeight(x: number, z: number, realH: number): number {
    const hit = this.queryColumn(x, z);
    if (!hit) return realH;
    return mix(realH, hit.q.floorY, hit.q.w);
  }

  /** Effective in-water: the bore is water even where the mask says land. */
  effInWater(x: number, z: number, realInWater: boolean): boolean {
    if (realInWater) return true;
    const hit = this.queryColumn(x, z);
    return hit !== null && hit.q.w > 0.5;
  }

  /**
   * Effective shore distance: inside the channel the lateral wall (and the
   * end-cap wall) is the "shore" — scaled so the centerline reads a full
   * band (no push) and the wall plane reads 0 (full push): the sim's
   * existing soft-containment current becomes the cave wall cushion.
   */
  effShoreDistance(x: number, z: number, realSd: number, bandM: number): number {
    const hit = this.queryColumn(x, z);
    if (!hit) return realSd;
    const { q, ch } = hit;
    let sd = (1 - clamp(q.lat / Math.max(q.halfW, 0.1), 0, 1)) * bandM;
    if (ch.endCap) {
      const capSd = (clamp((ch.sEnd - q.s) / CAP_BAND_M, 0, 1)) * bandM;
      sd = Math.min(sd, capSd);
    }
    return mix(realSd, sd, q.w);
  }

  /**
   * Water ceiling for the sim's vertical clamp, meters (Infinity = no cave
   * ceiling here — open water). Blends from the surface (0) at the fade
   * edge to the interior ceiling as w → 1.
   */
  effCeiling(x: number, z: number): number {
    const hit = this.queryColumn(x, z);
    if (!hit) return Infinity;
    const ceil = hit.q.floorY + hit.q.height;
    return mix(0, ceil, hit.q.w);
  }

  /**
   * Cave darkness 0..1 at a 3D point (the zone-atmosphere driver input —
   * cp09 §9: genuine darkness inside, saturating darkFullM inside a mouth,
   * spatially local, 0 in open water). Vertical containment keeps darkness
   * out of the water column ABOVE a hood or notch.
   */
  darknessAt(x: number, y: number, z: number): number {
    let dark = 0;
    for (const ch of this.channels) {
      if (ch.darkFullM <= 0) continue;
      const q = this.project(ch, x, z);
      if (q.w <= 0) continue;
      const ceil = q.floorY + q.height;
      const wV =
        sstep(q.floorY - 2, q.floorY + 0.5, y) * (1 - sstep(ceil - 0.5, ceil + 2, y));
      const wDepth = sstep(0, ch.darkFullM, q.mouthDist);
      const d = q.w * wV * wDepth;
      if (d > dark) dark = d;
    }
    return dark;
  }

  /** Full per-channel probe (test/debug surface). */
  probe(x: number, y: number, z: number): CaveFieldProbe[] {
    return this.channels.map((ch) => {
      const q = this.project(ch, x, z);
      return {
        id: ch.id,
        q: q.w > 0 || q.lat < q.halfW + 2 * LAT_FADE_M ? q : null,
        darkness: this.darknessAt(x, y, z),
      };
    });
  }

  // ------------------------------------------------------------------
  // cp09 local heightfield OMISSION (addendum §9.1 "locally lower or
  // omit"): a single-valued terrain sheet must sweep each bore section
  // once near every aperture (measured + recorded by the bake's throat
  // checks). Inside the BORE VOLUME the trimesh is authoritative and the
  // heightfield is omitted by every consumer: terrain fragments discarded
  // (shader), camera-BVH triangles skipped (TerrainBvh), and the Rapier
  // heightfield collider excluded (character controller filter). The
  // volume is derived purely from the committed caves.json stations.
  // ------------------------------------------------------------------

  /** Is (x, y, z) inside a cave bore volume? (lat ≤ halfW + latMargin,
   *  floor − yMargin ≤ y ≤ ceiling + yMargin, within the station span) */
  insideBore(x: number, y: number, z: number, latMargin = 0.3, yMargin = 0.5): boolean {
    for (const ch of this.channels) {
      const q = this.project(ch, x, z);
      if (q.overshoot > 0.5) continue;
      if (q.lat > q.halfW + latMargin) continue;
      const ceil = q.floorY + q.height;
      if (y >= q.floorY - yMargin && y <= ceil + yMargin) return true;
    }
    return false;
  }

  /**
   * Packed bore segments for the terrain-shader discard: per segment the
   * endpoints, floor, halfW and height, plus one inflated XZ AABB per
   * channel for the cheap fragment pre-test. Open-mouth segment ends are
   * trimmed 1.5 m inward (the pipe lip overhang covers the ring; terrain
   * outside the mouth must never be discarded), end-cap ends extend 2 m
   * (the cap dome).
   */
  boreSegments(): {
    segments: {
      x0: number; z0: number; x1: number; z1: number;
      floor0: number; floor1: number;
      halfW0: number; halfW1: number;
      height0: number; height1: number;
    }[];
    boxes: { minX: number; minZ: number; maxX: number; maxZ: number }[];
  } {
    const segments: ReturnType<CaveField['boreSegments']>['segments'] = [];
    const boxes: ReturnType<CaveField['boreSegments']>['boxes'] = [];
    for (const ch of this.channels) {
      const st = ch.stations;
      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (let i = 0; i < st.length - 1; i++) {
        const a = st[i]!;
        const b = st[i + 1]!;
        let ax = a.x;
        let az = a.z;
        let bx = b.x;
        let bz = b.z;
        const ex = bx - ax;
        const ez = bz - az;
        const len = Math.hypot(ex, ez) || 1;
        if (i === 0) {
          // first ring is always an open mouth — trim inward
          ax += (ex / len) * 1.5;
          az += (ez / len) * 1.5;
        }
        if (i === st.length - 2) {
          if (ch.endCap) {
            bx += (ex / len) * 2.0; // cap dome extends past the last ring
            bz += (ez / len) * 2.0;
          } else {
            bx -= (ex / len) * 1.5; // open mouth — trim inward
            bz -= (ez / len) * 1.5;
          }
        }
        segments.push({
          x0: ax, z0: az, x1: bx, z1: bz,
          floor0: a.floorY, floor1: b.floorY,
          halfW0: a.halfW, halfW1: b.halfW,
          height0: a.height, height1: b.height,
        });
        for (const [px, pz, hw] of [
          [ax, az, a.halfW], [bx, bz, b.halfW],
        ] as [number, number, number][]) {
          minX = Math.min(minX, px - hw - 2);
          maxX = Math.max(maxX, px + hw + 2);
          minZ = Math.min(minZ, pz - hw - 2);
          maxZ = Math.max(maxZ, pz + hw + 2);
        }
      }
      boxes.push({ minX, minZ, maxX, maxZ });
    }
    return { segments, boxes };
  }
}
