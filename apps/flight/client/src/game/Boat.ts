import {
  Group,
  Quaternion,
  type Scene,
} from "three";
import type { Vehicle } from "@globefly/shared";
import {
  buildBoatMatrix,
  moveOnSphere,
  quaternionFromSurfaceNormal,
  seededRandom,
  tangentFrame,
} from "./SphericalMath";
import { createBoat } from "./BoatMesh";
import { isLand, isMainOcean } from "./SimplexNoise";
import { surfaceAltitudeAt } from "./TerrainSurface";

/** Default cruise is deliberately slow; max speed stays modest. */
const CRUISE_SPEED = 0.22;
const BRAKE_DECEL = 0.85;
const ACCEL = 0.35;
const MAX_SPEED = 0.42;
/** Peak speed after collecting a diamond (above normal max). */
const DIAMOND_BOOST_SPEED = 0.58;
const DIAMOND_BOOST_DURATION_SEC = 3;
const ABSOLUTE_MAX_BOOST_SPEED = 0.72;
const COAST_DECAY = 0.07;
const FREEBOARD = 0.015;
/** Yaw rate multiplier — higher = snappier turns. */
const TURN_SCALE = 0.92;
/** Same idea as plane: yaw input eases toward keys/stick (1/s). */
const TURN_INPUT_SMOOTH = 8;

/**
 * Random orientation on the ocean (matches globe land/water via `worldSeed`).
 * `spawnSalt` only affects RNG — must NOT be passed to `isLand`, which keys off world terrain seed.
 */
export function randomOceanQuaternion(
  worldSeed: number,
  terrainType: string,
  spawnSalt: number,
  maxAttempts = 180,
): Quaternion {
  const rnd = seededRandom(spawnSalt + 777);
  for (let i = 0; i < maxAttempts; i++) {
    const theta = rnd() * Math.PI * 2;
    const phi = Math.acos(2 * rnd() - 1);
    const nx = Math.sin(phi) * Math.cos(theta);
    const ny = Math.sin(phi) * Math.sin(theta);
    const nz = Math.cos(phi);
    if (isMainOcean(worldSeed, terrainType, nx, ny, nz)) {
      return quaternionFromSurfaceNormal(nx, ny, nz);
    }
  }
  for (let k = 0; k < 192; k++) {
    const phi = (k / 192) * Math.PI;
    const theta = k * 0.6180339887 * Math.PI * 2;
    const nx = Math.sin(phi) * Math.cos(theta);
    const ny = Math.sin(phi) * Math.sin(theta);
    const nz = Math.cos(phi);
    if (isMainOcean(worldSeed, terrainType, nx, ny, nz)) {
      return quaternionFromSurfaceNormal(nx, ny, nz);
    }
  }
  return findOceanQuaternionExhaustive(worldSeed, terrainType, true);
}

/** Dense Fibonacci sphere search — avoids returning identity (often land). */
function findOceanQuaternionExhaustive(
  worldSeed: number,
  terrainType: string,
  preferMainOcean = false,
): Quaternion {
  const n = 4096;
  const golden = Math.PI * (3 - Math.sqrt(5));
  let fallback: Quaternion | null = null;
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / Math.max(1, n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    const nx = Math.cos(theta) * r;
    const ny = y;
    const nz = Math.sin(theta) * r;
    if (!isLand(worldSeed, terrainType, nx, ny, nz)) {
      if (!preferMainOcean || isMainOcean(worldSeed, terrainType, nx, ny, nz)) {
        return quaternionFromSurfaceNormal(nx, ny, nz);
      }
      if (!fallback) {
        fallback = quaternionFromSurfaceNormal(nx, ny, nz);
      }
    }
  }
  return fallback ?? quaternionFromSurfaceNormal(0, 0, 1);
}

/**
 * BodyArcade Rowing: impulse-and-glide constants. Additive path — the
 * keyboard accel/brake/coast behavior above is untouched (upstream feel is
 * frozen); these only act when the rowing input source drives the boat.
 */
/** Speed added by one full-amplitude stroke. */
const ROW_IMPULSE_SPEED = 0.15;
/** Surge attack: budget is applied at this rate (full stroke ≈ 0.3 s). */
const ROW_SURGE_RATE = 0.5;
/** Rowing tops out at the keyboard max (upgrades still multiply). */
const ROW_MAX_SPEED = MAX_SPEED;
/** Rowing water drag is PROPORTIONAL to speed (τ ≈ 5.5 s): each cadence
 *  settles at its own speed (impulse rate = drag) so the boat reads the
 *  rhythm, and stillness is an exponential drift that never hard-stops.
 *  Keyboard coast keeps the upstream linear COAST_DECAY untouched. */
const ROW_DRAG_PER_S = 0.18;

const BOB_AMPLITUDE = 0.009;
const BOB_SPEED = 2.6;
const PITCH_BOB_AMP = 0.042;
const PITCH_BOB_SPEED = 2.1;
const ROLL_BOB_AMP = 0.05;
const ROLL_BOB_SPEED = 1.55;

export class Boat {
  readonly group: Group;
  readonly vehicle: Vehicle = "boat";
  /** Primary hull color (0xRRGGBB), synced to other players. */
  readonly hullColor: number;

  qPosition = new Quaternion();
  heading = 0;
  pitch = 0;
  altitude = 0;
  baseAltitude = 0;
  speed = 0;
  bankAngle = 0;
  rollAngle = 0;
  isRolling = false;
  /** Network fade 0–1 (moon cutscene); read by StateSync. */
  visibility?: number;

  private globeRadius: number;
  private seed: number;
  private terrainType: string;
  private bobTime = Math.random() * Math.PI * 2;
  private bobOffset = 0;
  private bobPitch = 0;
  private bobRoll = 0;
  private turnInputSmoothed = 0;
  /** Remaining time at diamond boost speed after {@link speedBoost} (diamond pickup). */
  private boostTimer = 0;

  /** BodyArcade Rowing: surge speed not yet applied (attack envelope). */
  private rowSurgeBudget = 0;
  /** Rowing mode flags, set per-tick by the rowing input source. `glide`
   *  swaps coast decay for the gentler rowing drift; `sustain` (cruise)
   *  holds speed against decay. Keyboard activity clears both upstream. */
  rowGlide = false;
  rowSustain = false;

  /** Active upgrade multipliers; updated by Game.propagateUpgrades() after each pick. */
  upgrades = {
    maxSpeedMult: 1,
    turnMult: 1,
    accelMult: 1,
    boostSpeedMult: 1,
    boostDurationMult: 1,
  };

  /**
   * @param spawnSalt Random per session so boats (and heading) differ each run while staying on ocean.
   */
  constructor(
    globeRadius: number,
    seed: number,
    terrainType: string,
    hullColor: number,
    spawnSalt = 0,
  ) {
    this.globeRadius = globeRadius;
    this.seed = seed;
    this.terrainType = terrainType;
    this.hullColor = hullColor;
    this.group = createBoat(hullColor);
    this.group.matrixAutoUpdate = false;
    const oceanSeed = seed + spawnSalt;
    this.qPosition.copy(randomOceanQuaternion(seed, terrainType, oceanSeed));
    const headingRnd = seededRandom(oceanSeed + 4242);
    this.heading = headingRnd() * Math.PI * 2;
    const up = tangentFrame(this.qPosition).up;
    this.altitude =
      surfaceAltitudeAt(seed, terrainType, up.x, up.y, up.z) + FREEBOARD;
    this.speed = 0;
    this.applyMatrix();
  }

  update(
    dt: number,
    turnRate: number,
    forward: boolean,
    brake: boolean,
    _elevate: boolean = false,
    _paintball: boolean = false,
  ) {
    if (this.boostTimer > 0) {
      this.boostTimer = Math.max(0, this.boostTimer - dt);
    }

    const effMaxSpeed = MAX_SPEED * this.upgrades.maxSpeedMult;
    const effAccel = ACCEL * this.upgrades.accelMult;
    const effBoostSpeed = Math.min(
      DIAMOND_BOOST_SPEED * this.upgrades.boostSpeedMult,
      ABSOLUTE_MAX_BOOST_SPEED,
    );

    if (this.boostTimer > 0) {
      this.speed = effBoostSpeed;
    } else if (forward) {
      this.speed = Math.min(effMaxSpeed, this.speed + effAccel * dt);
    } else if (brake) {
      this.speed = Math.max(0, this.speed - BRAKE_DECEL * dt);
    } else if (this.rowSustain && this.rowSurgeBudget <= 0) {
      // cruise: momentum holds while the rower rests (rowing mode only)
    } else if (this.rowGlide) {
      this.speed = Math.max(0, this.speed * (1 - ROW_DRAG_PER_S * dt));
    } else {
      this.speed = Math.max(0, this.speed - COAST_DECAY * dt);
    }

    // Rowing surge: each detected stroke banked a speed budget; apply it
    // with a short attack so the boat visibly lunges per pull.
    if (this.rowSurgeBudget > 0 && this.boostTimer <= 0 && !brake) {
      const step = Math.min(this.rowSurgeBudget, ROW_SURGE_RATE * dt);
      const rowMax = ROW_MAX_SPEED * this.upgrades.maxSpeedMult;
      this.speed = Math.min(rowMax, this.speed + step);
      this.rowSurgeBudget -= step;
      if (this.speed >= rowMax) this.rowSurgeBudget = 0;
    }

    this.turnInputSmoothed += (turnRate - this.turnInputSmoothed) * (1 - Math.exp(-TURN_INPUT_SMOOTH * dt));
    this.heading += this.turnInputSmoothed * dt * TURN_SCALE * this.upgrades.turnMult;
    this.heading = ((this.heading % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

    const arcAngle = (this.speed * dt) / this.globeRadius;
    const nextQ = moveOnSphere(this.qPosition, this.heading, arcAngle);
    const upNext = tangentFrame(nextQ).up;
    const nx = upNext.x;
    const ny = upNext.y;
    const nz = upNext.z;

    if (!isLand(this.seed, this.terrainType, nx, ny, nz)) {
      this.qPosition = nextQ;
    }

    const up = tangentFrame(this.qPosition).up;
    const baseAlt =
      surfaceAltitudeAt(this.seed, this.terrainType, up.x, up.y, up.z) + FREEBOARD;

    this.bobTime += dt;
    this.bobOffset = Math.sin(this.bobTime * BOB_SPEED) * BOB_AMPLITUDE;
    this.bobPitch = Math.sin(this.bobTime * PITCH_BOB_SPEED + 1.3) * PITCH_BOB_AMP;
    this.bobRoll = Math.sin(this.bobTime * ROLL_BOB_SPEED + 2.7) * ROLL_BOB_AMP;

    this.baseAltitude = baseAlt;
    this.altitude = baseAlt + this.bobOffset;
    this.pitch = this.bobPitch;
    this.bankAngle = this.bobRoll;
    this.applyMatrix();
  }

  /** BodyArcade Rowing: bank one stroke's surge (strength 0..1 = amplitude). */
  rowStroke(strength: number) {
    const s = Math.max(0, Math.min(1, strength));
    this.rowSurgeBudget += ROW_IMPULSE_SPEED * s;
  }

  /** Temporary surge from collecting a diamond (matches plane/carpet diamond pickup). */
  speedBoost() {
    const eff = Math.min(
      DIAMOND_BOOST_SPEED * this.upgrades.boostSpeedMult,
      ABSOLUTE_MAX_BOOST_SPEED,
    );
    this.boostTimer = DIAMOND_BOOST_DURATION_SEC * this.upgrades.boostDurationMult;
    this.speed = eff;
  }

  applyMatrix() {
    const m = buildBoatMatrix(
      this.qPosition,
      this.heading,
      this.altitude,
      this.globeRadius,
      this.bobPitch,
      this.bobRoll,
    );
    this.group.matrix.copy(m);
    this.group.matrixWorldNeedsUpdate = true;
  }

  get speedRatio(): number {
    const ms = MAX_SPEED * this.upgrades.maxSpeedMult;
    if (ms <= 0) return 0;
    if (this.boostTimer > 0) return 1;
    return Math.max(0, Math.min(1, this.speed / ms));
  }

  addTo(scene: Scene) {
    scene.add(this.group);
  }

  dispose() {
    this.group.removeFromParent();
    this.group.traverse((child) => {
      if ((child as any).geometry) (child as any).geometry.dispose();
      if ((child as any).material) (child as any).material.dispose();
    });
  }
}
