# worldbake — one compact real-world region → one profile-agnostic world

Offline pipeline: OpenStreetMap vectors + terrarium elevation in
(fetched once into a committed, checksummed cache), a byte-stable
`world.json` out (schema `bodyarcade-world/1`, documented in
[`packages/world-data/WORLD_SCHEMA.md`](../../packages/world-data/WORLD_SCHEMA.md)).
Games never fetch at runtime; profiles (low-poly / realistic /
fantasy-game) style the SAME artifact and never touch this tool.

The water-polygon stage is the absorbed Dolphin boundary pipeline
(`packages/world-data/tools/build-boundary.mjs`) called as a library —
the standalone Dolphin artifact and checks are unaffected and remain
green (asserted by this tool's own check suite).

Requirements: Node ≥ 20. No npm dependencies.

## Rebake an existing region (offline, deterministic)

```
cd tools/worldbake
node worldbake.mjs configs/isafjordur.json          # cache is warm → no network
node test/checks.mjs                                 # everything green
```

The bake reads only `cache/<region>/` and writes
`packages/world-data/data/worlds/<region>/world.json`. Same cache →
byte-identical artifact (the check suite re-bakes and compares).

## Add a new region (the whole recipe)

1. **Pick a compact bbox** (city-sized max, ~2–4 km² core; the four-mode
   criteria live in `REGION_CANDIDATES.md` at the repo root). Then:

   ```
   node worldbake.mjs --bbox "S,W,N,E" --name <slug> --seed "lat,lon"
   ```

   `--seed` is a point of open SEA water inside the bbox — the
   coastline-clip water assembler grows the sea polygon from it. Omit it
   only for inland regions (lakes still bake; there is no sea polygon).
   For a place-name lookup instead of a bbox, use
   `--place "Town Name" --name <slug>` (Nominatim, config-creation time
   only; review the generated bbox before trusting it).

   This writes `configs/<slug>.json` with documented defaults, fetches
   the cache (Overpass + terrain tiles; retries mirrors automatically),
   and bakes a first artifact.

2. **Eyeball the geography**:

   ```
   node worldbake.mjs configs/<slug>.json --render
   ```

   → `packages/world-data/data/render/<slug>-minimap.svg` (untracked).
   Water where water should be? Settlement grid present? Runway found?

3. **Fill in the config's `checks` block** — this is what makes the
   region regression-tested rather than merely baked:
   - `probes`: a few known-water / known-land lat/lon points
   - `settlementProbes`: street points the walkable network must cover
     (within `settlementCoverM`)
   - `bayProbe`: open water every dock/dive must reach by row network
   - `terrainProbes`: lat/lon with `minElevM`/`maxElevM` bounds

   Deriving exact coordinates from the baked artifact is legitimate and
   encouraged (spawn positions, street vertices, elevation extremes make
   good probes — they encode "the town is on land and walkable" as a
   regression). Inverse-project with:
   `lat = y/(R·π/180)+lat0`, `lon = x/(R·π/180·cos(lat0·π/180))+lon0`.

4. **Re-bake and record the golden checksum**:

   ```
   node worldbake.mjs configs/<slug>.json
   node test/checks.mjs configs/<slug>.json --update-golden
   node test/checks.mjs        # full suite, all regions + dolphin absorption
   ```

5. **Commit** the config, the `cache/<slug>/` inputs (yes, committed —
   that is what makes re-bakes offline and reproducible; a region cache
   is a few MB), the artifact under
   `packages/world-data/data/worlds/<slug>/`, `golden/checksums.json`,
   and `eval/worldbake-results.json`.

Tuning knobs (all in the config, all documented by example in
`configs/isafjordur.json`): `terrain.zoom`/`cellSizeM` (grid resolution
vs artifact size), `terrain.clampMinM` (floor coarse offshore
bathymetry; the artifact states the transform), `water.cuts` (named
half-plane gates for play-space edges, same semantics as the Dolphin SF
Bay config), `water.simplify` / `simplify.*` (vertex budgets),
`nav.rowSpacingM`/`rowMinShoreClearM` (row lattice),
`minimap.minTriangleAreaM2`.

## CLI

```
worldbake <configs/region.json>     bake (fetches iff cache is cold)
  --fetch / --force-fetch           explicit fetch / refresh cache
  --render                          also write the debug minimap SVG
  --out <path>                      write the artifact elsewhere
  --profile-agnostic                accepted; the only mode there is
worldbake --bbox "S,W,N,E" --name slug [--seed "lat,lon"]
worldbake --place "Name" --name slug
node test/checks.mjs [configs…] [--update-golden]
```

There is no `--profile` and never will be: styling belongs to consumers.

## Licensing (shipping requirement)

Every artifact embeds `source.attributionLines`; consumers must render
them on-screen (`loadWorld()` refuses artifacts without the OSM line;
sources + licenses in `DATA_SOURCES.md`). OSM data is ODbL; terrain is
the Mapzen/AWS composite (attribution baked in).

## Stated limitations

- Terrain above 60°N falls back to coarser DEM sources (smooth at ~10 m
  scale; the relief still reads). Copernicus GLO-30 is the documented
  upgrade path (DATA_SOURCES.md §3).
- Multipolygon buildings whose members leave the bbox are dropped and
  counted (`stats.normalize.droppedRelationSeam`).
- The row network is a lattice over water polygons; narrow rivers join
  it only where wide enough to hold nodes.
- A bbox with zero coastline and no `water.seed` produces a world with
  lake-only (possibly empty) water — fine for a walking-only region;
  dock/dive spawns are then omitted and noted in `stats.notes`.
