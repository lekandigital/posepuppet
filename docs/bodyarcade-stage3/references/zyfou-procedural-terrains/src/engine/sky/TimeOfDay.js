// ============================================================================
// TimeOfDay: maps a normalized 0..1 time value to sun angle, sky colors,
// fog color, and light parameters. Does NOT auto-advance — the user
// controls the slider directly.
//
// Convention: 0.0 = midnight, 0.25 = dawn, 0.5 = noon, 0.75 = dusk
// ============================================================================

/**
 * Keyframe palette: each entry defines the look at a specific time.
 * Values are linearly interpolated between adjacent keyframes.
 */
const KEYFRAMES = [
  { // 0.0 — Midnight
    time: 0.0,
    sunElevation: -25,
    sunAzimuth: 0,
    zenith: [0.01, 0.01, 0.03],
    horizon: [0.03, 0.04, 0.07],
    sunColor: [0.15, 0.15, 0.25],
    fogColor: [0.02, 0.03, 0.06],
    lightIntensity: 0.08,
    ambientIntensity: 0.15,
  },
  { // 0.20 — Pre-dawn
    time: 0.20,
    sunElevation: -5,
    sunAzimuth: 80,
    zenith: [0.04, 0.04, 0.12],
    horizon: [0.20, 0.10, 0.08],
    sunColor: [0.85, 0.40, 0.20],
    fogColor: [0.12, 0.07, 0.06],
    lightIntensity: 0.3,
    ambientIntensity: 0.25,
  },
  { // 0.28 — Dawn / Golden Hour
    time: 0.28,
    sunElevation: 8,
    sunAzimuth: 95,
    zenith: [0.15, 0.18, 0.42],
    horizon: [0.70, 0.38, 0.18],
    sunColor: [1.0, 0.72, 0.42],
    fogColor: [0.45, 0.28, 0.15],
    lightIntensity: 0.75,
    ambientIntensity: 0.35,
  },
  { // 0.38 — Morning
    time: 0.38,
    sunElevation: 30,
    sunAzimuth: 120,
    zenith: [0.22, 0.38, 0.68],
    horizon: [0.55, 0.60, 0.72],
    sunColor: [1.0, 0.95, 0.85],
    fogColor: [0.52, 0.56, 0.65],
    lightIntensity: 1.2,
    ambientIntensity: 0.45,
  },
  { // 0.50 — Noon
    time: 0.50,
    sunElevation: 65,
    sunAzimuth: 180,
    zenith: [0.18, 0.35, 0.72],
    horizon: [0.50, 0.62, 0.78],
    sunColor: [1.0, 0.98, 0.92],
    fogColor: [0.55, 0.62, 0.75],
    lightIntensity: 1.5,
    ambientIntensity: 0.50,
  },
  { // 0.62 — Afternoon
    time: 0.62,
    sunElevation: 35,
    sunAzimuth: 240,
    zenith: [0.20, 0.35, 0.65],
    horizon: [0.55, 0.58, 0.68],
    sunColor: [1.0, 0.94, 0.82],
    fogColor: [0.50, 0.54, 0.62],
    lightIntensity: 1.3,
    ambientIntensity: 0.45,
  },
  { // 0.72 — Dusk / Golden Hour
    time: 0.72,
    sunElevation: 8,
    sunAzimuth: 265,
    zenith: [0.12, 0.12, 0.35],
    horizon: [0.75, 0.32, 0.12],
    sunColor: [1.0, 0.55, 0.22],
    fogColor: [0.50, 0.25, 0.12],
    lightIntensity: 0.7,
    ambientIntensity: 0.30,
  },
  { // 0.80 — Post-dusk
    time: 0.80,
    sunElevation: -5,
    sunAzimuth: 280,
    zenith: [0.04, 0.04, 0.14],
    horizon: [0.22, 0.08, 0.06],
    sunColor: [0.60, 0.25, 0.12],
    fogColor: [0.10, 0.06, 0.05],
    lightIntensity: 0.2,
    ambientIntensity: 0.20,
  },
  { // 1.0 — Midnight (wraps)
    time: 1.0,
    sunElevation: -25,
    sunAzimuth: 360,
    zenith: [0.01, 0.01, 0.03],
    horizon: [0.03, 0.04, 0.07],
    sunColor: [0.15, 0.15, 0.25],
    fogColor: [0.02, 0.03, 0.06],
    lightIntensity: 0.08,
    ambientIntensity: 0.15,
  },
];

function lerp(a, b, t) { return a + (b - a) * t; }
function lerpArr(a, b, t) { return a.map((v, i) => lerp(v, b[i], t)); }

/**
 * Evaluate time-of-day parameters at a given time (0..1).
 * Returns an object with all interpolated values.
 */
export function evaluateTimeOfDay(time) {
  // Clamp and wrap
  time = ((time % 1) + 1) % 1;

  // Find the two keyframes we're between
  let a = KEYFRAMES[0];
  let b = KEYFRAMES[1];
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (time >= KEYFRAMES[i].time && time <= KEYFRAMES[i + 1].time) {
      a = KEYFRAMES[i];
      b = KEYFRAMES[i + 1];
      break;
    }
  }

  const range = b.time - a.time;
  const t = range > 0 ? (time - a.time) / range : 0;

  return {
    sunElevation: lerp(a.sunElevation, b.sunElevation, t),
    sunAzimuth: lerp(a.sunAzimuth, b.sunAzimuth, t),
    zenith: lerpArr(a.zenith, b.zenith, t),
    horizon: lerpArr(a.horizon, b.horizon, t),
    sunColor: lerpArr(a.sunColor, b.sunColor, t),
    fogColor: lerpArr(a.fogColor, b.fogColor, t),
    lightIntensity: lerp(a.lightIntensity, b.lightIntensity, t),
    ambientIntensity: lerp(a.ambientIntensity, b.ambientIntensity, t),
  };
}

/**
 * Format a 0..1 time value as a 24h clock string (e.g., "14:30").
 */
export function formatTimeOfDay(time) {
  time = ((time % 1) + 1) % 1;
  const hours = Math.floor(time * 24);
  const mins = Math.floor((time * 24 - hours) * 60);
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}
