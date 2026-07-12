# `bodyarcade-world/1` — the shared world contract

One baked artifact per region, consumed read-only by every Open World
profile. **Style separation is architectural**: the schema carries what
things ARE (semantic classes, geometry, elevation, graphs), never how a
profile draws them. Adding a profile must not touch this schema or the
pipeline that emits it.

Produced offline by `tools/worldbake` (see its README). Loaded at
runtime with `loadWorld()` from `@bodyarcade/world-data`, which refuses
artifacts missing OpenStreetMap attribution.

## Versioning

`format: "bodyarcade-world/1"`. Consumers hard-check the string (the
loader throws on drift). Additive fields bump nothing; breaking changes
bump to `/2` with a migration note here. The sibling water-only artifact
`bodyarcade-boundary/1` (Dolphin's contract) is unchanged and remains
supported — the world schema embeds the same polygon convention rather
than replacing it.

## Conventions

- Units metres; local tangent plane (equirectangular) at
  `projection.lat0/lon0` (bbox centre, rounded 1e-4°); x = east,
  y = north. Same convention as `bodyarcade-boundary/1`.
- Coordinates rounded to cm; elevations/widths to dm. Rings carry no
  closing duplicate; area outers CCW, holes CW; containment even-odd.
- All arrays deterministically ordered (OSM id or grid order); the whole
  artifact byte-stable for a given cache (golden-file tested).

## Sections

| section | contents | notes |
|---|---|---|
| `source` | providers (name, license, attribution), `attributionLines` (render these on-screen), OSM base timestamp, `bboxLatLon`, `inputs` (cache files + sha256), `bakedWith` | provenance is inside the artifact |
| `projection`, `units`, `bbox` | local frame; bbox in metres | |
| `terrain` | heightfield grid: `width×height` nodes every `cellSizeM` from (`originX`,`originY`), row 0 = south; `heights` = u16 little-endian base64, `elev = offsetM + u16·scaleM`; `seaLevelM`; `sourceZoom` | decode once with `decodeHeights()`, sample with `heightAt()`; terrain collision IS this grid |
| `layers.coastline` | polylines `{id, pts}` | display + shoreline reference |
| `layers.water.polygons` | `{class, name, outer, holes[{name, ring}]}` — `sea` (from the absorbed coastline-clip assembler) plus `lake/pond/reservoir` | same polygon convention as the Dolphin boundary; `worldPointInWater()` |
| `layers.waterways` | polylines, class `river/stream/canal/ditch`, `widthM` | |
| `layers.roads` | polylines, class `major/street/service/track`, `widthM`, optional `bridge/tunnel` | |
| `layers.paths` | polylines, class `footway/path/steps/cycleway/pier` | |
| `layers.buildings` | `{id, outer, heightM, name}` footprints (heights from tags or levels, defaulted per building type) | |
| `layers.landuse` | areas, class `forest/grass/farmland/wetland/beach/rock/glacier/heath/residential/industrial/commercial/cemetery` | vegetation + zone substrate |
| `layers.boundaries` | admin boundary polylines, `adminLevel` | |
| `layers.aeroways` | polylines, class `runway/taxiway` | |
| `collision` | `terrain: "heightfield"` marker; `buildings[{building, indices}]` — ear-clipped triangles indexing the footprint's own `outer` ring; `waterEdges` (closed shoreline rings) | |
| `nav.walk` | `nodes[[x,y]]`, `edges[[a,b,costCm,classCode]]`, `edgeClasses`, component stats | welded at shared vertices; pathfinding is the consumer's |
| `nav.row` | water-interior lattice (`spacingM`, `minShoreClearM`), `edges[[a,b,costCm]]`, stats | reaches every dock + dive point (asserted) |
| `minimap` | hard-simplified vectors: water, major/street roads, runways, spawn markers, `viewBox` | style-free |
| `spawns` | `{kind: airfield/walk/dock/dive, name, pos, headingDeg?, elevM?, node?}` | data-derived candidates, not hand placement |
| `transitions` | `{kind: land-to-walk/dock-to-row/row-to-dive, pos, radiusM, walkNode?/rowNode?}` | the mode-handoff points V4 consumes |
| `stats` | per-layer counts, water simplification deltas, collision/nav stats, normalize diagnostics, notes | honesty section — everything a claim could cite |

## Runtime surface (`src/world.ts`)

`loadWorld`, `worldAttributionLines`, `decodeHeights`, `heightAt`,
`worldPointInWater`, `nearestNavNode` — plus the boundary surface
(`loadBoundary`, `pointInWater`, `signedDistanceToShore`,
`projectLatLon`) unchanged.

## Known limitations (stated, not hidden)

- Terrain above 60°N comes from coarser DEM sources (DATA_SOURCES.md §2);
  fine at region scale, smooth at ~10 m scale.
- Building relations with members outside the bbox are dropped and
  counted (`stats.normalize.droppedRelationSeam`).
- Landuse polygons clipped at the bbox may gain edge-running segments
  (standard Sutherland–Hodgman behaviour); harmless for zones.
- Waterway centrelines are not guaranteed rowable-connected to the sea;
  the row network is lattice-based over water polygons (rivers wide
  enough to hold lattice nodes join it naturally).
