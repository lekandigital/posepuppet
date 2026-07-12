# DATA_SOURCES.md — world-data pipeline sources, verified

Every source the offline `worldbake` pipeline (and the absorbed boundary
pipeline) touches, with license, attribution requirement, endpoint, and
the date the endpoint was last verified working. **Nothing here is
fetched at runtime** — prep scripts fetch into a committed, checksummed
cache; games ship baked artifacts.

Endpoints were re-verified by live web search and live requests on
2026-07-11 (autonomy policy: do not trust memory for endpoints).

## 1. OpenStreetMap via Overpass API — vector features

Buildings, roads, paths, coastline, water polygons, waterways, land use,
aeroways, piers, boundaries.

- **License:** ODbL-1.0. **Attribution required:**
  "© OpenStreetMap contributors" — baked into every artifact's
  `source` block; `loadBoundary()`/`loadWorld()` refuse artifacts
  without it, and consuming games must display it on-screen
  (BODYARCADE_CONTEXT standing rule).
- **Primary endpoint:** `https://overpass.kumi.systems/api/interpreter`
  (run by Private.coffee; no rate limit). Verified working 2026-07-11.
- **Fallback:** `https://overpass-api.de/api/interpreter` — the main
  instance currently rejects requests with default/undescriptive
  User-Agents with **HTTP 406** (verified live 2026-07-11) and has had
  publicized timeout instability through spring 2026. The fetcher always
  sends a descriptive User-Agent
  (`bodyarcade-worldbake/1 (offline bake tool)`) and retries across
  mirrors with backoff; transient dispatcher errors on the mirror were
  also observed, so single-shot fetches are treated as unreliable by
  design.
- **Caching:** raw responses are gzipped, committed under
  `tools/worldbake/cache/<region>/`, and recorded by SHA-256 in the
  region's cache manifest and in the baked `world.json` provenance.
  Re-bakes are offline and byte-stable.

## 2. AWS Terrain Tiles (Mapzen terrarium) — elevation

- **Endpoint:**
  `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`
  — public S3 bucket, no key required, listed on the AWS Registry of
  Open Data (`registry.opendata.aws/terrain-tiles`). Verified 2026-07-11.
- **Encoding:** terrarium PNG, elevation m = `(R·256 + G + B/256) − 32768`.
- **License:** the composite dataset mixes public-domain and
  attribution-required upstream DEMs. Per the registry, required credit
  covers the constituent sources; we bake this attribution line into
  every world artifact: "Elevation data from Mapzen/AWS Terrain Tiles
  (SRTM ©NASA; GMTED2010 ©USGS; ETOPO1 ©NOAA; and other open sources)".
- **Resolution note:** SRTM stops at 60°N; at high latitudes
  (e.g. the Ísafjörður pilot at 66°N) tiles fall back to coarser
  GMTED2010-class sources. The bake records `terrain.sourceZoom` and
  elevation min/max in stats; probe checks assert plausibility, not
  meter-accuracy. Good enough for profile rendering + slope-derived
  collision; see upgrade path below.
- **Caching:** tile PNGs committed under
  `tools/worldbake/cache/<region>/tiles/` (gitignore exception —
  the repo globally ignores `*.png`), SHA-256 in the manifest.

## 3. Copernicus DEM GLO-30 — documented alternative (not wired)

- **Endpoint:** public S3 bucket `s3://copernicus-dem-30m/`
  (eu-central-1, no-sign-request; readme at
  `https://copernicus-dem-30m.s3.amazonaws.com/readme.html`).
  Verified present 2026-07-11.
- **License:** free for general public use under the Copernicus DEM
  licence; **specific mandatory notice**: "© DLR e.V. 2010-2014 and ©
  Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by
  the European Union and ESA; all rights reserved." GLO-30 has small
  country gaps (not affecting our candidates).
- **Status:** the better 30 m source above 60°N, but tiles are Cloud
  Optimized GeoTIFF — a GeoTIFF reader is a real dependency or a big
  hand-rolled decoder. Deferred: terrarium PNG (90 lines, zero deps,
  deterministic) carries the pilot; swap is isolated behind
  `lib/terrain.mjs` if a region ever needs it. One line in DECISIONS.md.

## 4. Overture Maps — evaluated, not used

- **Status (verified 2026-07-11):** healthy; monthly GeoParquet releases
  (latest 2026-06-17.0, schema v1.17.0) on AWS/Azure, 2.6 B buildings.
- **Why not:** consumption requires Parquet tooling (DuckDB or similar
  native dependency) and its building/transport layers are largely
  OSM-derived at our 2–4 km² scale anyway. A dependency-free Overpass
  extract is sufficient, deterministic, and matches the absorbed
  boundary pipeline. Revisit only if a region's OSM coverage is proven
  inadequate (the candidate scoring in REGION_CANDIDATES.md measures
  exactly this).

## 5. Natural Earth — documented coarse fallback (unchanged from v1)

Public domain; useful only for shapes far larger than a game region
(at bay scale it reduces coastlines to blobs — measured in the Dolphin
pass). Kept as documentation, not code.

## Attribution wiring (how consumers stay compliant)

Every baked artifact embeds `source.providers[]` with `license` and
`attribution` per source, and `loadWorld()` throws if the ODbL line is
missing (`loadBoundary()` already did this — absorbed unchanged). The
world artifact also exposes `source.attributionLines` — the exact
strings a consumer (V4 Open World) must render on-screen. A pipeline
test asserts both presence and the refusal path.
