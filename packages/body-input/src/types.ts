// @bodyarcade/body-input — protocol types. BodySignal is the ONLY shape
// that crosses the package boundary; landmarks flow in, never out.

/** Mirror of PosePuppet's LandmarkPoint — deliberately re-declared here so
 *  the package has zero source dependency on the host app. */
export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

/** Input boundary. Landmarks arrive in PosePuppet's convention: MediaPipe
 *  axes (y down, z toward camera = negative), ALREADY MIRRORED so screen
 *  +x is the user's own right (mirror view). tsMs is the only time source
 *  the package ever sees — videoTimeMs for fixtures, wallTimeMs live. */
export interface BodyInputFrame {
  tsMs: number;
  /** metric world landmarks (hip-origin), or null on a dropout frame */
  world: LandmarkPoint[] | null;
  /** normalized image-space landmarks (y down, 0..1-ish), or null */
  norm: LandmarkPoint[] | null;
  /** optional per-limb continuity states from the host's tracking layer
   *  (Predictive Pose Continuity) — passed through to the signal */
  tracking?: BodyTracking;
}

/** Per-limb tracking continuity state (schema v1 additive, optional).
 *  'predicted' = short-horizon continuity (≤ ~400 ms, decaying
 *  confidence); 'relaxed' = past the horizon, data is easing to rest.
 *  Consumers that ignore this field lose nothing — the confidence field
 *  already reflects the same decay. */
export type TrackingState = 'visible' | 'predicted' | 'relaxed';

export interface BodyTracking {
  torso: TrackingState;
  head: TrackingState;
  leftArm: TrackingState;
  rightArm: TrackingState;
  leftLeg: TrackingState;
  rightLeg: TrackingState;
}

/** Periodic-motion (stroke) state — schema v1 additive, optional. Cyclic
 *  fore-aft wrist oscillation (rowing; Dolphin reuses the detector on its
 *  own axis). Consumers that ignore it lose nothing. */
export interface BodyStroke {
  /** a steady rhythm is currently established (≥ 2 counted strokes) */
  active: boolean;
  /** completed strokes (drive pulls) since pipeline reset — monotonic */
  count: number;
  /** stroke rate in Hz (EMA of finish-to-finish periods; decays to 0) */
  rate: number;
  /** 0 at the catch, ~0.5 at the finish, →1 approaching the next catch */
  phase: number;
  /** per-arm drive amplitude of the last counted stroke, arm-length units */
  ampL: number;
  ampR: number;
}

/** Torso-wave (dolphin-kick) periodic state — the same detector as stroke
 *  on a different measured signal: vertical chest–hip extent in image
 *  space, self-normalized by its own slow EMA so slow posture changes
 *  (leans, crouches) pass through the reference instead of counting. */
export interface BodySwim {
  /** a steady wave rhythm is currently established (≥ 2 counted kicks) */
  active: boolean;
  /** completed kicks since pipeline reset — monotonic */
  count: number;
  /** kick rate in Hz (EMA of cycle periods; decays to 0) */
  rate: number;
  /** 0 at the extent maximum, ~0.5 at the compression, →1 toward the next */
  phase: number;
  /** extent excursion of the last counted kick, fraction of resting extent */
  amp: number;
}

/** Gait (walking) periodic state — schema v1 additive, optional. Steps
 *  from left/right alternation: knee-lift difference when legs are in
 *  frame ('legs'), lateral hip sway when they are not ('sway' — the
 *  weight-shift / desk-framing substrate). One detector, one rhythm;
 *  the source switches with framing without dropping the count. */
export interface BodyGait {
  /** a steady step rhythm is currently established (≥ 2 counted steps) */
  active: boolean;
  /** completed steps (footfalls) since pipeline reset — monotonic */
  count: number;
  /** step rate in steps/second (EMA of step intervals; decays to 0) */
  cadence: number;
  /** 0 at the last footfall, →1 approaching the next */
  phase: number;
  /** excursion of the last counted step, 0..1 of a full stride */
  amp: number;
  /** weight-shift axis, −1..1, + = weight over the user's own right foot */
  shift: number;
  /** substrate measured THIS frame: legs (knee alternation), sway
   *  (lateral hip excursion), or none (dropout / hips unseen) */
  source: 'legs' | 'sway' | 'none';
}

export type BodyEvent = 'recenter' | 'action'; // closed set in schema v1

export interface BodyAxes {
  /** -1..1, + = user leans toward their own right */
  leanX: number;
  /** -1..1, + = lean forward (toward camera) */
  leanY: number;
  /** 0..1, 0 = neutral stature, 1 = deep crouch */
  crouch: number;
  /** 0..1, 0 = neutral, 1 = full upward stretch (small range, high gain) */
  tallness: number;
  /** 0..1, mean lateral wrist extension / arm length (T-pose ≈ 1) */
  armsOut: number;
  /** 0..1, mean wrist elevation above the shoulder line / arm length */
  armsRaised: number;
  /** 0..1, mean wrist extension toward the camera / arm length */
  handsForward: number;
  /** 0..1, asymmetric single-arm extension (≈0 in T-pose, high on a point) */
  handPoint: number;
}

/** One emitted message — schema v1. */
export interface BodySignal {
  v: 1;
  /** ms, monotonic, derived only from input-frame timestamps */
  ts: number;
  /** 0..1 tracking confidence; decays on loss, recovers smoothly */
  confidence: number;
  seated: boolean;
  /** 0..1, 1 = holding still */
  stillness: number;
  /** 0..1 trust in the captured neutral (1 = fresh explicit recenter) */
  neutralConfidence: number;
  axes: BodyAxes;
  /** events fired on THIS frame (transition-triggered, usually empty) */
  events: BodyEvent[];
  /** optional per-limb continuity states (additive; absent when the host
   *  tracking layer doesn't provide them) */
  tracking?: BodyTracking;
  /** optional periodic-motion state (additive; emitted by cores with a
   *  stroke config — old tapes and consumers stay valid without it) */
  stroke?: BodyStroke;
  /** optional torso-wave state (additive, same contract as stroke) */
  swim?: BodySwim;
  /** optional gait state (additive, same contract as stroke) */
  gait?: BodyGait;
}

export type AxisName = keyof BodyAxes;

export interface AxisShapingConfig {
  oneEuro: { minCutoff: number; beta: number };
  /** symmetric dead zone half-width, applied post-filter with rescale */
  deadZone: number;
  /** RC-style expo 0..1: v·(1−k) + v³·k */
  expo: number;
  /** max output change per second (slew-rate limit) */
  slewPerSec: number;
  /** decay time constant toward neutral while this axis is unavailable */
  decayTauMs: number;
}

export interface ExtractionConfig {
  /** lean normalization: this many degrees of torso tilt = full deflection */
  maxLeanXDeg: number;
  maxLeanYDeg: number;
  /** crouch: stature loss as a fraction of neutral stature = 1.0 crouch */
  crouchRange: number;
  /** tallness: stature gain fraction = 1.0 tallness (tiptoe is small) */
  tallnessRange: number;
  /** fallback normalizers (upper-body framing), in shoulder-width units */
  fallbackCrouchWidths: number;
  fallbackTallWidths: number;
  fallbackLeanYWidths: number;
  /** mean keypoint speed (m/s) that maps stillness to 0 */
  motionScale: number;
  /** landmark visibility gates */
  visGate: number;
  /** seated: thigh-horizontality angle (deg from horizontal) */
  seatedThighDeg: number;
  seatedEnterMs: number;
  seatedExitMs: number;
}

export interface EventConfig {
  recenter: { armsOutMin: number; armsRaisedMax: number; holdMs: number; refractoryMs: number };
  action: { enter: number; exit: number; minRatePerSec: number; debounceFrames: number; refractoryMs: number };
  /** events are inhibited below this confidence */
  minConfidence: number;
}

export interface StrokeConfig {
  /** position filter on the per-arm fore-aft signal (arm-length units) */
  oneEuro: { minCutoff: number; beta: number };
  /** Schmitt-trigger width: a reversal registers when the signal retreats
   *  this far (arm-length units) from the running extremum */
  reversalHys: number;
  /** minimum drive excursion (arm-length units) for a stroke to count */
  minAmp: number;
  /** minimum drive duration — rejects tremor and filter ringing */
  minHalfPeriodMs: number;
  /** no reversal for this long = rhythm broken (active drops, rate decays) */
  maxPeriodMs: number;
  /** rate decay time constant once the rhythm is stale */
  rateDecayTauMs: number;
}

/** Gait substrate. 'legs' = knee-lift difference (thigh-length units);
 *  'sway' = lateral hip excursion (shoulder-width units). */
export type GaitSource = 'legs' | 'sway';

export interface GaitSourceConfig {
  /** position filter on this substrate's scalar */
  oneEuro: { minCutoff: number; beta: number };
  /** Schmitt-trigger width: a reversal registers when the signal retreats
   *  this far (substrate units) from the running extremum */
  reversalHys: number;
  /** minimum peak-to-peak excursion (substrate units) for a step to count */
  minAmp: number;
  /** excursion that reads as amp = 1 (a full stride) */
  ampNorm: number;
  /** filtered signal → shift axis multiplier (then clamped to ±1) */
  shiftScale: number;
}

export interface GaitConfig {
  /** knee-lift-difference bank (marching in place, stepping) */
  march: GaitSourceConfig;
  /** lateral-hip-sway bank (weight-shift walking, kneeless framing) */
  sway: GaitSourceConfig & {
    /** slow EMA time constant for the DC-removing sway reference */
    refTauMs: number;
  };
  /** physiological step-interval gates, shared by both banks */
  minStepMs: number;
  maxStepMs: number;
  /** cadence decay time constant once the rhythm is stale */
  cadenceDecayTauMs: number;
}

export interface BodyInputConfig {
  axes: Record<AxisName, AxisShapingConfig>;
  extraction: ExtractionConfig;
  events: EventConfig;
  stroke: StrokeConfig;
  /** torso-wave detector (StrokeDetector reused; units are fractions of
   *  the resting chest–hip extent, not arm lengths) */
  swim: StrokeConfig & {
    /** slow EMA time constant for the self-normalizing extent reference */
    refTauMs: number;
  };
  /** gait (step) detector — marching legs + weight-shift sway banks */
  gait: GaitConfig;
  /** confidence smoothing / decay time constants (ms) */
  confidenceTauMs: number;
  confidenceDecayTauMs: number;
  /** provisional neutral auto-capture: required still+confident dwell */
  provisionalNeutralMs: number;
}

/** Deep partial for config overrides. */
export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
