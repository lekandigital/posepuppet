# @bodyarcade/world-data

Real-water boundary pipeline. Given a named real water shape (a bay, a
lake, a river reach), the offline tools fetch its polygon from
OpenStreetMap, simplify it to a stated vertex budget, project it to local
game metres, and emit a self-describing `boundary.json` that games bundle
and import. The playable world inside is fictional; the outline is real —
the minimap is the proof.

This package was the seed of the open-data pipeline, and the absorption
has happened: `tools/worldbake` (repo root) calls this package's
`buildBoundary()` as its **water-polygon component** and emits full
world artifacts (`bodyarcade-world/1` — terrain, layers, collision, nav
graphs, minimap, spawns, transitions) under `data/worlds/<region>/`.
The package hosts both runtime surfaces: the boundary surface below
(unchanged — standalone Dolphin's contract) and the world surface
(`loadWorld`, `decodeHeights`, `heightAt`, `worldPointInWater`,
`nearestNavNode` — see `WORLD_SCHEMA.md`). One artifact format per
scale, N regions, each a config away.

## Non-negotiables

- **No runtime fetching.** Tools run at development time; the game ships
  the emitted JSON. The raw Overpass response is committed
  (`data/raw/`) so builds are reproducible without network.
- **Licensed and attributed.** Every artifact carries its source,
  license, and credit line inside the file; `loadBoundary()` refuses
  artifacts without attribution, and the consuming game must display it
  (OSM ⇒ ODbL ⇒ "Boundary data © OpenStreetMap contributors" in-app).
- **Deterministic.** Same raw input ⇒ byte-identical boundary.json
  (asserted by the check tool on every run, plus a committed-file drift
  check).

## Pipeline

```
configs/<shape>.json           the recipe: source mode, budgets, gates, probes
        │
        ▼
tools/fetch-boundary.mjs       Overpass → data/raw/<shape>*.json[.gz] (cached, committed)
        │
        ▼
tools/build-boundary.mjs       assemble water polygon (see modes below);
        │                      project (local tangent plane at bbox centre);
        │                      normalize winding; radial pre-pass +
        │                      Visvalingam–Whyatt simplify (halve-epsilon
        │                      retry if simplification ever introduces an
        │                      intersection); round to cm; provenance+stats
        ▼
data/boundaries/<shape>.json   the shipped artifact
        │
        ├── tools/render-boundary.mjs   debug minimap SVG+PNG (+ --raw comparison)
        └── tools/check-boundary.mjs    assertions → ../../eval/worlddata-results.json
```

### Source modes

- **`relation`** — a curated `natural=bay`/`natural=water` multipolygon
  relation. Right for enclosed shapes whose relation already contains
  everything (a lake, the Bay of Kotor). Measured insufficient for SF
  Bay: OSM delineates Golden Gate and Raccoon Strait as separate named
  features, so the curated relation ships no Golden Gate opening and
  fuses Angel Island to Tiburon (DECISIONS.md 2026-07-11).
- **`coastline-clip`** — assemble the water polygon from
  `natural=coastline` ways clipped to a **convex play region**: the
  config bbox intersected with named cut-line half-planes (the
  play-space "gates", e.g. Point Bonita – Lands End). Chains are
  stitched from true heads, clipped exactly to the region, and closed
  by walking the region boundary; the walk direction and the outer ring
  are picked by the config seed point, so no orientation folklore lives
  in the config. Closed coastlines fully inside become islands (holes);
  islets whose narrow surrounding water the smoothed shoreline
  legitimately seals are dropped and counted
  (`stats.holesSealedBySimplification`) — the check tool separately
  asserts every *required* island survived. This is the future
  pipeline's general path for open bays and coastlines.

Run from this directory (Node ≥ 20):

```
npm run fetch    # no-op when data/raw/ cache exists (--force to refetch)
npm run build    # emit data/boundaries/san-francisco-bay.json
npm run render   # data/render/*.png|.svg (untracked; add -- --raw for the fidelity pair)
npm run check    # all assertions; writes eval/worlddata-results.json
```

## Artifact format (`bodyarcade-boundary/1`)

Metres, y = north, origin at the shape's bbox centre. Rings carry no
closing duplicate; outers are CCW, holes CW; containment is even-odd.
`source` (provider, relation, license, attribution, OSM base timestamp),
`projection`, `bbox`, `polygons[{outer, holes[{name, wayIds, ring}]}]`,
and `stats` (raw/simplified vertex counts, both areas, **area delta %**,
simplification method + accepted epsilon) are all inside the file — an
artifact is its own provenance record.

Runtime surface (`src/index.ts`, imported as `@bodyarcade/world-data`):
`loadBoundary`, `pointInWater`, `signedDistanceToShore` (positive in
water — the containment current's input and the SDF depth substrate),
`projectLatLon`.

## Simplification, stated

Visvalingam–Whyatt (remove the vertex spanning the smallest triangle
until every remaining vertex spans ≥ the configured `minTriangleAreaM2`),
with a per-ring vertex floor, rings never dropped, and a halve-epsilon
retry ladder should simplification ever self-intersect a ring, cross
rings, or push a hole outside its outer — narrow straits are the risk
case, and the check tool independently asserts named channels stay open
(clearance floor + keep-ratio vs raw). The achieved area delta is stated
in `stats.areaDeltaPct` and asserted against the config tolerance.

## Shapes

| shape | source | license | status |
|---|---|---|---|
| `san-francisco-bay` | OSM `natural=coastline` ways, coastline-clip mode, bbox 37.42..37.97 / −122.56..−122.03 with two gates (Point Bonita–Lands End; San Quentin–Castro Point) | ODbL-1.0 — "Boundary data © OpenStreetMap contributors" | Gate-1 pick (BodyArcade Dolphin) |

The play space runs from the Golden Gate strait (the Pacific gate sits
just seaward of the bridge line) through the central bay — Angel Island,
Alcatraz, Treasure/Yerba Buena all real islands, Raccoon Strait and the
Oakland estuary open, Alameda an island — down to the Alviso sloughs.
San Pablo Bay lies beyond the San Quentin gate. Both gates are stated in
the artifact's `source.cuts` and are where the game's shimmer boundary
reads as "edge of the dream", not as a missing coastline.

Natural Earth (public domain) remains the documented fallback source for
much larger, coarser shapes only — at bay scale its 10 m dataset reduces
a bay to a blob, so OSM is the primary source for every current shape.

### Adding a shape

Write `configs/<name>.json` (relation id, license + attribution, hole
names by way id, simplify epsilon + budgets, water/land probes, named
channels), then `fetch → build → render → check`. If the shape's
license is not ODbL or public domain, stop for approval first
(ASSETS.md policy).
