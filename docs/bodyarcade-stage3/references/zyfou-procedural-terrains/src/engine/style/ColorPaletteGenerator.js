import { PALETTE_KEYS, clonePalette, EARTH_PALETTE } from './ColorPalette.js';

// ============================================================================
// Procedural planet generator — palette + atmosphere, deterministic from seed.
// ============================================================================

export const PLANET_GEN_TYPES = [
  { key: 'random', label: 'Random' },
  { key: 'earth', label: 'Earth-like' },
  { key: 'alien', label: 'Alien' },
  { key: 'desert', label: 'Desert' },
  { key: 'ice', label: 'Ice' },
  { key: 'toxic', label: 'Toxic' },
  { key: 'volcanic', label: 'Volcanic' },
  { key: 'fungal', label: 'Fungal' },
];

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0; let g = 0; let b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [r + m, g + m, b + m];
}

function vary(rgb, rng, amount = 0.08) {
  return rgb.map((v) => Math.max(0, Math.min(1, v + (rng() - 0.5) * amount)));
}

function clampRgb(rgb) {
  return rgb.map((v) => Math.max(0, Math.min(1, v)));
}

function mixRgb(a, b, t) {
  return clampRgb(a.map((v, i) => v * (1 - t) + b[i] * t));
}

const TYPE_PROFILES = {
  earth: { hueBase: 200, hueSpread: 30, sat: [0.35, 0.65], lit: [0.35, 0.55], waterHue: -10 },
  alien: { hueBase: null, hueSpread: 360, sat: [0.5, 0.9], lit: [0.3, 0.6], waterHue: -25 },
  desert: { hueBase: 35, hueSpread: 20, sat: [0.4, 0.7], lit: [0.45, 0.7], waterHue: 15 },
  ice: { hueBase: 205, hueSpread: 25, sat: [0.15, 0.45], lit: [0.55, 0.85], waterHue: 0 },
  toxic: { hueBase: 110, hueSpread: 40, sat: [0.55, 0.85], lit: [0.35, 0.55], waterHue: -20 },
  volcanic: { hueBase: 15, hueSpread: 25, sat: [0.2, 0.5], lit: [0.2, 0.45], waterHue: -5 },
  fungal: { hueBase: 285, hueSpread: 30, sat: [0.4, 0.7], lit: [0.35, 0.6], waterHue: -15 },
};

const RESOLVED_TYPES = Object.keys(TYPE_PROFILES);

function resolveType(typeHint, rng) {
  if (typeHint && typeHint !== 'random' && TYPE_PROFILES[typeHint]) return typeHint;
  return RESOLVED_TYPES[Math.floor(rng() * RESOLVED_TYPES.length)];
}

function range(rng, [lo, hi]) {
  return lo + rng() * (hi - lo);
}

function buildPaletteFromProfile(profile, rng) {
  const baseHue = profile.hueBase != null
    ? profile.hueBase + (rng() - 0.5) * profile.hueSpread
    : rng() * 360;
  const sat = range(rng, profile.sat);
  const lit = range(rng, profile.lit);
  const waterHue = (baseHue + profile.waterHue) % 360;

  const hueOf = (offset, sMul = 1, lMul = 1) =>
    hslToRgb(
      (baseHue + offset) % 360,
      Math.min(1, sat * sMul),
      Math.max(0.05, Math.min(0.92, lit * lMul)),
    );

  const waterOf = (offset, sMul = 1, lMul = 1) =>
    hslToRgb(
      (waterHue + offset) % 360,
      Math.min(1, sat * sMul),
      Math.max(0.05, Math.min(0.92, lit * lMul)),
    );

  const palette = clonePalette(EARTH_PALETTE);

  palette.deep = vary(waterOf(-20, 1.2, 0.35), rng, 0.04);
  palette.shallow = vary(waterOf(-8, 1.0, 0.55), rng, 0.05);
  palette.foam = vary(waterOf(5, 0.5, 0.88), rng, 0.03);
  palette.sand = vary(hueOf(25, 0.7, 1.15), rng, 0.06);
  palette.dune = vary(hueOf(30, 0.65, 1.2), rng, 0.05);
  palette.dryGrass = vary(hueOf(50, 0.8, 0.85), rng, 0.06);
  palette.grass = vary(hueOf(90, 1.0, 0.55), rng, 0.05);
  palette.forest = vary(hueOf(110, 1.1, 0.38), rng, 0.04);
  palette.jungle = vary(hueOf(115, 1.15, 0.32), rng, 0.04);
  palette.swamp = vary(hueOf(140, 0.9, 0.35), rng, 0.05);
  palette.tundra = vary(hueOf(200, 0.25, 0.78), rng, 0.04);
  palette.redRock = vary(hueOf(-50, 0.85, 0.48), rng, 0.05);
  palette.redRock2 = vary(hueOf(-40, 0.9, 0.58), rng, 0.05);
  palette.rock = vary(hueOf(0, 0.15, 0.38), rng, 0.04);
  palette.rockHi = vary(hueOf(5, 0.12, 0.52), rng, 0.04);
  palette.snow = vary(hueOf(210, 0.08, 0.92), rng, 0.03);

  for (const k of PALETTE_KEYS) {
    if (!palette[k]) palette[k] = [...EARTH_PALETTE[k]];
  }

  return palette;
}

function deriveAtmosphere(palette, type) {
  const skyBase = mixRgb(palette.shallow, palette.deep, 0.35);
  const skyLift = mixRgb(skyBase, [0.55, 0.65, 0.82], type === 'ice' ? 0.55 : 0.4);
  const groundBase = mixRgb(palette.sand, palette.dryGrass, 0.5);
  const groundDark = mixRgb(groundBase, palette.rock, 0.35);

  return {
    skyAmbient: clampRgb(skyLift),
    groundBounce: clampRgb(groundDark),
  };
}

/**
 * Generate a full procedural planet palette + atmosphere from seed and type.
 * @param {number} seed
 * @param {string} typeHint — key from PLANET_GEN_TYPES or 'random'
 */
export function generateProceduralPlanet(seed = Date.now(), typeHint = 'random') {
  const rng = mulberry32(seed >>> 0);
  const type = resolveType(typeHint, rng);
  const profile = TYPE_PROFILES[type];
  const palette = buildPaletteFromProfile(profile, rng);
  const atmosphere = deriveAtmosphere(palette, type);
  const typeLabel = PLANET_GEN_TYPES.find((t) => t.key === type)?.label ?? type;

  return {
    palette,
    skyAmbient: atmosphere.skyAmbient,
    groundBounce: atmosphere.groundBounce,
    seed: seed >>> 0,
    type,
    typeLabel,
    alien: type === 'alien' || type === 'toxic' || type === 'fungal',
  };
}

/** @deprecated Use generateProceduralPlanet */
export function generatePalette(seed = Date.now(), styleHint = 'random') {
  const hint = styleHint === 'alien' ? 'alien' : styleHint === 'earth' ? 'earth' : 'random';
  const result = generateProceduralPlanet(seed, hint);
  return { palette: result.palette, seed: result.seed, alien: result.alien };
}

/** Randomize palette using terrain seed for reproducibility. */
export function generatePaletteFromTerrainSeed(terrainSeed, typeHint = 'random') {
  const sub = ((terrainSeed >>> 0) * 2654435761) >>> 0;
  return generateProceduralPlanet(sub, typeHint);
}
