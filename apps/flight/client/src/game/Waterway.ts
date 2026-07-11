import { Quaternion, Vector3 } from "three";
import { isLand, isMainOcean } from "./SimplexNoise";
import { tangentFrame, moveOnSphere } from "./SphericalMath";

/**
 * BodyArcade Rowing: the waterway seam.
 *
 * The globe has no rivers — terrain is a land/ocean field — so v1 generates
 * a procedural open-water course: a polyline of unit normals walked across
 * the ocean from the boat's spawn, steering around coasts. Full Assist and
 * the closed-loop eval consume only the `Waterway` interface; the future
 * open-data pipeline swaps in real waterway centerlines (rivers ARE
 * polylines) without touching rowing logic. Deterministic for a given
 * world seed + start pose.
 */

export interface WaterwaySample {
  /** the queried position itself is on water */
  onWater: boolean;
  /** course direction (heading, rad, 0 = north) at the nearest point */
  courseHeading: number;
  /** course direction ~0.5 wu further along the line — Full Assist brakes
   *  into corners the boat cannot follow at speed (coxswain behavior) */
  aheadHeading: number;
  /** signed cross-track distance in world units; + = right of course */
  crossTrack: number;
  /** arc position along the course (world units) — progress metric */
  along: number;
}

export interface Waterway {
  sample(q: Quaternion): WaterwaySample;
  /** course waypoints as unit normals (debug / specs) */
  readonly points: readonly Vector3[];
}

/** Step between generated waypoints (radians of arc). */
const WAYPOINT_STEP = 0.05;
/** Course length in radians (~2.5 laps of usable water at boat speeds). */
const COURSE_ARC = 12;
/** Lookahead probes when steering the generator around land. */
const PROBE_STEPS = 6;
const PROBE_STEP_ARC = 0.05;
/** Candidate heading offsets, preferring the straightest path. */
const HEADING_OFFSETS = [0, 0.15, -0.15, 0.35, -0.35, 0.6, -0.6, 1.0, -1.0, 1.5, -1.5, Math.PI / 2, -Math.PI / 2];

function upOf(q: Quaternion, out: Vector3): Vector3 {
  return out.set(0, 1, 0).applyQuaternion(q).normalize();
}

/** Heading (0 = north) of unit-tangent direction `dir` at position q. */
function headingOfDirection(q: Quaternion, dir: Vector3): number {
  const f = tangentFrame(q);
  return Math.atan2(dir.dot(f.east), dir.dot(f.north));
}

export function createOceanCourse(
  seed: number,
  terrainType: string,
  startQ: Quaternion,
  startHeading: number,
  globeRadius: number,
): Waterway {
  // --- generate: walk the sphere, steer to stay on water -------------------
  const points: Vector3[] = [];
  let q = startQ.clone();
  let heading = startHeading;
  const scratch = new Vector3();
  points.push(upOf(q, new Vector3()));

  const probeClear = (fromQ: Quaternion, h: number): boolean => {
    let p = fromQ;
    for (let i = 0; i < PROBE_STEPS; i++) {
      p = moveOnSphere(p, h, PROBE_STEP_ARC);
      const u = upOf(p, scratch);
      if (isLand(seed, terrainType, u.x, u.y, u.z)) return false;
    }
    return true;
  };
  // The course must be a CHANNEL, not a hairline: a centerline-only course
  // hugs coasts, and a fast boat swinging through corners clips the island
  // edges lining it (measured: contact/drag events slowed exactly the
  // fast cadence segments and inverted the speed<->rate correlation).
  const LATERAL_ARC = 0.025; // ~0.125 wu of bank clearance each side at R=5
  const probeClearWide = (fromQ: Quaternion, h: number): boolean =>
    probeClear(fromQ, h) &&
    probeClear(moveOnSphere(fromQ, h + Math.PI / 2, LATERAL_ARC), h) &&
    probeClear(moveOnSphere(fromQ, h - Math.PI / 2, LATERAL_ARC), h);

  // How far (in probe steps) a candidate heading stays channel-clear —
  // the course should route through OPEN water, not thread the first
  // available island gap (measured: gap-threading courses forced the
  // Full-Assist boat down to ~0.1 speed through the twisty sections,
  // which is exactly the "rhythmic 2-minute run" failing live).
  const LOOKAHEAD_STEPS = 12;
  const clearDistance = (fromQ: Quaternion, h: number): number => {
    let p = fromQ;
    for (let i = 0; i < LOOKAHEAD_STEPS; i++) {
      p = moveOnSphere(p, h, PROBE_STEP_ARC);
      const u = upOf(p, scratch);
      if (isLand(seed, terrainType, u.x, u.y, u.z)) return i;
      const l = upOf(moveOnSphere(p, h + Math.PI / 2, 0.025), scratch);
      if (isLand(seed, terrainType, l.x, l.y, l.z)) return i;
      const r = upOf(moveOnSphere(p, h - Math.PI / 2, 0.025), scratch);
      if (isLand(seed, terrainType, r.x, r.y, r.z)) return i;
    }
    return LOOKAHEAD_STEPS;
  };

  const steps = Math.round(COURSE_ARC / WAYPOINT_STEP);
  for (let i = 0; i < steps; i++) {
    // pick the most-open direction, biased toward going straight
    let chosen: number | null = null;
    let bestScore = -Infinity;
    for (const off of HEADING_OFFSETS) {
      const d = clearDistance(q, heading + off);
      if (d < PROBE_STEPS) continue; // must at least be channel-clear nearby
      const score = d - Math.abs(off) * 2.5;
      if (score > bestScore) {
        bestScore = score;
        chosen = heading + off;
      }
    }
    if (chosen === null) {
      // no channel-width path: fall back to a centerline-only candidate
      // (a tight course beats a dead end in a narrow strait)
      for (const off of HEADING_OFFSETS) {
        if (probeClear(q, heading + off)) {
          chosen = heading + off;
          break;
        }
      }
    }
    // fully boxed in (tiny lake): stop extending — the course is what it is
    if (chosen === null) break;
    heading = chosen;
    q = moveOnSphere(q, heading, WAYPOINT_STEP);
    points.push(upOf(q, new Vector3()));
  }

  // Smooth the polyline: the open-water scoring flips between candidate
  // offsets step to step, and the resulting wiggle made the corner brake
  // read phantom bends at every position (measured: fast cadences pinned
  // at ~0.1 speed by their own coxswain). Two passes of 3-point averaging.
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i + 1 < points.length; i++) {
      points[i]!
        .multiplyScalar(2)
        .add(points[i - 1]!)
        .add(points[i + 1]!)
        .normalize();
    }
  }

  // --- sample: nearest point on the polyline -------------------------------
  const segNormals: Vector3[] = []; // A×B per segment (great-circle plane normal)
  for (let i = 0; i + 1 < points.length; i++) {
    segNormals.push(new Vector3().crossVectors(points[i]!, points[i + 1]!).normalize());
  }
  const segArc: number[] = [];
  let acc = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    segArc.push(acc);
    acc += points[i]!.angleTo(points[i + 1]!);
  }

  const p = new Vector3();
  const proj = new Vector3();
  const dir = new Vector3();

  return {
    points,
    sample(posQ: Quaternion): WaterwaySample {
      upOf(posQ, p);
      const onWater = !isLand(seed, terrainType, p.x, p.y, p.z);

      let best = Infinity;
      let bestI = 0;
      let bestT = 0;
      const bestPoint = proj.clone();
      for (let i = 0; i + 1 < points.length; i++) {
        const a = points[i]!;
        const b = points[i + 1]!;
        // project p onto the segment's great-circle plane, clamp to [a, b]
        const n = segNormals[i]!;
        proj.copy(p).addScaledVector(n, -p.dot(n)).normalize();
        // clamp: express the projection between a and b via angles
        const angAB = a.angleTo(b);
        const angA = a.angleTo(proj);
        const angB = b.angleTo(proj);
        let t: number;
        if (angA + angB > angAB + 1e-6) {
          t = angA < angB ? 0 : 1;
          proj.copy(t === 0 ? a : b);
        } else {
          t = angAB > 1e-9 ? angA / angAB : 0;
        }
        const d = proj.angleTo(p);
        if (d < best) {
          best = d;
          bestI = i;
          bestT = t;
          bestPoint.copy(proj);
        }
      }

      // signed side: + when p is on the right of travel (A→B, n = A×B points left-up?)
      const n = segNormals[bestI]!;
      const side = Math.sign(p.dot(n)) || 1;
      // course direction at the nearest point: tangent along the segment
      const a = points[bestI]!;
      const b = points[bestI + 1]!;
      dir.copy(b).addScaledVector(a, -Math.cos(a.angleTo(b))).normalize();
      // heading measured at the boat's own position (close enough to the line)
      const courseHeading = headingOfDirection(posQ, dir);

      // lookahead: CHORD bearing to the polyline point ~0.8 wu ahead —
      // a local segment tangent reads residual wiggle as phantom corners
      let aheadArc = 0.8 / globeRadius;
      let ai = bestI;
      let remaining = (1 - bestT) * points[bestI]!.angleTo(points[bestI + 1]!);
      while (aheadArc > remaining && ai + 2 < points.length) {
        aheadArc -= remaining;
        ai += 1;
        remaining = points[ai]!.angleTo(points[ai + 1]!);
      }
      const aheadPoint = points[Math.min(ai + 1, points.length - 1)]!;
      dir.copy(aheadPoint).addScaledVector(p, -p.dot(aheadPoint)).normalize();
      const aheadHeading = headingOfDirection(posQ, dir);

      return {
        onWater,
        courseHeading,
        aheadHeading,
        // n = A×B; p·n > 0 means p is on the LEFT of travel — flip for "+ = right"
        crossTrack: -side * best * globeRadius,
        along: (segArc[bestI]! + bestT * a.angleTo(b)) * globeRadius,
      };
    },
  };
}

const angDiff = (a: number, b: number): number => {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};

/**
 * Full-Assist steering correction: a gentle turn-rate bias toward the
 * course. Cross-track pulls the desired heading back to the line (capped
 * at ~60°), heading error converts to turn rate. Soft — the user's own
 * steering rides on top and always wins at full deflection.
 */
export function assistTurnRate(s: WaterwaySample, currentHeading: number, globeRadius: number): number {
  // + crossTrack = right of course → aim left of the course direction
  const pull = Math.max(-1, Math.min(1, s.crossTrack / (0.35 * globeRadius)));
  const desired = s.courseHeading - pull * 1.05; // up to ~60° back toward the line
  const err = angDiff(desired, currentHeading);
  return Math.max(-0.55, Math.min(0.55, err * 0.9));
}

/** Fraction of the probe arc that is clear water: 1 = fully clear.
 *  Shared by ShoreGuard and the __FLIGHT diagnostic handle (specs use it
 *  to find a shoreline to aim at deterministically). */
export function clearWaterFrac(
  seed: number,
  terrainType: string,
  posQ: Quaternion,
  heading: number,
  arc: number,
): number {
  const STEPS = 5;
  const u = new Vector3();
  for (let i = 1; i <= STEPS; i++) {
    const p = moveOnSphere(posQ, heading, (arc * i) / STEPS);
    upOf(p, u);
    if (isLand(seed, terrainType, u.x, u.y, u.z)) return (i - 1) / STEPS;
  }
  return 1;
}

export interface ShoreSteer {
  /** additive turn-rate bias (+ = left, the keyboard sign convention) */
  turnBias: number;
  /** 0 (heading is clear) … 1 (land imminent on the current heading) */
  hazard: number;
  /** an escape is in progress (held side active) — course-follow must
   *  yield or it steers the boat straight back into the island it just
   *  left (measured: a permanent oscillation trap at speed ~0) */
  escaping: boolean;
  /** seconds until the bow reaches land on the current heading at the
   *  current speed (Infinity when clear) — braking keys on TIME margin,
   *  not probe fraction: a speed-scaled probe made faster boats see more
   *  hazard and suppressed exactly the fast cadences (measured) */
  ttlS: number;
}

/**
 * GATE-2 addition: ShoreGuard — the smallest robust shoreline avoidance.
 * Lookahead probes (never reaction-after-penetration): the straight-ahead
 * path is sampled ~1.7 s of travel out; if land appears, a turn bias
 * toward the clearer side ramps with proximity, and near-imminent land
 * additionally sheds way (Game applies gentle drag — soften, don't snap).
 * The chosen escape side is HELD for 1.5 s so opposing probes can't
 * oscillate the helm in a cove (the NPC-boat land-escape lesson). Runs on
 * the rowing/autopilot path only — keyboard steering keeps upstream feel —
 * and Game scales it by assist level and by way through the water, so a
 * resting boat is never spun by its own safety net.
 */
export class ShoreGuard {
  private heldSign = 0;
  private heldUntilMs = 0;
  private contactUntilMs = 0;
  private contactUp: Vector3 | null = null;

  constructor(
    private seed: number,
    private terrainType: string,
    private globeRadius: number,
  ) {}

  private clearFrac(posQ: Quaternion, heading: number, arc: number): number {
    return clearWaterFrac(this.seed, this.terrainType, posQ, heading, arc);
  }

  steer(
    posQ: Quaternion,
    heading: number,
    speed: number,
    nowMs: number,
    blocked = false,
  ): ShoreSteer {
    // probe ~1.7 s of travel ahead; even a drifting boat probes a minimum
    const arc = (Math.max(speed, 0.08) * 1.7) / this.globeRadius;
    const ahead = this.clearFrac(posQ, heading, arc);
    // TTL from a FIXED 0.9 wu probe: the steering probe scales with speed,
    // so deriving time from it cancels the speed term (ttl = clearFrac ×
    // 1.7 s at ANY speed — measured strangling every cadence once drag
    // keyed on it). Fixed distance / current speed = real time margin.
    const FIXED_PROBE_WU = 0.9;
    const fixedClear = this.clearFrac(posQ, heading, FIXED_PROBE_WU / this.globeRadius);
    const ttlS =
      fixedClear >= 1 ? Infinity : (fixedClear * FIXED_PROBE_WU) / Math.max(speed, 0.05);

    // CONTACT LATCH (measured trap): a land sliver narrower than the probe
    // spacing can block the hull while every probe reads clear water — the
    // guard then sees no hazard, course-follow steers the freed bow straight
    // back into the sliver, and the boat wiggles in place forever. When the
    // movement gate actually rejects a step, latch an escape: pick the side
    // from wide BEAM probes at a fixed short arc (slivers are local — the
    // forward cone is exactly what cannot see them), hold it for 2.5 s, and
    // release only once the hull has genuinely displaced away with a clear
    // bow. Renewed on every blocked frame, so a still-pinned boat keeps its
    // escape until it is truly free.
    const CONTACT_HOLD_MS = 2500;
    const CONTACT_FREE_WU = 0.12;
    if (blocked) {
      if (nowMs >= this.contactUntilMs) {
        const beamArc = 0.5 / this.globeRadius;
        const left =
          this.clearFrac(posQ, heading + 0.9, beamArc) +
          this.clearFrac(posQ, heading + 1.6, beamArc);
        const right =
          this.clearFrac(posQ, heading - 0.9, beamArc) +
          this.clearFrac(posQ, heading - 1.6, beamArc);
        this.heldSign = left >= right ? 1 : -1;
        this.contactUp = new Vector3();
        upOf(posQ, this.contactUp);
      }
      this.contactUntilMs = nowMs + CONTACT_HOLD_MS;
      this.heldUntilMs = nowMs + CONTACT_HOLD_MS;
    } else if (nowMs < this.contactUntilMs && this.contactUp) {
      const u = new Vector3();
      upOf(posQ, u);
      const movedWu =
        Math.acos(Math.max(-1, Math.min(1, u.dot(this.contactUp)))) * this.globeRadius;
      if (movedWu > CONTACT_FREE_WU && ahead >= 1) {
        this.contactUntilMs = 0; // free and clear — release early
        this.contactUp = null;
      }
    }
    if (nowMs < this.contactUntilMs) {
      const hazard = Math.max(1 - ahead, 0.85);
      return { turnBias: this.heldSign * (0.35 + 0.65 * hazard), hazard, escaping: true, ttlS };
    }

    if (ahead >= 1) {
      if (nowMs >= this.heldUntilMs) this.heldSign = 0;
      return { turnBias: 0, hazard: 0, escaping: this.heldSign !== 0, ttlS };
    }
    const hazard = 1 - ahead;

    // escape side: + = left (heading increases). The held side persists
    // WHILE hazard persists (a fixed 1.5 s hold released mid-cove and let
    // opposing probes oscillate the helm against the wall); it releases
    // only after the bow has been clear for the hold window.
    let sign: number;
    if (this.heldSign !== 0) {
      sign = this.heldSign;
    } else {
      const left = this.clearFrac(posQ, heading + 0.55, arc) + this.clearFrac(posQ, heading + 1.1, arc);
      const right = this.clearFrac(posQ, heading - 0.55, arc) + this.clearFrac(posQ, heading - 1.1, arc);
      sign = left >= right ? 1 : -1;
      this.heldSign = sign;
    }
    this.heldUntilMs = nowMs + 1500;
    return { turnBias: sign * (0.35 + 0.65 * hazard), hazard, escaping: true, ttlS };
  }
}
