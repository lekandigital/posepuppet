# REGION_CANDIDATES.md — the compact real-world region shortlist

Three candidates scored against the pack §14 criteria on 2026-07-11.
OSM-completeness numbers are **live Overpass counts** (way/feature counts
inside each candidate's working bbox, kumi.systems mirror, 2026-07-11) —
not guesses. Scores 0–5 per criterion, equal weight.

**The choice is reversible.** A region swap is a cheap re-bake
(`worldbake configs/<region>.json`) until V4's realistic art pass begins
hand-tuning to the location — that milestone is the decision deadline,
recorded in FINAL_USER_TEST_PLAN.md front matter. Name a personally
meaningful place any time before then and it becomes the region.

## Candidates

### 1. Ísafjörður, Iceland — WORKING DEFAULT ✓

Fjord town in the Westfjords: a walkable settlement on a sand spit
curling into Skutulsfjörður, a sheltered harbor pool (Pollurinn) behind
the spit, ~700 m fjord walls on three sides, and a real airport (IFJ)
on the shore 2.5 km south of town — all in one recognizable postcard.

- Working bbox: `66.050, -23.195, 66.084, -23.095` (~4.5 × 3.8 km;
  settlement + harbor core ≈ 2–3 km², the rest fjord water and
  mountainside).
- Live counts: **990 buildings, 497 highway ways, 176 paths,
  16 coastline ways, 31 waterways, 7 water polygons, 71 landuse,
  11 aeroway features**.

| criterion | score | note |
|---|---|---|
| (a) bay/harbor/river | 5 | fjord + enclosed harbor pool; mountain streams as waterways |
| (b) walkable settlement | 4 | real street grid on the spit, ~2 600 people |
| (c) terrain variance | 5 | sea level → ~700 m walls; reads beautifully in all three profiles |
| (d) airstrip/flat field | 5 | real airport (BIIS/IFJ) inside the bbox |
| (e) OSM completeness | 4 | dense buildings/roads/paths for its size |
| (f) 2–4 km² core | 4 | core fits; bbox includes fjord water + slopes |
| **total** | **27** | |

### 2. Friday Harbor, San Juan Island, WA — runner-up, second-bake region

Harbor town with a ferry landing, a true street grid, and a paved
airport (FHR) 800 m from the marina — the most compact and most
completely mapped candidate, but gently rolling terrain (~80 m relief)
is its weakness for profile drama.

- Working bbox: `48.518, -123.040, 48.545, -122.995` (~3.3 × 3.0 km).
- Live counts: **1 749 buildings, 887 highway ways, 319 paths,
  9 coastline ways, 8 waterways, 28 water polygons, 149 aeroway
  features**.

| criterion | score | note |
|---|---|---|
| (a) bay/harbor/river | 4 | excellent harbor + strait; no river |
| (b) walkable settlement | 5 | real grid, dense amenity coverage |
| (c) terrain variance | 2 | rolling ~80 m; little drama |
| (d) airstrip/flat field | 5 | paved in-town airport, fully mapped |
| (e) OSM completeness | 5 | best of the three by every count |
| (f) 2–4 km² core | 5 | everything inside ~3 km² |
| **total** | **26** | |

Used as the **second location baked purely from the README** (O4 doc
proof) — it exercises the pipeline on the opposite profile: dense
settlement, sparse terrain.

### 3. Plockton, Scotland — eliminated

Sheltered bay village on Loch Carron with a grass airstrip beside the
village. Charming, correct shape — but sparse: **209 buildings, 124
highway ways, 58 paths, 5 aeroway features** in its bbox
(`57.325, -5.680, 57.348, -5.630`), and moderate terrain.

| criterion | score | note |
|---|---|---|
| (a) bay/harbor/river | 4 | sheltered bay, islets |
| (b) walkable settlement | 3 | essentially one shore street |
| (c) terrain variance | 3 | hills, no walls |
| (d) airstrip/flat field | 4 | grass strip, thinly mapped |
| (e) OSM completeness | 3 | thin buildings/paths |
| (f) 2–4 km² core | 5 | very compact |
| **total** | **22** | |

## Decision

**Ísafjörður (27) > Friday Harbor (26) > Plockton (22).**

Terrain variance is the deciding criterion between the top two: the
fjord walls are what make one geography read distinctly in low-poly,
realistic, *and* fantasy profiles (pack §14: "hills/cliffs read
beautifully in all three profiles"), and Ísafjörður is the only
candidate where rowable water, walkable settlement, airstrip, and
dramatic terrain coexist in one camera frame. Friday Harbor's superior
completeness is real but buys detail, not drama; it stays in the repo
as the proven second bake, one config swap away.

Known tradeoff, stated honestly: at 66°N the terrarium elevation tiles
fall back to coarser-than-SRTM sources (DATA_SOURCES.md §2), so
Ísafjörður's terrain is smoother than reality at the ~10 m scale. The
700 m relief still dominates visually; Copernicus GLO-30 is the
documented upgrade path if V4's realistic pass wants sharper slopes.
