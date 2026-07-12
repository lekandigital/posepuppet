// Minimap stage: a hard-simplified vector set (water, coast, major+street
// roads, runway, spawns) sized for a corner-of-screen map, plus an
// untracked debug SVG so a human can eyeball every bake. Style-agnostic:
// geometry and classes only — colors live in profiles.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  visvalingam, simplifyRadial, ringSelfIntersects,
} from '../../../packages/world-data/tools/geometry.mjs';
import { roundRing } from './util.mjs';
import { visvalingamLine } from './layers.mjs';

export function buildMinimap(config, bboxM, layers, waterPolygons, spawns) {
  const eps = config.minimap?.minTriangleAreaM2 ?? 120;
  const simplifyRing = (ring) => {
    const pre = simplifyRadial(ring, 10);
    const out = visvalingam(pre, { minTriangleAreaM2: eps, minRingVerts: 8 });
    return ringSelfIntersects(out) ? pre : out;
  };
  const water = waterPolygons.map((p) => ({
    outer: roundRing(simplifyRing(p.outer)),
    holes: p.holes
      .map((h) => roundRing(simplifyRing(h.ring)))
      .filter((r) => r.length >= 3),
  }));
  const roads = layers.roads
    .filter((r) => r.class === 'major' || r.class === 'street')
    .map((r) => ({ class: r.class, pts: roundRing(visvalingamLine(r.pts, eps / 4)) }))
    .filter((r) => r.pts.length >= 2);
  const runways = layers.aeroways
    .filter((a) => a.class === 'runway')
    .map((a) => ({ pts: roundRing(a.pts) }));
  const [minx, miny, maxx, maxy] = bboxM;
  return {
    viewBox: [minx, miny, maxx - minx, maxy - miny].map((v) => Math.round(v * 100) / 100),
    water,
    roads,
    runways,
    spawns: spawns.map((s) => ({ kind: s.kind, pos: s.pos })),
  };
}

/** Debug SVG (y flipped so north is up). Untracked output. */
export function renderMinimapSvg(minimap, path) {
  const [x, y, w, h] = minimap.viewBox;
  const flip = ([px, py]) => `${(px - x).toFixed(1)},${(h - (py - y)).toFixed(1)}`;
  const poly = (ring) => ring.map(flip).join(' ');
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}">`,
    `<rect width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="#dddcd4"/>`,
  ];
  for (const p of minimap.water) {
    const d = [`M ${poly(p.outer)} Z`, ...p.holes.map((hh) => `M ${poly(hh)} Z`)].join(' ');
    parts.push(`<path d="${d}" fill="#7fb2c8" fill-rule="evenodd"/>`);
  }
  for (const r of minimap.roads) {
    parts.push(`<polyline points="${poly(r.pts)}" fill="none" stroke="#555" stroke-width="${r.class === 'major' ? 6 : 3}"/>`);
  }
  for (const r of minimap.runways) {
    parts.push(`<polyline points="${poly(r.pts)}" fill="none" stroke="#333" stroke-width="14" stroke-linecap="square"/>`);
  }
  for (const s of minimap.spawns) {
    const [px, py] = s.pos;
    parts.push(`<circle cx="${(px - x).toFixed(1)}" cy="${(h - (py - y)).toFixed(1)}" r="18" fill="none" stroke="#b03030" stroke-width="5"><title>${s.kind}</title></circle>`);
  }
  parts.push('</svg>');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, parts.join('\n'));
}
