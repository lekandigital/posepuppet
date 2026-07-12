// Minimal PNG decoder for terrarium elevation tiles — 8-bit, non-interlaced,
// grayscale/RGB/RGBA, which is everything the AWS terrain bucket serves.
// zlib inflate comes from node; chunk parsing and scanline unfiltering are
// ~80 lines. Hand-rolled on purpose: no native image dependency means the
// bake is deterministic and installs nothing (DECISIONS.md 2026-07-11).

import { inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 };

/** Decode a PNG buffer → { width, height, channels, data: Uint8Array }. */
export function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('png: bad signature');
  let width = 0;
  let height = 0;
  let colorType = -1;
  const idat = [];
  for (let off = 8; off + 8 <= buf.length;) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('latin1', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const bitDepth = data[8];
      colorType = data[9];
      if (bitDepth !== 8) throw new Error(`png: unsupported bit depth ${bitDepth}`);
      if (!(colorType in CHANNELS)) throw new Error(`png: unsupported color type ${colorType}`);
      if (data[12] !== 0) throw new Error('png: interlaced images unsupported');
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    off += 12 + len;
  }
  if (!width || !height) throw new Error('png: missing IHDR');
  const channels = CHANNELS[colorType];
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const data = new Uint8Array(width * height * channels);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const rowIn = raw.subarray(pos, pos + stride);
    pos += stride;
    const out = y * stride;
    const prevRow = out - stride;
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? data[out + x - channels] : 0;
      const up = y > 0 ? data[prevRow + x] : 0;
      const upLeft = y > 0 && x >= channels ? data[prevRow + x - channels] : 0;
      let v = rowIn[x];
      switch (filter) {
        case 0: break;
        case 1: v += left; break;
        case 2: v += up; break;
        case 3: v += (left + up) >> 1; break;
        case 4: {
          const p = left + up - upLeft;
          const pa = Math.abs(p - left);
          const pb = Math.abs(p - up);
          const pc = Math.abs(p - upLeft);
          v += pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
          break;
        }
        default: throw new Error(`png: unknown filter ${filter} on row ${y}`);
      }
      data[out + x] = v & 0xff;
    }
  }
  return { width, height, channels, data };
}
