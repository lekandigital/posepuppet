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

  const steps = Math.round(COURSE_ARC / WAYPOINT_STEP);
  for (let i = 0; i < steps; i++) {
    let chosen: number | null = null;
    for (const off of HEADING_OFFSETS) {
      if (probeClear(q, heading + off)) {
        chosen = heading + off;
        break;
      }
    }
    // fully boxed in (tiny lake): stop extending — the course is what it is
    if (chosen === null) break;
    heading = chosen;
    q = moveOnSphere(q, heading, WAYPOINT_STEP);
    points.push(upOf(q, new Vector3()));
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

      return {
        onWater,
        courseHeading,
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
