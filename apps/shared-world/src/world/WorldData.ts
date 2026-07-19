// WorldData — the app-local loader for the baked region artifacts
// (Implementation Master §2.3 + R8: `packages/world-data` is NOT used — the
// authored fictional region has its own schema and its own attribution).
//
// Bake-don't-generate law (Master §6.2): this file only LOADS; all
// generation lives in authoring/bake-region.mjs, offline, seeded, committed.
//
// Sampling semantics (cp04A §6.2):
//   terrainHeight(x, z) — bilinear over the dequantized uint16 grid
//   inWater(x, z)       — nearest shore-mask texel (255 = land)
//   shoreDistance(x, z) — bilinear over the signed distance field, meters,
//                         positive = water (schema extension R13)
//   depthAt(x, z)       — max(0, −terrainHeight)
//
// Validation: world.json magic + per-artifact resolution/byte counts are
// checked against the decoded payloads; any mismatch throws (cp04A §3.3).

export interface WorldHeader {
  magic: string;
  seed: number;
  layout: string;
  origin: [number, number];
  sizeMeters: [number, number];
  seaLevel: number;
  heightRange: [number, number];
  spawn: { x: number; z: number; yaw: number; note: string };
  artifacts: Record<string, { resolution?: number; bytes: number } & Record<string, unknown>>;
  zones: unknown[];
  ridgeLines: { name: string; points: [number, number][] }[];
  attribution: string[];
  verification: { probes: { x: number; z: number; h: number }[] };
}

export interface PlacementInstance {
  category: string;
  type: string;
  x: number;
  z: number;
  yaw: number;
  scale: number;
}

export interface PlacementData {
  magic: string;
  layout: string;
  routeClosed: boolean;
  instances: PlacementInstance[];
}

export interface CavesData {
  magic: string;
  modules: {
    id: string;
    family: string;
    role: string;
    moduleId: string | null;
    transform: { x: number; z: number; yaw: number; scale: number };
    mouths: { name: string; x: number; z: number; yaw: number; lipY: number }[];
  }[];
}

const WORLD_MAGIC = 'bodyarcade-region-world/1';
const PLACEMENT_MAGIC = 'bodyarcade-region-placement/1';
const CAVES_MAGIC = 'bodyarcade-region-caves/1';

const H_MIN = -80;
const H_RANGE = 280;
const SDF_CLAMP = 500;

export class WorldData {
  /** wall-clock decode time for the performance report */
  readonly decodeMs: number;

  private readonly n: number;
  private readonly texel: number;
  private readonly half: number;

  private constructor(
    readonly header: WorldHeader,
    readonly placement: PlacementData,
    readonly caves: CavesData,
    /** decoded heights, meters (Float32, row-major, j*n+i) */
    readonly heights: Float32Array,
    /** decoded signed shore distance, meters (Float32) */
    readonly sdf: Float32Array,
    /** shore mask: 1 = land */
    readonly mask: Uint8Array,
    /** cp05A: biome.png RGBA bytes (R bright, G kelp-shelf, B plain, A 255) */
    readonly biome: Uint8Array,
    /** cp05A: biome raster side length (1025) */
    readonly biomeN: number,
    decodeMs: number,
  ) {
    this.n = header.artifacts['height.r16']!.resolution!;
    this.texel = header.sizeMeters[0] / (this.n - 1);
    this.half = header.sizeMeters[0] / 2;
    this.decodeMs = decodeMs;
  }

  static async load(baseUrl: string): Promise<WorldData> {
    const t0 = performance.now();
    const [header, placement, caves] = (await Promise.all([
      fetchJson(baseUrl + 'world.json'),
      fetchJson(baseUrl + 'placement.json'),
      fetchJson(baseUrl + 'caves.json'),
    ])) as [WorldHeader, PlacementData, CavesData];

    if (header.magic !== WORLD_MAGIC) throw new Error(`world.json magic mismatch: ${header.magic}`);
    if (placement.magic !== PLACEMENT_MAGIC) throw new Error(`placement.json magic mismatch: ${placement.magic}`);
    if (caves.magic !== CAVES_MAGIC) throw new Error(`caves.json magic mismatch: ${caves.magic}`);
    if (!header.attribution?.length) throw new Error('world.json missing attribution lines');

    const n = header.artifacts['height.r16']?.resolution;
    const nSdf = header.artifacts['shore_sdf.r16']?.resolution;
    const nShore = header.artifacts['shore.png']?.resolution;
    if (!n || nSdf !== n || nShore !== n) {
      throw new Error(`artifact resolutions inconsistent: height ${n}, sdf ${nSdf}, shore ${nShore}`);
    }

    const [heightBytes, sdfBytes, shorePixels, biomePixels] = await Promise.all([
      fetchBytes(baseUrl + 'height.r16'),
      fetchBytes(baseUrl + 'shore_sdf.r16'),
      fetchPngPixels(baseUrl + 'shore.png'),
      fetchPngPixels(baseUrl + 'biome.png'),
    ]);

    const expectBytes = n * n * 2;
    if (heightBytes.byteLength !== expectBytes) {
      throw new Error(`height.r16 size ${heightBytes.byteLength} ≠ ${expectBytes}`);
    }
    if (sdfBytes.byteLength !== expectBytes) {
      throw new Error(`shore_sdf.r16 size ${sdfBytes.byteLength} ≠ ${expectBytes}`);
    }
    if (heightBytes.byteLength !== header.artifacts['height.r16']!.bytes) {
      throw new Error('height.r16 size ≠ world.json header record');
    }
    if (shorePixels.width !== n || shorePixels.height !== n) {
      throw new Error(`shore.png decoded ${shorePixels.width}×${shorePixels.height} ≠ ${n}²`);
    }

    // decode uint16-LE → Float32 meters
    const hv = new DataView(heightBytes);
    const heights = new Float32Array(n * n);
    for (let k = 0; k < n * n; k++) heights[k] = H_MIN + (hv.getUint16(k * 2, true) / 65535) * H_RANGE;
    const sv = new DataView(sdfBytes);
    const sdf = new Float32Array(n * n);
    for (let k = 0; k < n * n; k++) sdf[k] = -SDF_CLAMP + (sv.getUint16(k * 2, true) / 65535) * (2 * SDF_CLAMP);
    // shore mask from the R channel (grayscale PNG; 255 = land)
    const mask = new Uint8Array(n * n);
    for (let k = 0; k < n * n; k++) mask[k] = shorePixels.data[k * 4]! >= 128 ? 1 : 0;

    // cross-artifact sanity: height sign vs mask must agree (sign law)
    for (let k = 0; k < n * n; k += 9973) {
      if (heights[k]! >= 0 !== (mask[k] === 1)) {
        throw new Error(`height/shore sign mismatch at texel ${k}`);
      }
    }

    // cp05A: biome regional masks for the substrate classification (RGBA;
    // alpha is constant 255 by bake law so canvas decode stays lossless)
    const nb = header.artifacts['biome.png']?.resolution;
    if (!nb || biomePixels.width !== nb || biomePixels.height !== nb) {
      throw new Error(`biome.png decoded ${biomePixels.width}×${biomePixels.height} ≠ ${nb}²`);
    }
    const biome = new Uint8Array(biomePixels.data.buffer.slice(0), 0, nb * nb * 4);

    const decodeMs = performance.now() - t0;
    return new WorldData(header, placement, caves, heights, sdf, mask, biome, nb, decodeMs);
  }

  /** Is (x, z) inside the data domain? */
  contains(x: number, z: number): boolean {
    return Math.abs(x) <= this.half && Math.abs(z) <= this.half;
  }

  /** Bilinear terrain height, meters (edge-clamped outside the domain). */
  terrainHeight(x: number, z: number): number {
    const n = this.n;
    const u = clamp((x + this.half) / this.texel, 0, n - 1);
    const v = clamp((z + this.half) / this.texel, 0, n - 1);
    const i0 = Math.min(Math.floor(u), n - 2);
    const j0 = Math.min(Math.floor(v), n - 2);
    const fu = u - i0;
    const fv = v - j0;
    const g = this.heights;
    const a = g[j0 * n + i0]!;
    const b = g[j0 * n + i0 + 1]!;
    const c = g[(j0 + 1) * n + i0]!;
    const d = g[(j0 + 1) * n + i0 + 1]!;
    return (a + (b - a) * fu) * (1 - fv) + (c + (d - c) * fu) * fv;
  }

  /** Nearest-texel water test (false outside the data domain). */
  inWater(x: number, z: number): boolean {
    if (!this.contains(x, z)) return false;
    const n = this.n;
    const i = clamp(Math.round((x + this.half) / this.texel), 0, n - 1);
    const j = clamp(Math.round((z + this.half) / this.texel), 0, n - 1);
    return this.mask[j * n + i] === 0;
  }

  /** Bilinear signed shore distance, meters, + = water (edge-clamped). */
  shoreDistance(x: number, z: number): number {
    const n = this.n;
    const u = clamp((x + this.half) / this.texel, 0, n - 1);
    const v = clamp((z + this.half) / this.texel, 0, n - 1);
    const i0 = Math.min(Math.floor(u), n - 2);
    const j0 = Math.min(Math.floor(v), n - 2);
    const fu = u - i0;
    const fv = v - j0;
    const g = this.sdf;
    const a = g[j0 * n + i0]!;
    const b = g[j0 * n + i0 + 1]!;
    const c = g[(j0 + 1) * n + i0]!;
    const d = g[(j0 + 1) * n + i0 + 1]!;
    return (a + (b - a) * fu) * (1 - fv) + (c + (d - c) * fu) * fv;
  }

  /** Water depth, meters, positive down (Track A §4.3 sign note). */
  depthAt(x: number, z: number): number {
    return Math.max(0, -this.terrainHeight(x, z));
  }

  /** cp05A: bilinear biome-mask sample → [bright, kelpShelf, plain] ∈ 0..1
   *  (matches the GPU's linear-filtered uBiomeTex read). */
  biomeAt(x: number, z: number): [number, number, number] {
    const nb = this.biomeN;
    const step = this.header.sizeMeters[0] / (nb - 1);
    const u = clamp((x + this.half) / step, 0, nb - 1);
    const v = clamp((z + this.half) / step, 0, nb - 1);
    const i0 = Math.min(Math.floor(u), nb - 2);
    const j0 = Math.min(Math.floor(v), nb - 2);
    const fu = u - i0;
    const fv = v - j0;
    const g = this.biome;
    const out: [number, number, number] = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      const a = g[(j0 * nb + i0) * 4 + c]!;
      const b = g[(j0 * nb + i0 + 1) * 4 + c]!;
      const d = g[((j0 + 1) * nb + i0) * 4 + c]!;
      const e = g[((j0 + 1) * nb + i0 + 1) * 4 + c]!;
      out[c] = ((a + (b - a) * fu) * (1 - fv) + (d + (e - d) * fu) * fv) / 255;
    }
    return out;
  }

  /** Decoded-field memory for the performance report, bytes. */
  decodedBytes(): number {
    return this.heights.byteLength + this.sdf.byteLength + this.mask.byteLength;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url}: HTTP ${res.status}`);
  return res.json();
}

async function fetchBytes(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url}: HTTP ${res.status}`);
  return res.arrayBuffer();
}

async function fetchPngPixels(url: string): Promise<ImageData> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url}: HTTP ${res.status}`);
  const bitmap = await createImageBitmap(await res.blob());
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
