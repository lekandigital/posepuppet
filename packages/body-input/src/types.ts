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

export interface BodyInputConfig {
  axes: Record<AxisName, AxisShapingConfig>;
  extraction: ExtractionConfig;
  events: EventConfig;
  /** confidence smoothing / decay time constants (ms) */
  confidenceTauMs: number;
  confidenceDecayTauMs: number;
  /** provisional neutral auto-capture: required still+confident dwell */
  provisionalNeutralMs: number;
}

/** Deep partial for config overrides. */
export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
