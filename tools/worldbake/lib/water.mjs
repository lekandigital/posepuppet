// Water-polygon stage — the absorbed Dolphin boundary module, reused
// whole. The sea/bay polygon is assembled by the SAME code that shipped
// the San Francisco Bay boundary (packages/world-data/tools/
// build-boundary.mjs, coastline-clip mode): worldbake writes the
// coastline subset of its extract as a raw cache file, synthesizes a
// boundary config, and calls buildBoundary(). One water assembler in the
// codebase, two artifact families out of it — absorption, not a rewrite.

import { join } from 'node:path';
import { buildBoundary } from '../../../packages/world-data/tools/build-boundary.mjs';
import { writeCoastlineRaw } from './osm.mjs';

export const coastlineRawPath = (cacheDir) => join(cacheDir, 'coastline.osm.json.gz');

/**
 * Assemble the sea polygon (outer + island holes) for a coastal region.
 * Returns null when the extract has no coastline (inland region — lakes
 * only). The polygons come back in the artifact's own cm-rounded local
 * frame, which shares lat0/lon0 with the world projection (both derive
 * it from the same bbox-centre rounding).
 */
export function buildSeaPolygons(config, extract, cacheDir) {
  const rawPath = coastlineRawPath(cacheDir);
  const nCoast = writeCoastlineRaw(extract, rawPath);
  if (nCoast === 0) return null;
  if (!config.water?.seed) {
    throw new Error(`${config.name}: coastline present but water.seed missing — set a known-water lat/lon`);
  }
  const boundaryConfig = {
    name: `${config.name}-sea`,
    displayName: `${config.displayName} (sea)`,
    mode: 'coastline-clip',
    source: {
      provider: 'OpenStreetMap via Overpass API (natural=coastline ways)',
      url: `https://www.openstreetmap.org/#map=13/${config.water.seed.lat}/${config.water.seed.lon}`,
      license: 'ODbL-1.0',
      attribution: '© OpenStreetMap contributors',
    },
    raw: rawPath, // absolute — build-boundary resolves it as-is
    bbox: config.bbox,
    seed: config.water.seed,
    cuts: config.water.cuts ?? [],
    islandMinAreaM2: config.water.islandMinAreaM2 ?? 200,
    islandNames: config.water.islandNames ?? [],
    simplify: config.water.simplify ?? {
      radialPreSpacingM: 5, minTriangleAreaM2: 30, minRingVerts: 12, maxPasses: 8,
    },
  };
  const artifact = buildBoundary(boundaryConfig);
  return {
    polygons: artifact.polygons.map((p) => ({
      class: 'sea',
      outer: p.outer,
      holes: p.holes.map((h) => ({ name: h.name, ring: h.ring })),
    })),
    stats: artifact.stats,
    osmBaseTimestamp: artifact.source.osmBaseTimestamp,
  };
}
