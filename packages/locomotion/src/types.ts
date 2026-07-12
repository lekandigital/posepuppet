// @bodyarcade/locomotion — types. The model consumes a WalkIntent (derived
// from BodySignal + keyboard by the controller, or synthesized by tests)
// and produces a WalkPose. Comfort is enforced HERE: no consumer can make
// the camera exceed the envelope through this package.

/** One frame of control intent. Everything the model reads. */
export interface WalkIntent {
  /** steps/second from the gait detector (used only while gaitActive) */
  cadence: number;
  /** a step rhythm is established */
  gaitActive: boolean;
  /** last step excursion 0..1 (scales stride confidence) */
  gaitAmp: number;
  /** monotonic footfall count (model emits stepPulse on increments) */
  stepCount: number;
  /** weight-shift axis −1..1 (+ = user's right) — HUD/feedback, not steering */
  shift: number;
  /** which gait substrate is measuring: legs / sway / none */
  gaitSource: 'legs' | 'sway' | 'none';
  /** shaped lean axes from body-input (−1..1) */
  leanX: number;
  leanY: number;
  /** shaped crouch 0..1 */
  crouch: number;
  seated: boolean;
  /** body-signal confidence 0..1 */
  confidence: number;
  /** a signal arrived recently (controller staleness gate) */
  signalFresh: boolean;
  /** T-pose recenter fired this frame */
  recenterEvent: boolean;
  /** keyboard state — keyboard wins while active (touched recently) */
  kb: { forward: number; turn: number; active: boolean };
}

/** V4's nav-graph hook: given a position, the nearest path sample.
 *  `lateral` is the signed distance from path center, + = to the RIGHT of
 *  the path direction; `halfWidth` is the walkable half-width there.
 *  Return null off-network (assist disengages softly). */
export type PathHint = (
  x: number,
  z: number,
) => { dirX: number; dirZ: number; lateral: number; halfWidth: number } | null;

export type WalkMode = 'idle' | 'walk' | 'glide' | 'keyboard' | 'autopilot';

/** The model's output — a first-person rig pose. yawDeg is clockwise-
 *  positive seen from above (lean right = turn right = yaw increases);
 *  forward in the XZ plane is (sin yaw, −cos yaw), i.e. yaw 0 walks −Z,
 *  three.js camera convention. The model NEVER emits FOV, pitch, roll, or
 *  any vertical oscillation — stable horizon by construction. */
export interface WalkPose {
  x: number;
  z: number;
  yawDeg: number;
  /** signed speed along forward, m/s (small negative = keyboard backstep) */
  speed: number;
  yawRateDps: number;
  /** camera eye height, meters — slew-limited; duck only, never bob */
  eyeY: number;
  /** comfort vignette intensity 0..1 the host may render (0 = none) */
  vignette: number;
  mode: WalkMode;
  /** true on the frame a footfall registered (HUD pulse, audio hook) */
  stepPulse: boolean;
  /** true on the frame a T-pose recenter fired (HUD toast) */
  recentered: boolean;
}

/** Hard comfort caps — enforced inside the model every frame. Exported
 *  defaults are the tested envelope; consumers may only LOWER them. */
export interface ComfortConfig {
  /** hard speed cap, m/s (body or keyboard, walk or glide) */
  maxSpeed: number;
  /** acceleration cap, m/s² */
  maxAccel: number;
  /** braking cap, m/s² (voluntary stops; autopilot uses gentler) */
  maxDecel: number;
  /** yaw rate cap, deg/s — smooth capped turning, never a snap */
  maxYawRateDps: number;
  /** yaw acceleration cap, deg/s² */
  maxYawAccelDps2: number;
  /** standing eye height, meters */
  eyeHeight: number;
  /** how far a full crouch ducks the eye, meters */
  duckDrop: number;
  /** eye height slew limit, m/s (duck eases, never steps) */
  eyeSlewPerS: number;
  /** optional comfort vignette: intensity ramps with yaw rate and
   *  acceleration; hosts render it or ignore it */
  vignette: {
    enabled: boolean;
    /** yaw rate (deg/s) where the vignette starts */
    yawRateOnDps: number;
    /** acceleration (m/s²) where the vignette starts */
    accelOn: number;
    /** max intensity 0..1 */
    max: number;
    /** intensity slew per second */
    slewPerS: number;
  };
}

export type AssistMode = 'full' | 'light' | 'off';

export interface LocomotionConfig {
  comfort: ComfortConfig;
  /** cadence→speed: meters advanced per step at amp ≥ ampRef */
  strideM: number;
  /** amp below this scales the stride down (soft steps = shorter stride) */
  ampRef: number;
  /** amp scale floor (tiny steps still move you) */
  ampFloor: number;
  /** lean→turn: full lean = this yaw rate (≤ comfort.maxYawRateDps) */
  leanTurnDps: number;
  /** |leanX| dead-band handled upstream by body-input shaping; this is the
   *  fraction below which lean is ignored for YIELD purposes only */
  leanYieldThreshold: number;
  /** crouch above this ducks and slows */
  crouchOn: number;
  /** speed multiplier while ducked */
  duckSpeedScale: number;
  /** seated lean-glide: lean forward this far → glideMaxSpeed */
  glide: { leanOn: number; maxSpeed: number };
  /** soft path-shoulder steering (V4 nav-graph hook) */
  assist: {
    mode: AssistMode;
    /** yaw-rate budget the assist may spend, deg/s */
    maxDps: number;
    /** heading-alignment gain, deg/s per degree of error */
    alignGain: number;
    /** lateral-offset gain, deg/s per meter beyond the shoulder */
    lateralGain: number;
    /** shoulder margin inside the path half-width, meters */
    shoulderM: number;
  };
  /** tracking-loss autopilot */
  autopilot: {
    /** gentle stop deceleration, m/s² (≤ comfort.maxDecel) */
    decel: number;
    /** re-entry blend duration after tracking returns, ms */
    reentryMs: number;
    /** below this confidence the autopilot takes over */
    minConfidence: number;
  };
  keyboard: {
    /** W speed, m/s (capped by comfort.maxSpeed) */
    speed: number;
    /** S backstep speed, m/s (small — comfort) */
    backSpeed: number;
    /** A/D yaw rate, deg/s (capped by comfort.maxYawRateDps) */
    turnDps: number;
  };
}

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
