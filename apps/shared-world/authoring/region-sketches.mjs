// region-sketches.mjs — Checkpoint 03 region-layout sketch renderer.
//
// Renders the 2–3 top-down authoring sketches of the fictional 2 km × 2 km
// region as deterministic 2048×2048 PNGs (1 px ≈ 1 m, north up = −Z).
// This is an authoring diagram generator (debug-artifact class), not asset
// generation: flat hypsometric depth tint, landmark glyphs, labeled text.
//
// Usage:
//   node apps/shared-world/authoring/region-sketches.mjs            # render PNGs
//   node apps/shared-world/authoring/region-sketches.mjs --verify   # determinism check
//
// Determinism: fixed integer seeds, no Math.random, no Date, no environment
// reads. PNG bytes come from node:zlib deflateSync at fixed settings, so two
// runs on the same machine produce byte-identical files (--verify proves it).
//
// Dependencies: none (node:zlib, node:crypto, node:fs only). The checkpoint
// allows one PNG-writing dev-dependency; none was needed.
//
// World contract (Implementation Master §2.1): meters, y-up, sea level y = 0,
// X,Z ∈ [−1000, +1000], depth floor −80 m, tallest peak +200 m. Map
// convention here: north = −Z (top of image), east = +X (right of image).

import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, 'region-sketches');

const W = 2048;
const H = 2048;
const REGION = 2000; // meters across
const M_PER_PX = REGION / W; // ≈ 0.977 m/px, "1 px ≈ 1 m"

// ---------------------------------------------------------------------------
// Small math helpers
// ---------------------------------------------------------------------------

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
function sstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
const hyp = Math.hypot;

function dSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  const t = len2 === 0 ? 0 : clamp(((px - ax) * dx + (pz - az) * dz) / len2, 0, 1);
  return hyp(px - (ax + t * dx), pz - (az + t * dz));
}

// Normalized ellipse "radius" (1.0 at the ellipse boundary).
function eNorm(px, pz, cx, cz, rx, rz, rot) {
  const c = Math.cos(-rot), s = Math.sin(-rot);
  const u = (px - cx) * c - (pz - cz) * s;
  const v = (px - cx) * s + (pz - cz) * c;
  return hyp(u / rx, v / rz);
}

// ---------------------------------------------------------------------------
// Seeded value noise (deterministic; integer hash + smooth interpolation)
// ---------------------------------------------------------------------------

function hash2(ix, iz, seed) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function vnoise(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uz);
}

function fbm(x, z, seed) {
  return (
    vnoise(x, z, seed) * 0.55 +
    vnoise(x * 2.13, z * 2.13, seed + 101) * 0.30 +
    vnoise(x * 4.31, z * 4.31, seed + 202) * 0.15
  );
}

// ---------------------------------------------------------------------------
// Minimal PNG writer (RGB8, filter 0, node:zlib deflate)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePNG(width, height, rgb) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: truecolor RGB
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const ro = y * (1 + width * 3);
    raw[ro] = 0; // filter: none
    rgb.copy(raw, ro + 1, y * width * 3, (y + 1) * width * 3);
  }
  const idat = deflateSync(raw, { level: 9, memLevel: 9, strategy: 0 });
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Canvas primitives
// ---------------------------------------------------------------------------

class Canvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.buf = Buffer.alloc(w * h * 3);
  }
  set(x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const o = (y * this.w + x) * 3;
    this.buf[o] = c[0]; this.buf[o + 1] = c[1]; this.buf[o + 2] = c[2];
  }
  blend(x, y, c, a) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const o = (y * this.w + x) * 3;
    this.buf[o] = Math.round(lerp(this.buf[o], c[0], a));
    this.buf[o + 1] = Math.round(lerp(this.buf[o + 1], c[1], a));
    this.buf[o + 2] = Math.round(lerp(this.buf[o + 2], c[2], a));
  }
  disc(cx, cy, r, c) {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2) this.set(x, y, c);
  }
  ring(cx, cy, r, thick, c) {
    const out2 = (r + thick / 2) ** 2, in2 = (r - thick / 2) ** 2;
    for (let y = Math.floor(cy - r - thick); y <= Math.ceil(cy + r + thick); y++)
      for (let x = Math.floor(cx - r - thick); x <= Math.ceil(cx + r + thick); x++) {
        const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
        if (d2 <= out2 && d2 >= in2) this.set(x, y, c);
      }
  }
  rect(x0, y0, x1, y1, c) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, c);
  }
  frame(x0, y0, x1, y1, t, c) {
    this.rect(x0, y0, x1, y0 + t - 1, c);
    this.rect(x0, y1 - t + 1, x1, y1, c);
    this.rect(x0, y0, x0 + t - 1, y1, c);
    this.rect(x1 - t + 1, y0, x1, y1, c);
  }
  line(x0, y0, x1, y1, width, c) {
    const len = hyp(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.ceil(len));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      this.disc(lerp(x0, x1, t), lerp(y0, y1, t), width / 2, c);
    }
  }
  tri(ax, ay, bx, by, cx, cy, col) {
    const minx = Math.floor(Math.min(ax, bx, cx)), maxx = Math.ceil(Math.max(ax, bx, cx));
    const miny = Math.floor(Math.min(ay, by, cy)), maxy = Math.ceil(Math.max(ay, by, cy));
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (den === 0) return;
    for (let y = miny; y <= maxy; y++)
      for (let x = minx; x <= maxx; x++) {
        const l1 = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / den;
        const l2 = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / den;
        const l3 = 1 - l1 - l2;
        if (l1 >= -0.001 && l2 >= -0.001 && l3 >= -0.001) this.set(x, y, col);
      }
  }
}

// ---------------------------------------------------------------------------
// 5×7 bitmap font (uppercase + digits + punctuation), scaled by integer factor
// ---------------------------------------------------------------------------

const FONT = {
  A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  B: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
  C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  D: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  F: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
  G: [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01111],
  H: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  I: [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  J: [0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100],
  K: [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  M: [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
  N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  Q: [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
  R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  S: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
  T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  V: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  W: [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b11011, 0b10001],
  X: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
  Y: [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
  Z: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
  0: [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  1: [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  2: [0b01110, 0b10001, 0b00001, 0b00110, 0b01000, 0b10000, 0b11111],
  3: [0b11111, 0b00010, 0b00100, 0b00010, 0b00001, 0b10001, 0b01110],
  4: [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  5: [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
  6: [0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
  7: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  8: [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  9: [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b01100],
  '-': [0b00000, 0b00000, 0b00000, 0b11111, 0b00000, 0b00000, 0b00000],
  '+': [0b00000, 0b00100, 0b00100, 0b11111, 0b00100, 0b00100, 0b00000],
  '.': [0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b01100, 0b01100],
  ',': [0b00000, 0b00000, 0b00000, 0b00000, 0b01100, 0b00100, 0b01000],
  ':': [0b00000, 0b01100, 0b01100, 0b00000, 0b01100, 0b01100, 0b00000],
  '(': [0b00010, 0b00100, 0b01000, 0b01000, 0b01000, 0b00100, 0b00010],
  ')': [0b01000, 0b00100, 0b00010, 0b00010, 0b00010, 0b00100, 0b01000],
  '/': [0b00001, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b10000],
  '?': [0b01110, 0b10001, 0b00001, 0b00110, 0b00100, 0b00000, 0b00100],
  '=': [0b00000, 0b00000, 0b11111, 0b00000, 0b11111, 0b00000, 0b00000],
  '>': [0b01000, 0b00100, 0b00010, 0b00001, 0b00010, 0b00100, 0b01000],
  '<': [0b00010, 0b00100, 0b01000, 0b10000, 0b01000, 0b00100, 0b00010],
  "'": [0b00100, 0b00100, 0b01000, 0b00000, 0b00000, 0b00000, 0b00000],
  ' ': [0, 0, 0, 0, 0, 0, 0],
};

function textWidth(str, s) {
  return str.length * 6 * s - s;
}

function drawText(cv, x, y, str, s, col, halo, anchor = 'l') {
  const lines = String(str).toUpperCase().split('\n');
  let ly = y;
  for (const line of lines) {
    const w = textWidth(line, s);
    let lx = anchor === 'c' ? x - w / 2 : anchor === 'r' ? x - w : x;
    lx = Math.round(lx);
    const yy = Math.round(ly);
    for (let pass = 0; pass < (halo ? 2 : 1); pass++) {
      const color = halo && pass === 0 ? halo : col;
      const offs = halo && pass === 0
        ? [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]
        : [[0, 0]];
      for (const [ox, oy] of offs) {
        let cx0 = lx;
        for (const ch of line) {
          const g = FONT[ch] || FONT[' '];
          for (let r = 0; r < 7; r++)
            for (let c = 0; c < 5; c++)
              if (g[r] & (1 << (4 - c)))
                cv.rect(cx0 + c * s + ox, yy + r * s + oy, cx0 + c * s + s - 1 + ox, yy + r * s + s - 1 + oy, color);
          cx0 += 6 * s;
        }
      }
    }
    ly += 9 * s;
  }
}

// ---------------------------------------------------------------------------
// World ↔ pixel mapping  (north up: top row = z −1000; east = +X = right)
// ---------------------------------------------------------------------------

const toPx = (x) => ((x + 1000) / REGION) * W;
const toPy = (z) => ((z + 1000) / REGION) * H;
const pxToX = (i) => -1000 + ((i + 0.5) * REGION) / W;
const pxToZ = (j) => -1000 + ((j + 0.5) * REGION) / H;

// ---------------------------------------------------------------------------
// Hypsometric depth-tint ramp
// ---------------------------------------------------------------------------

const RAMP = [
  [-80, [6, 16, 34]],
  [-55, [10, 30, 58]],
  [-36, [18, 62, 92]],
  [-20, [32, 124, 138]],
  [-10, [62, 168, 158]],
  [-3, [128, 214, 196]],
  [-0.01, [168, 232, 214]],
  [0.01, [227, 214, 176]],
  [8, [188, 196, 132]],
  [40, [96, 142, 86]],
  [110, [124, 132, 104]],
  [170, [186, 190, 178]],
  [200, [235, 238, 235]],
];

function colorAt(h) {
  if (h <= RAMP[0][0]) return RAMP[0][1];
  for (let i = 1; i < RAMP.length; i++) {
    if (h <= RAMP[i][0]) {
      const [h0, c0] = RAMP[i - 1];
      const [h1, c1] = RAMP[i];
      const t = (h - h0) / (h1 - h0);
      return [
        Math.round(lerp(c0[0], c1[0], t)),
        Math.round(lerp(c0[1], c1[1], t)),
        Math.round(lerp(c0[2], c1[2], t)),
      ];
    }
  }
  return RAMP[RAMP.length - 1][1];
}

function bandOf(h) {
  if (h >= 0) return 4;      // land
  if (h > -10) return 3;     // bright shallow / lagoon band
  if (h > -36) return 2;     // reef shelf band
  if (h > -60) return 1;     // deep
  return 0;                  // deepest (trench / hazard floor)
}

// ---------------------------------------------------------------------------
// Ink palette for overlays
// ---------------------------------------------------------------------------

const INK = [14, 20, 28];
const WHITE = [255, 255, 255];
const ROUTE = [255, 214, 64];
const CURRENT = [130, 222, 255];
const DISC = [255, 236, 120];

// ---------------------------------------------------------------------------
// Field helpers used by the three sketch fields
// ---------------------------------------------------------------------------

function islandDisc(h, d, r, height, p = 1.6) {
  const m = 1 - sstep(0, r, d);
  return lerp(h, height, Math.pow(m, p));
}

function islandSeg(h, d, r, height, p = 1.6) {
  const m = 1 - sstep(0, r, d);
  return lerp(h, height, Math.pow(m, p));
}

// ---------------------------------------------------------------------------
// SKETCH A — RING ATOLL
// Central lagoon ringed by a vivid-canyon reef (family F); volcanic summit
// island NE; trench pocket S outside the ring; hazy sand pocket W (family G).
// ---------------------------------------------------------------------------

function fieldA(x, z, n1, n2) {
  const wob = (n1 - 0.5) * 150;
  const wob2 = (n2 - 0.5) * 26;
  let h = -50;

  // Enclosure: W + S deep hazard water; N reef wall crest; E rocky shoal wall.
  h = lerp(h, -78, sstep(830, 980, Math.max(-x, z)));
  h = lerp(h, -5 + wob2 * 0.15, sstep(850, 940, -z) * (1 - sstep(700, 830, Math.max(-x, z))));
  h = lerp(h, -8 + wob2 * 0.15, sstep(860, 950, x) * (1 - sstep(700, 830, z)));

  // Ring reef band (family F), radius ~480 around lagoon center (−50, 50).
  const dc = hyp(x + 50, z - 50);
  const band = 1 - sstep(140, 195, Math.abs(dc - 480 + wob * 0.45));
  h = lerp(h, -22 + wob2 * 0.5, band);

  // Ring passes: N pass and SE pass stay swimmable channels.
  h = lerp(h, -38, (1 - sstep(60, 135, hyp(x + 50, z + 430))) * band);
  h = lerp(h, -36, (1 - sstep(60, 135, hyp(x - 240, z - 434))) * band);

  // Lagoon plateau: 3–10 m, slightly deeper center.
  const lag = 1 - sstep(250 + wob * 0.3, 330 + wob * 0.3, dc);
  h = lerp(h, -6 - 2.5 * (1 - sstep(80, 260, dc)), lag);

  // Hazy sand pocket W (family G), gentle flat plain.
  h = lerp(h, -42 + wob2 * 0.3, (1 - sstep(110, 260, hyp(x + 700, z - 100))) * 0.92);

  // Trench pocket S (floor −80).
  const te = eNorm(x, z, 350, 700, 290, 165, 0.25) + (n1 - 0.5) * 0.22;
  h = lerp(h, -80, 1 - sstep(0.45, 1.0, te));

  // Islands (always win): volcano summit +200 NE; two ring islands; islets.
  h = islandDisc(h, hyp(x - 430, z + 430) + wob, 345, 200, 1.8);
  h = islandDisc(h, hyp(x + 430, z - 380) + wob * 0.6, 165, 55, 1.5);
  h = islandDisc(h, hyp(x + 480, z + 180) + wob * 0.6, 135, 40, 1.5);
  h = islandDisc(h, hyp(x - 90, z - 520) + wob * 0.3, 58, 7, 1.2);
  h = islandDisc(h, hyp(x + 200, z - 480) + wob * 0.3, 52, 6, 1.2);
  h = islandDisc(h, hyp(x + 320, z + 350) + wob * 0.3, 52, 8, 1.2);
  // N-edge reef-wall rocks.
  h = islandDisc(h, hyp(x + 400, z + 905) + wob * 0.2, 42, 4, 1.1);
  h = islandDisc(h, hyp(x - 20, z + 895) + wob * 0.2, 40, 4, 1.1);
  h = islandDisc(h, hyp(x - 380, z + 910) + wob * 0.2, 42, 4, 1.1);

  h += (n2 - 0.5) * 4;
  return clamp(h, -80, 200);
}

const SKETCH_A = {
  id: 'A',
  name: 'RING ATOLL',
  seed: 60418001,
  field: fieldA,
  legendCorner: 'bl',
  zoneLabels: [
    { x: -50, z: 130, t: 'LAGOON 3-10 M', s: 3 },
    { x: -50, z: -190, t: 'BRIGHT SHALLOW BAND', s: 2 },
    { x: -160, z: 660, t: 'F - VIVID CANYON\nREEF 10-36 M', s: 3 },
    { x: 520, z: 140, t: 'F REEF (E ARC)', s: 2 },
    { x: -700, z: 40, t: 'G - HAZY SAND PLAIN', s: 3 },
    { x: -700, z: 100, t: 'APPROX 40-45 M', s: 2 },
    { x: 240, z: 835, t: 'TRENCH POCKET TO -80 M', s: 3 },
    { x: 430, z: -500, t: 'VOLCANO ISLAND +200 M', s: 3 },
    { x: 430, z: -260, t: 'SANDY BEACH (S SHORE)', s: 2 },
    { x: 560, z: -600, t: 'CLIFF COAST (NE)', s: 2 },
    { x: -300, z: 545, t: 'SW ISLAND +55 M\nROCKY SHORE', s: 2 },
    { x: -480, z: -250, t: 'W ISLAND +40 M', s: 2 },
    { x: 240, z: -390, t: 'COVE', s: 2 },
    { x: 0, z: -900, t: 'ENCLOSURE: REEF WALL (N)', s: 2 },
    { x: -890, z: -560, t: 'ENCLOSURE:\nDEEP HAZARD (W)', s: 2 },
    { x: -100, z: 930, t: 'ENCLOSURE: DEEP HAZARD WATER (S)', s: 2 },
    { x: 880, z: 420, t: 'ENCLOSURE:\nSHOAL\nWALL (E)', s: 2 },
    { x: -320, z: 360, t: 'CORRIDOR (3 MASSES)', s: 2 },
    { x: -660, z: 170, t: 'PLAIN (1 SILHOUETTE)', s: 2 },
  ],
  markers: [
    { type: 'spawn', x: -50, z: 50, t: 'SPAWN', tx: -50, tz: 20 },
    { type: 'breach', x: -140, z: -80, t: 'B1: SEES VOLCANO SUMMIT\n+ RING ISLETS', tx: -240, tz: -30 },
    { type: 'breach', x: 400, z: 500, t: 'B2: SEES VOLCANO SKYLINE\n+ OPEN S WATER', tx: 440, tz: 555 },
    { type: 'breach', x: -565, z: 30, t: 'B3: SEES W + SW ISLANDS\n+ REEF WALL LINE', tx: -600, tz: -150 },
    { type: 'arch', x: 240, z: 430, t: 'ARCH 6 M (SE PASS)', tx: 150, tz: 385 },
    { type: 'cave', x: 300, z: -250, t: 'SHORT CAVE (FAMILY D)\nVOLCANO FOOT', tx: 130, tz: -265 },
    { type: 'ruin', x: 120, z: 210, t: 'RUIN - SUBMERGED\nCOLONNADE', tx: 250, tz: 195 },
    { type: 'ruin', x: 270, z: -205, t: 'RUIN - SHORELINE', tx: 430, tz: -160 },
    { type: 'ruin', x: 240, z: 610, t: 'WRECK - SUBMERGED', tx: 120, tz: 665 },
    { type: 'spire', x: -240, z: 500 },
    { type: 'spire', x: 60, z: 560 },
    { type: 'spire', x: 420, z: 260 },
    { type: 'spirelab', x: 30, z: 520, t: 'SPIRES 6-16 M (3)', tx: 60, tz: 505 },
    { type: 'spire', x: -650, z: -30 },
    { type: 'discovery', x: 470, z: 745, t: 'OPTIONAL DISCOVERY', tx: 645, tz: 745 },
  ],
  currents: [
    { x: -50, z: -470, dx: 0, dz: 1, t: 'CURRENT (N PASS,\nINTO LAGOON)', tx: 60, tz: -520 },
  ],
  route: [
    [-50, 50], [-60, -180], [-50, -430], [100, -380], [300, -250], [430, -60],
    [400, 140], [240, 430], [310, 555], [300, 680], [140, 610], [-70, 530],
    [-170, 290], [-110, 150], [-50, 50],
  ],
};

// ---------------------------------------------------------------------------
// SKETCH B — BARRIER ARC
// High ridge island across the N; lagoon along its S shore; W–E barrier reef
// (family B) with two passes; trench S of the barrier; desaturated plain SW
// (family E); deep cavern (family J) in the trench wall; optional E2 shaft.
// ---------------------------------------------------------------------------

function fieldB(x, z, n1, n2) {
  const wob = (n1 - 0.5) * 150;
  const wob2 = (n2 - 0.5) * 26;
  let h = -48;

  // Enclosure: W + S deep hazard; E reef wall; N is the ridge island's cliffs.
  h = lerp(h, -76, sstep(830, 980, Math.max(-x, z)));
  h = lerp(h, -6 + wob2 * 0.15, sstep(855, 945, x) * (1 - sstep(680, 820, z)));

  // Barrier reef arc W→E across the middle (family B), two capsules.
  const dbar = Math.min(
    dSeg(x, z, -700, 150, -250, 60),
    dSeg(x, z, -250, 60, 250, 80),
    dSeg(x, z, 250, 80, 700, 180),
  );
  const bband = 1 - sstep(95, 150, dbar + wob * 0.4);
  h = lerp(h, -18 + wob2 * 0.5, bband);

  // Barrier passes (west pass carries the arch; east pass carries the current).
  h = lerp(h, -36, (1 - sstep(55, 120, hyp(x + 350, z - 95))) * bband);
  h = lerp(h, -38, (1 - sstep(55, 120, hyp(x - 350, z - 120))) * bband);

  // Lagoon band along the big island's S shore.
  const dlag = dSeg(x, z, -550, -380, 420, -360);
  h = lerp(h, -6 - 2 * (1 - sstep(40, 120, dlag)), 1 - sstep(120 + wob * 0.25, 185 + wob * 0.25, dlag));

  // Desaturated plain SW (family E).
  h = lerp(h, -45 + wob2 * 0.3, (1 - sstep(120, 280, hyp(x + 550, z - 420))) * 0.92);

  // Trench S of barrier (floor −80), elongated W–E.
  const te = eNorm(x, z, 50, 560, 430, 160, 0.06) + (n1 - 0.5) * 0.2;
  h = lerp(h, -80, 1 - sstep(0.45, 1.0, te));

  // Islands: N ridge (+200 summit), E barrier island, W island, barrier islets.
  const dridge = dSeg(x, z, -550, -680, 450, -640) + wob;
  h = islandSeg(h, dridge, 300, 165, 1.5);
  h = islandDisc(h, hyp(x + 100, z + 660) + wob * 0.5, 300, 200, 1.7); // summit
  h = islandDisc(h, hyp(x - 620, z - 165) + wob * 0.6, 140, 55, 1.5);
  h = islandDisc(h, hyp(x + 700, z + 280) + wob * 0.6, 120, 45, 1.5);
  h = islandDisc(h, hyp(x + 600, z - 130) + wob * 0.3, 50, 5, 1.2);
  h = islandDisc(h, hyp(x + 100, z - 55) + wob * 0.3, 55, 7, 1.2);
  h = islandDisc(h, hyp(x - 150, z - 70) + wob * 0.3, 48, 4, 1.2);
  // E-edge wall rocks.
  h = islandDisc(h, hyp(x - 905, z + 300) + wob * 0.2, 40, 4, 1.1);
  h = islandDisc(h, hyp(x - 895, z - 60) + wob * 0.2, 42, 4, 1.1);

  h += (n2 - 0.5) * 4;
  return clamp(h, -80, 200);
}

const SKETCH_B = {
  id: 'B',
  name: 'BARRIER ARC',
  seed: 60418002,
  field: fieldB,
  legendCorner: 'br',
  zoneLabels: [
    { x: -350, z: -370, t: 'LAGOON 3-10 M', s: 3 },
    { x: -350, z: -315, t: 'BRIGHT SHALLOW BAND', s: 2 },
    { x: -520, z: 20, t: 'B - SHALLOW REEF\nBARRIER 10-36 M', s: 3 },
    { x: -650, z: 320, t: 'E - DESATURATED PLAIN', s: 3 },
    { x: -650, z: 380, t: 'APPROX 45 M', s: 2 },
    { x: 60, z: 640, t: 'TRENCH TO -80 M', s: 3 },
    { x: -100, z: -740, t: 'RIDGE ISLAND +200 M', s: 3 },
    { x: -100, z: -560, t: 'SANDY BEACH (S SHORE)', s: 2 },
    { x: 150, z: -920, t: 'ENCLOSURE: CLIFF COAST (N)', s: 2 },
    { x: 620, z: 210, t: 'E BARRIER\nISLAND +55 M', s: 2 },
    { x: -700, z: -350, t: 'W ISLAND +45 M\nROCKY SHORE', s: 2 },
    { x: 330, z: -390, t: 'COVE', s: 2 },
    { x: -890, z: 620, t: 'ENCLOSURE:\nDEEP\nHAZARD (W)', s: 2 },
    { x: 160, z: 900, t: 'ENCLOSURE: DEEP HAZARD WATER (S)', s: 2 },
    { x: 880, z: -400, t: 'ENCLOSURE:\nREEF\nWALL (E)', s: 2 },
    { x: 120, z: -180, t: 'CHANNEL CORRIDOR (3 MASSES)', s: 2 },
    { x: -680, z: 520, t: 'PLAIN (1 SILHOUETTE)', s: 2 },
  ],
  markers: [
    { type: 'spawn', x: -60, z: -370, t: 'SPAWN', tx: -60, tz: -330 },
    { type: 'breach', x: -500, z: -380, t: 'B1: SEES SUMMIT RIDGE\n+ CLIFF WALL', tx: -500, tz: -465 },
    { type: 'breach', x: 0, z: 270, t: 'B2: SEES BARRIER ISLET LINE\n+ RIDGE ISLAND BEHIND', tx: 25, tz: 300 },
    { type: 'breach', x: 480, z: 300, t: 'B3: SEES E ISLAND\n+ TRENCH WATER', tx: 360, tz: 385 },
    { type: 'arch', x: -350, z: 95, t: 'ARCH 7 M (W PASS)', tx: -440, tz: 145 },
    { type: 'cave', x: 120, z: 470, t: 'DEEP CAVERN (FAMILY J)\nTRENCH N WALL', tx: 145, tz: 440 },
    { type: 'shaft', x: 430, z: 200, t: 'E2 SHAFT (OPTIONAL)', tx: 555, tz: 235 },
    { type: 'ruin', x: 100, z: -450, t: 'DOCK RUIN - SHORELINE', tx: 150, tz: -510 },
    { type: 'ruin', x: -30, z: 90, t: 'RUIN - SUBMERGED\nTEMPLE', tx: -5, tz: 115 },
    { type: 'ruin', x: -420, z: 350, t: 'WRECK - SUBMERGED', tx: -310, tz: 315 },
    { type: 'spire', x: -50, z: -80 },
    { type: 'spire', x: 220, z: -60 },
    { type: 'spire', x: 420, z: -40 },
    { type: 'spire', x: -480, z: 110 },
    { type: 'spire', x: 500, z: 150 },
    { type: 'spirelab', x: 220, z: -95, t: 'SPIRES 6-16 M (5)', tx: 250, tz: -130 },
    { type: 'spire', x: -560, z: 460 },
    { type: 'discovery', x: -300, z: 560, t: 'OPTIONAL DISCOVERY', tx: -270, tz: 600 },
  ],
  currents: [
    { x: 350, z: 170, dx: 0, dz: -1, t: 'CURRENT (E PASS,\nS TO N)', tx: 490, tz: 120 },
  ],
  route: [
    [-60, -370], [200, -390], [420, -320], [480, -120], [390, 80], [330, 300],
    [300, 420], [120, 470], [-30, 510], [-150, 520], [-300, 560], [-420, 380],
    [-350, 95], [-260, -60], [-180, -180], [-100, -290], [-60, -370],
  ],
};

// ---------------------------------------------------------------------------
// SKETCH C — TWIN BAY
// Crescent island W with +200 summit; north bay = lagoon, south bay = kelp
// reef (family C); headland + islet-chain corridor with the arch between the
// bays; N–S trench in the E; desaturated plain SE (family E); a short family-D
// cave under the headland links the two bays.
// ---------------------------------------------------------------------------

function fieldC(x, z, n1, n2) {
  const wob = (n1 - 0.5) * 150;
  const wob2 = (n2 - 0.5) * 26;
  let h = -46;

  // Enclosure: N + S deep hazard; E reef wall; W is the crescent's cliff back.
  h = lerp(h, -76, sstep(830, 980, Math.abs(z)));
  h = lerp(h, -6 + wob2 * 0.15, sstep(855, 945, x) * (1 - sstep(680, 820, Math.abs(z))));

  // North bay lagoon.
  const dlag = hyp(x + 180, z + 380);
  h = lerp(h, -6 - 2 * (1 - sstep(60, 200, dlag)), 1 - sstep(230 + wob * 0.25, 300 + wob * 0.25, dlag));

  // South bay kelp reef shelf (family C).
  h = lerp(h, -20 + wob2 * 0.5, 1 - sstep(230, 330, hyp(x + 180, z - 300) + wob * 0.4));

  // Desaturated plain SE (family E).
  h = lerp(h, -44 + wob2 * 0.3, (1 - sstep(100, 240, hyp(x - 140, z - 660))) * 0.92);

  // Trench running N–S in the E (floor −80).
  const dt = dSeg(x, z, 560, -250, 520, 180);
  h = lerp(h, -80, 1 - sstep(70, 170, dt + wob * 0.3));

  // Crescent island W (+200 summit), capsule arc, cliffs to the W edge.
  const dcres = Math.min(
    dSeg(x, z, -650, -520, -780, -80),
    dSeg(x, z, -780, -80, -620, 420),
  ) + wob;
  h = islandSeg(h, dcres, 230, 170, 1.5);
  h = islandDisc(h, hyp(x + 760, z + 100) + wob * 0.5, 215, 200, 1.7); // summit
  // Headland peninsula + islet chain (corridor).
  h = islandSeg(h, dSeg(x, z, -600, -40, -280, -60) + wob * 0.5, 120, 25, 1.4);
  h = islandDisc(h, hyp(x + 80, z + 70) + wob * 0.3, 55, 6, 1.2);
  h = islandDisc(h, hyp(x - 90, z + 80) + wob * 0.3, 46, 4, 1.2);
  h = islandDisc(h, hyp(x - 230, z + 90) + wob * 0.3, 42, 3, 1.2);
  // NE island and S bay-mouth island.
  h = islandDisc(h, hyp(x - 480, z + 560) + wob * 0.6, 190, 70, 1.5);
  h = islandDisc(h, hyp(x + 380, z - 640) + wob * 0.6, 125, 45, 1.5);
  // E-edge wall rocks.
  h = islandDisc(h, hyp(x - 900, z + 480) + wob * 0.2, 40, 4, 1.1);
  h = islandDisc(h, hyp(x - 905, z - 620) + wob * 0.2, 42, 4, 1.1);

  h += (n2 - 0.5) * 4;
  return clamp(h, -80, 200);
}

const SKETCH_C = {
  id: 'C',
  name: 'TWIN BAY',
  seed: 60418003,
  field: fieldC,
  legendCorner: 'br',
  zoneLabels: [
    { x: -180, z: -550, t: 'NORTH BAY\nLAGOON 3-10 M', s: 3 },
    { x: 30, z: -480, t: 'BRIGHT SHALLOW BAND', s: 2 },
    { x: -260, z: 360, t: 'C - KELP REEF\nSOUTH BAY 10-36 M', s: 3 },
    { x: 140, z: 610, t: 'E - DESATURATED\nPLAIN APPROX 44 M', s: 3 },
    { x: 680, z: -40, t: 'TRENCH\nTO -80 M', s: 3 },
    { x: -700, z: 220, t: 'CRESCENT ISLAND\n+200 M SUMMIT N', s: 3 },
    { x: -540, z: -400, t: 'SANDY BEACH', s: 2 },
    { x: -900, z: -300, t: 'CLIFF\nCOAST (W)', s: 2 },
    { x: 480, z: -640, t: 'NE ISLAND +70 M\nROCKY SHORE', s: 2 },
    { x: -380, z: 640, t: 'S ISLAND +45 M', s: 2 },
    { x: -330, z: -108, t: 'HEADLAND +25 M', s: 2 },
    { x: -420, z: 180, t: 'COVE', s: 2 },
    { x: 40, z: -185, t: 'ISLET CORRIDOR (3 MASSES)', s: 2 },
    { x: -60, z: -910, t: 'ENCLOSURE: DEEP HAZARD WATER (N)', s: 2 },
    { x: -60, z: 920, t: 'ENCLOSURE: DEEP HAZARD WATER (S)', s: 2 },
    { x: 880, z: -420, t: 'ENCLOSURE:\nREEF\nWALL (E)', s: 2 },
    { x: 140, z: 690, t: 'PLAIN (1 SILHOUETTE)', s: 2 },
  ],
  markers: [
    { type: 'spawn', x: -180, z: -380, t: 'SPAWN', tx: -180, tz: -345 },
    { type: 'breach', x: -280, z: -300, t: 'B1: SEES CRESCENT SUMMIT\n+ NE ISLAND', tx: -240, tz: -245 },
    { type: 'breach', x: -100, z: 420, t: 'B2: SEES CRESCENT RIDGE\n+ S ISLAND', tx: -140, tz: 490 },
    { type: 'breach', x: 430, z: -300, t: 'B3: SEES BOTH E ISLANDS\n+ OPEN HORIZON', tx: 520, tz: -270 },
    { type: 'arch', x: -40, z: -70, t: 'ARCH 5 M (ISLET GAP)', tx: -105, tz: -20 },
    { type: 'cave', x: -420, z: 30, t: 'SHORT CAVE (FAMILY D)\nUNDER HEADLAND', tx: -390, tz: 60 },
    { type: 'cave', x: 450, z: -30, t: 'CAVE 2 (OPTIONAL)\nTRENCH W WALL', tx: 320, tz: 0 },
    { type: 'ruin', x: -470, z: -300, t: 'RUIN - SHORELINE\nSETTLEMENT', tx: -450, tz: -215 },
    { type: 'ruin', x: -120, z: 260, t: 'RUIN - SUBMERGED\nCOLUMN FIELD', tx: -60, tz: 310 },
    { type: 'ruin', x: 440, z: 160, t: 'WRECK - SUBMERGED', tx: 310, tz: 130 },
    { type: 'spire', x: -300, z: 420 },
    { type: 'spire', x: 100, z: 330 },
    { type: 'spirelab', x: 60, z: 390, t: 'SPIRES 6-16 M (2)', tx: 60, tz: 390 },
    { type: 'spire', x: 250, z: 570 },
    { type: 'discovery', x: 390, z: 290, t: 'OPTIONAL DISCOVERY', tx: 260, tz: 315 },
  ],
  currents: [
    { x: 260, z: -200, dx: 0.83, dz: -0.55, t: 'CURRENT (FUNNEL,\nTOWARD TRENCH)', tx: 130, tz: -300 },
  ],
  cavePassage: [[-430, -150], [-420, 30]],
  route: [
    [-180, -380], [-30, -260], [10, -90], [280, -210], [430, -300], [500, -120],
    [465, 90], [420, 200], [390, 290], [200, 470], [-120, 260], [-420, 30],
    [-430, -150], [-180, -380],
  ],
};

// ---------------------------------------------------------------------------
// Marker glyph drawing
// ---------------------------------------------------------------------------

function drawMarker(cv, m) {
  const px = toPx(m.x), py = toPy(m.z);
  switch (m.type) {
    case 'spawn':
      cv.disc(px, py, 13, INK);
      cv.disc(px, py, 10, WHITE);
      cv.disc(px, py, 4, INK);
      break;
    case 'breach':
      cv.tri(px, py - 15, px - 13, py + 10, px + 13, py + 10, INK);
      cv.tri(px, py - 11, px - 9, py + 7, px + 9, py + 7, WHITE);
      break;
    case 'arch': {
      cv.rect(px - 19, py - 19, px + 19, py - 10, INK);
      cv.rect(px - 19, py - 19, px - 10, py + 16, INK);
      cv.rect(px + 10, py - 19, px + 19, py + 16, INK);
      cv.rect(px - 16, py - 16, px + 16, py - 13, [255, 158, 64]);
      cv.rect(px - 16, py - 16, px - 13, py + 13, [255, 158, 64]);
      cv.rect(px + 13, py - 16, px + 16, py + 13, [255, 158, 64]);
      break;
    }
    case 'cave': {
      // Cave-mouth dome.
      for (let y = 0; y <= 14; y++)
        for (let x = -14; x <= 14; x++)
          if (x * x + y * y <= 196) cv.set(px + x, py + 12 - y, INK);
      for (let y = 0; y <= 10; y++)
        for (let x = -10; x <= 10; x++)
          if (x * x + y * y <= 100) cv.set(px + x, py + 10 - y, [150, 100, 200]);
      break;
    }
    case 'shaft':
      cv.ring(px, py, 11, 5, INK);
      cv.ring(px, py, 11, 3, [130, 222, 255]);
      cv.disc(px, py, 3, INK);
      break;
    case 'ruin':
      cv.rect(px - 12, py - 12, px + 12, py + 12, INK);
      cv.rect(px - 9, py - 9, px + 9, py + 9, WHITE);
      cv.rect(px - 5, py - 9, px - 3, py + 9, INK);
      cv.rect(px + 3, py - 9, px + 5, py + 9, INK);
      break;
    case 'spire':
      cv.tri(px, py - 13, px - 9, py + 9, px + 9, py + 9, INK);
      cv.tri(px, py - 9, px - 6, py + 6, px + 6, py + 6, [186, 190, 178]);
      break;
    case 'spirelab':
      break; // label only
    case 'discovery':
      cv.disc(px, py, 13, INK);
      cv.disc(px, py, 10, DISC);
      drawText(cv, px, py - 7, '?', 2, INK, null, 'c');
      break;
  }
  if (m.t) {
    const lx = toPx(m.tx !== undefined ? m.tx : m.x);
    const ly = toPy(m.tz !== undefined ? m.tz : m.z) + 16;
    drawText(cv, lx, ly, m.t, 2, WHITE, INK, 'c');
  }
}

function drawArrow(cv, px, py, dx, dy, len, col) {
  const nx = dx / hyp(dx, dy), ny = dy / hyp(dx, dy);
  const tx = px + nx * len, ty = py + ny * len;
  cv.line(px, py, tx, ty, 5, INK);
  cv.line(px, py, tx, ty, 3, col);
  const bx = tx - nx * 14, by = ty - ny * 14;
  cv.tri(tx + nx * 4, ty + ny * 4, bx - ny * 9, by + nx * 9, bx + ny * 9, by - nx * 9, INK);
  cv.tri(tx, ty, bx - ny * 6, by + nx * 6, bx + ny * 6, by - nx * 6, col);
}

// ---------------------------------------------------------------------------
// Rendering one sketch
// ---------------------------------------------------------------------------

function routeLengthMeters(route) {
  let L = 0;
  for (let i = 1; i < route.length; i++)
    L += hyp(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]);
  return L;
}

function renderSketch(sk) {
  const cv = new Canvas(W, H);
  const field = new Float32Array(W * H);

  // --- depth field ---
  for (let j = 0; j < H; j++) {
    const z = pxToZ(j);
    for (let i = 0; i < W; i++) {
      const x = pxToX(i);
      const n1 = fbm(x * 0.006, z * 0.006, sk.seed);
      const n2 = fbm(x * 0.02, z * 0.02, sk.seed + 7);
      field[j * W + i] = sk.field(x, z, n1, n2);
    }
  }

  // --- hypsometric fill ---
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const c = colorAt(field[j * W + i]);
      const o = (j * W + i) * 3;
      cv.buf[o] = c[0]; cv.buf[o + 1] = c[1]; cv.buf[o + 2] = c[2];
    }

  // --- depth-band boundary lines (shoreline dark; −10 / −36 subtle) ---
  for (let j = 0; j < H - 1; j++)
    for (let i = 0; i < W - 1; i++) {
      const b = bandOf(field[j * W + i]);
      const br = bandOf(field[j * W + i + 1]);
      const bd = bandOf(field[(j + 1) * W + i]);
      if (b !== br || b !== bd) {
        const shore = b === 4 || br === 4 || bd === 4;
        cv.blend(i, j, INK, shore ? 0.85 : 0.35);
      }
    }

  // --- 250 m grid ---
  for (let g = -750; g <= 750; g += 250) {
    const p = Math.round(toPx(g));
    for (let j = 0; j < H; j++) { cv.blend(p, j, WHITE, 0.22); cv.blend(j, Math.round(toPy(g)), WHITE, 0.22); }
  }
  cv.frame(0, 0, W - 1, H - 1, 3, INK);
  for (let g = -750; g <= 750; g += 250) {
    const label = (g > 0 ? '+' : '') + g;
    drawText(cv, toPx(g) + 5, 8, label, 2, WHITE, INK, 'l');
    drawText(cv, 6, toPy(g) + 4, label, 2, WHITE, INK, 'l');
  }
  drawText(cv, W - 160, 34, 'X EAST +', 2, WHITE, INK, 'l');
  drawText(cv, 6, toPy(-750) + 26, 'Z SOUTH +', 2, WHITE, INK, 'l');

  // --- zone labels ---
  for (const L of sk.zoneLabels)
    drawText(cv, toPx(L.x), toPy(L.z), L.t, L.s, WHITE, INK, 'c');

  // --- swim loop route (dashed, with direction chevrons) ---
  const rpts = sk.route.map(([x, z]) => [toPx(x), toPy(z)]);
  let acc = 0;
  for (let i = 1; i < rpts.length; i++) {
    const [ax, ay] = rpts[i - 1], [bx, by] = rpts[i];
    const len = hyp(bx - ax, by - ay);
    for (let s = 0; s <= len; s += 1) {
      const t = s / len;
      const X = lerp(ax, bx, t), Y = lerp(ay, by, t);
      const phase = (acc + s) % 30;
      if (phase < 18) { cv.disc(X, Y, 4, INK); cv.disc(X, Y, 2.5, ROUTE); }
    }
    // one chevron per segment midpoint
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    const nx = (bx - ax) / len, ny = (by - ay) / len;
    cv.tri(mx + nx * 12, my + ny * 12, mx - nx * 8 - ny * 9, my - ny * 8 + nx * 9,
      mx - nx * 8 + ny * 9, my - ny * 8 - nx * 9, INK);
    cv.tri(mx + nx * 9, my + ny * 9, mx - nx * 6 - ny * 6, my - ny * 6 + nx * 6,
      mx - nx * 6 + ny * 6, my - ny * 6 - nx * 6, ROUTE);
    acc += len;
  }
  // --- optional cave passage (dashed, drawn over the route so the cave
  //     segment of the loop reads as "through the cave") ---
  if (sk.cavePassage) {
    const [a, b] = sk.cavePassage;
    const ax = toPx(a[0]), ay = toPy(a[1]), bx = toPx(b[0]), by = toPy(b[1]);
    const len = hyp(bx - ax, by - ay);
    for (let s = 0; s <= len; s += 1)
      if (s % 20 < 12) {
        cv.disc(lerp(ax, bx, s / len), lerp(ay, by, s / len), 5, INK);
        cv.disc(lerp(ax, bx, s / len), lerp(ay, by, s / len), 3.5, [150, 100, 200]);
      }
  }

  const loopM = Math.round(routeLengthMeters(sk.route));
  const loopMin = loopM / 5 / 60;             // straight cruise at 5 m/s
  const loopMinSlow = loopM / 3.5 / 60;       // exploring pace

  // --- currents ---
  for (const c of sk.currents) {
    const px = toPx(c.x), py = toPy(c.z);
    const perp = [-c.dz, c.dx];
    for (const k of [-1, 0, 1])
      drawArrow(cv, px + perp[0] * 26 * k, py + perp[1] * 26 * k, c.dx, c.dz, 70, CURRENT);
    if (c.t) drawText(cv, toPx(c.tx), toPy(c.tz), c.t, 2, WHITE, INK, 'c');
  }

  // --- markers ---
  for (const m of sk.markers) drawMarker(cv, m);

  // --- north arrow ---
  cv.disc(W - 70, 90, 34, INK);
  cv.disc(W - 70, 90, 31, WHITE);
  cv.tri(W - 70, 66, W - 82, 102, W - 58, 102, INK);
  drawText(cv, W - 70, 108, 'N', 3, INK, null, 'c');

  // --- title strip ---
  const title = `SKETCH ${sk.id} - ${sk.name}`;
  const sub1 = 'BODYARCADE SHARED WORLD - REGION 2 KM X 2 KM';
  const sub2 = `1 PX = 1 M (2000 M / 2048 PX) - NORTH UP (-Z) - SEED ${sk.seed}`;
  const sub3 = `SWIM LOOP ${loopM} M = ${loopMin.toFixed(1)} MIN AT 5 M/S CRUISE (${loopMinSlow.toFixed(1)} MIN EXPLORING)`;
  const tw = Math.max(textWidth(title, 4), textWidth(sub1, 2), textWidth(sub2, 2), textWidth(sub3, 2));
  cv.rect(16, 16, 16 + tw + 28, 148, INK);
  cv.frame(16, 16, 16 + tw + 28, 148, 2, WHITE);
  drawText(cv, 30, 28, title, 4, WHITE, null, 'l');
  drawText(cv, 30, 74, sub1, 2, WHITE, null, 'l');
  drawText(cv, 30, 98, sub2, 2, WHITE, null, 'l');
  drawText(cv, 30, 122, sub3, 2, [255, 214, 64], null, 'l');

  // --- legend panel ---
  drawLegend(cv, sk);

  return { png: encodePNG(W, H, cv.buf), loopM };
}

function drawLegend(cv, sk) {
  const PW = 520, PH = 660;
  const x0 = sk.legendCorner === 'bl' ? 20 : W - PW - 20;
  const y0 = H - PH - 20;
  cv.rect(x0, y0, x0 + PW, y0 + PH, INK);
  cv.frame(x0, y0, x0 + PW, y0 + PH, 2, WHITE);
  drawText(cv, x0 + 18, y0 + 14, 'LEGEND', 3, WHITE, null, 'l');

  // Depth ramp bar (left column).
  const rx = x0 + 22, ry = y0 + 58, rw = 40, rh = 380;
  for (let y = 0; y < rh; y++) {
    const hval = lerp(200, -80, y / rh);
    const c = colorAt(hval);
    for (let x = 0; x < rw; x++) cv.set(rx + x, ry + y, c);
  }
  cv.frame(rx - 1, ry - 1, rx + rw, ry + rh, 1, WHITE);
  const ticks = [200, 100, 0, -10, -36, -80];
  for (const t of ticks) {
    const y = ry + Math.round(((200 - t) / 280) * rh);
    cv.rect(rx + rw, y, rx + rw + 8, y + 1, WHITE);
    drawText(cv, rx + rw + 14, y - 6, `${t > 0 ? '+' : ''}${t} M`, 2, WHITE, null, 'l');
  }
  drawText(cv, rx, ry + rh + 12, 'DEPTH TINT', 2, WHITE, null, 'l');
  drawText(cv, rx, ry + rh + 34, '(HYPSOMETRIC)', 2, WHITE, null, 'l');

  // Key rows (right column).
  const kx = x0 + 210, kw = 36;
  let ky = y0 + 66;
  const row = (draw, label) => {
    draw(kx + kw / 2, ky + 10);
    drawText(cv, kx + kw + 14, ky + 3, label, 2, WHITE, null, 'l');
    ky += 42;
  };
  row((px, py) => { cv.disc(px, py, 11, WHITE); cv.disc(px, py, 4, INK); }, 'SPAWN POINT');
  row((px, py) => { cv.tri(px, py - 11, px - 9, py + 7, px + 9, py + 7, WHITE); }, 'BREACH SIGHTLINE');
  row((px, py) => {
    cv.rect(px - 11, py - 10, px + 11, py - 6, [255, 158, 64]);
    cv.rect(px - 11, py - 10, px - 7, py + 10, [255, 158, 64]);
    cv.rect(px + 7, py - 10, px + 11, py + 10, [255, 158, 64]);
  }, 'ARCH (4-8 M OPENING)');
  row((px, py) => {
    for (let y = 0; y <= 10; y++)
      for (let x = -10; x <= 10; x++)
        if (x * x + y * y <= 100) cv.set(px + x, py + 8 - y, [150, 100, 200]);
  }, 'CAVE MOUTH');
  row((px, py) => { cv.tri(px, py - 10, px - 7, py + 7, px + 7, py + 7, [186, 190, 178]); }, 'SPIRE / ROCK MASS');
  row((px, py) => {
    cv.rect(px - 10, py - 10, px + 10, py + 10, WHITE);
    cv.rect(px - 4, py - 8, px - 2, py + 8, INK);
    cv.rect(px + 2, py - 8, px + 4, py + 8, INK);
  }, 'RUIN / WRECK SITE');
  row((px, py) => { cv.disc(px, py, 10, DISC); drawText(cv, px, py - 7, '?', 2, INK, null, 'c'); }, 'OPTIONAL DISCOVERY');
  row((px, py) => { drawArrow(cv, px - 14, py, 1, 0, 28, CURRENT); }, 'CURRENT');
  row((px, py) => {
    for (let x = -16; x <= 16; x += 8) cv.disc(px + x, py, 2.5, ROUTE);
  }, 'SWIM LOOP (5-10 MIN)');
  if (sk.markers.some((m) => m.type === 'shaft')) {
    row((px, py) => { cv.ring(px, py, 8, 3, [130, 222, 255]); cv.disc(px, py, 2, WHITE); }, 'E2 SHAFT (OPTIONAL)');
  }
  if (sk.cavePassage) {
    row((px, py) => {
      for (let x = -16; x <= 16; x += 7) cv.disc(px + x, py, 2.5, [150, 100, 200]);
    }, 'CAVE PASSAGE (DASHED)');
  }

  // Scale bar: 250 m.
  const sy = y0 + PH - 80;
  const sbw = Math.round(250 / M_PER_PX);
  cv.rect(x0 + 210, sy, x0 + 210 + sbw, sy + 6, WHITE);
  cv.rect(x0 + 210, sy - 4, x0 + 211, sy + 10, WHITE);
  cv.rect(x0 + 209 + sbw, sy - 4, x0 + 210 + sbw, sy + 10, WHITE);
  drawText(cv, x0 + 210, sy + 16, 'SCALE 250 M - GRID 250 M', 2, WHITE, null, 'l');
  drawText(cv, x0 + 18, y0 + PH - 34, `DETERMINISTIC AUTHORING SKETCH - SEED ${sk.seed}`, 2, [130, 222, 255], null, 'l');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const SKETCHES = [SKETCH_A, SKETCH_B, SKETCH_C];

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

function renderAll() {
  const out = {};
  for (const sk of SKETCHES) {
    const { png, loopM } = renderSketch(sk);
    out[`sketch-${sk.id}.png`] = { png, loopM, name: sk.name };
  }
  return out;
}

const verifyMode = process.argv.includes('--verify');

if (verifyMode) {
  console.log('Determinism verify: rendering all sketches twice and comparing hashes...');
  const run1 = renderAll();
  const run2 = renderAll();
  let ok = true;
  for (const file of Object.keys(run1)) {
    const h1 = sha256(run1[file].png);
    const h2 = sha256(run2[file].png);
    const same = h1 === h2;
    ok &&= same;
    let diskNote = 'no file on disk';
    const p = join(OUT_DIR, file);
    if (existsSync(p)) {
      const hd = sha256(readFileSync(p));
      const dsame = hd === h1;
      ok &&= dsame;
      diskNote = dsame ? 'disk MATCH' : `disk MISMATCH (${hd.slice(0, 12)})`;
    }
    console.log(`  ${file}: run1 ${h1.slice(0, 16)} run2 ${same ? 'MATCH' : 'MISMATCH ' + h2.slice(0, 16)}; ${diskNote}`);
  }
  console.log(ok ? 'VERIFY PASS: byte-identical across runs.' : 'VERIFY FAIL');
  process.exit(ok ? 0 : 1);
} else {
  mkdirSync(OUT_DIR, { recursive: true });
  const out = renderAll();
  for (const [file, { png, loopM, name }] of Object.entries(out)) {
    writeFileSync(join(OUT_DIR, file), png);
    console.log(
      `wrote ${file} (${name}): ${png.length} bytes, sha256 ${sha256(png).slice(0, 16)}, swim loop ${loopM} m (${(loopM / 5 / 60).toFixed(1)} min at 5 m/s)`
    );
  }
}
