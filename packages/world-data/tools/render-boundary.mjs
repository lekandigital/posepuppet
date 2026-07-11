// Debug/minimap render of a boundary artifact: SVG (exact, with ODbL
// attribution text) + PNG (pure-JS even-odd scanline rasterizer + zlib PNG
// encoder — no canvas, no browser, so it runs anywhere node runs). With
// --raw it also renders the unsimplified rings through the same projection
// and viewport for a side-by-side fidelity check.
//
// Usage: node tools/render-boundary.mjs [configs/san-francisco-bay.json] [--raw]

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { ringsBbox } from './geometry.mjs';
import { assembleRawPolygons } from './build-boundary.mjs';

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ---------- minimal PNG encoder (RGB, filter 0) ----------

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

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: truecolor
  const raw = Buffer.alloc(height * (width * 3 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0; // filter: none
    rgb.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- rasterizer ----------

const LAND = [0x12, 0x16, 0x20];   // graphite
const WATER = [0x2e, 0x6b, 0xc9];  // electric blue
const SHORE = [0xa8, 0xd8, 0xff];  // pale cyan

function rasterize(polygons, viewport, width) {
  const [minx, miny, maxx, maxy] = viewport;
  const pad = 24;
  const scale = (width - 2 * pad) / (maxx - minx);
  const height = Math.round((maxy - miny) * scale) + 2 * pad;
  const toPx = ([x, y]) => [pad + (x - minx) * scale, height - pad - (y - miny) * scale];

  const rgb = Buffer.alloc(width * height * 3);
  for (let i = 0; i < width * height; i++) rgb.set(LAND, i * 3);

  const rings = polygons
    .flatMap((p) => [p.outer, ...p.holes.map((h) => h.ring)])
    .map((r) => r.map(toPx));

  // even-odd scanline fill across ALL rings — holes fall out naturally
  for (let py = 0; py < height; py++) {
    const yc = py + 0.5;
    const xs = [];
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i++) {
        const [x1, y1] = ring[i];
        const [x2, y2] = ring[(i + 1) % ring.length];
        if (y1 > yc !== y2 > yc) xs.push(x1 + ((yc - y1) * (x2 - x1)) / (y2 - y1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const from = Math.max(0, Math.ceil(xs[k] - 0.5));
      const to = Math.min(width - 1, Math.floor(xs[k + 1] - 0.5));
      for (let px = from; px <= to; px++) rgb.set(WATER, (py * width + px) * 3);
    }
  }

  // shoreline stroke: walk every segment in half-pixel steps
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[(i + 1) % ring.length];
      const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 2));
      for (let s = 0; s <= steps; s++) {
        const px = Math.round(x1 + ((x2 - x1) * s) / steps);
        const py = Math.round(y1 + ((y2 - y1) * s) / steps);
        if (px >= 0 && px < width && py >= 0 && py < height) {
          rgb.set(SHORE, (py * width + px) * 3);
        }
      }
    }
  }

  return { rgb, width, height };
}

function toSvg(artifact, viewport, width) {
  const [minx, miny, maxx, maxy] = viewport;
  const height = Math.round((width * (maxy - miny)) / (maxx - minx));
  const toPx = ([x, y]) =>
    `${(((x - minx) / (maxx - minx)) * width).toFixed(1)},${(height - ((y - miny) / (maxy - miny)) * height).toFixed(1)}`;
  const path = artifact.polygons
    .flatMap((p) => [p.outer, ...p.holes.map((h) => h.ring)])
    .map((ring) => `M${ring.map(toPx).join('L')}Z`)
    .join(' ');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height + 24}" ` +
    `viewBox="0 0 ${width} ${height + 24}">\n` +
    `<rect width="${width}" height="${height + 24}" fill="#121620"/>\n` +
    `<path d="${path}" fill="#2e6bc9" fill-rule="evenodd" stroke="#a8d8ff" stroke-width="1"/>\n` +
    `<text x="8" y="${height + 16}" font-family="monospace" font-size="11" fill="#a8d8ff">` +
    `${artifact.displayName} — ${artifact.source.attribution} (${artifact.source.license})</text>\n` +
    `</svg>\n`
  );
}

// ---------- main ----------

const args = process.argv.slice(2);
const withRaw = args.includes('--raw');
const configPath = args.filter((a) => !a.startsWith('--'))[0] ?? join(PKG_ROOT, 'configs/san-francisco-bay.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const artifact = JSON.parse(readFileSync(join(PKG_ROOT, config.out), 'utf8'));

const WIDTH = 1024;
const outDir = join(PKG_ROOT, 'data/render');
mkdirSync(outDir, { recursive: true });

const viewport = artifact.bbox;
const { rgb, width, height } = rasterize(artifact.polygons, viewport, WIDTH);
writeFileSync(join(outDir, `${artifact.name}.png`), encodePng(width, height, rgb));
writeFileSync(join(outDir, `${artifact.name}.svg`), toSvg(artifact, viewport, WIDTH));
console.log(`rendered ${artifact.name}.png (${width}x${height}) + .svg → data/render/`);

if (withRaw) {
  const { polygons: rawPolys } = assembleRawPolygons(config);
  const vp = ringsBbox(rawPolys.flatMap((p) => [p.outer, ...p.holes.map((h) => h.ring)]));
  const r = rasterize(rawPolys, vp, WIDTH);
  writeFileSync(join(outDir, `${artifact.name}-raw.png`), encodePng(r.width, r.height, r.rgb));
  console.log(`rendered ${artifact.name}-raw.png (${r.width}x${r.height})`);
}
