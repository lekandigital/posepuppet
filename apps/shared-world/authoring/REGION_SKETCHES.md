# REGION SKETCHES — Checkpoint 03 (Region-Layout Decision Gate)

Three candidate top-down layouts of the fictional 2 km × 2 km region, for the
user to **pick one or redline one**. No world is built at this checkpoint; the
approved (possibly redlined) sketch becomes the authoritative layout that
Checkpoint 04A bakes.

- Renderer: `apps/shared-world/authoring/region-sketches.mjs` (Node, zero
  dependencies, fully seeded/deterministic).
- Images: `region-sketches/sketch-{A,B,C}.png`, 2048 × 2048 px, 1 px ≈ 1 m
  (2000 m / 2048 px), north up.
- Regenerate: `node apps/shared-world/authoring/region-sketches.mjs`
- Determinism check: `node apps/shared-world/authoring/region-sketches.mjs --verify`

**Coordinate convention** (Implementation Master §2.1): meters, origin at
region center, X,Z ∈ [−1000, +1000], sea level y = 0, depth floor −80 m,
tallest peak +200 m. Map convention: **north = −Z** (top of image),
**east = +X** (right of image). All coordinates below are `(x, z)` region
meters.

The render style is an authoring diagram (debug-artifact class): flat
hypsometric depth tint with a legend, landmark glyphs, labeled text. The
sketch palette is diagrammatic only — it is **not** the Track D game palette,
and nothing here is game content.

---

## Sketch A — RING ATOLL (seed 60418001)

A central lagoon enclosed by a near-complete reef ring (the vivid-canyon
family F), with the +200 m volcano island sitting on the ring's NE arc. The
trench pocket lies outside the ring to the S; the hazy sand plain (G) fills
the W gap between ring and hazard water. Two swimmable ring passes: the N
pass carries the current, the SE pass carries the arch.

### §6 element checklist (A)

| # | Element | Where (region meters) |
|---|---|---|
| 1 | Compositional seed | Lagoon (−50, 50) → ring reef shelf (radius ≈ 480 m band) → trench pocket (350, 700, floor −80 m); arch (240, 430); short cave (300, −250); current N pass (−50, −470, flowing S into lagoon); optional discovery (470, 745) |
| 2 | Islands | Large: volcano island (430, −430), summit +200 m. Smaller: SW island (−430, 380) +55 m; W island (−480, −180) +40 m. Islets/rocks (6): ring islets (90, 520), (−200, 480), (−320, −350); N reef-wall rocks (−400, −905), (−20, −895), (380, −910). Coastline variety: sandy beach (volcano S shore), cliff (volcano NE coast), rocky shore (SW island), cove (volcano W notch ≈ (240, −390)) |
| 3 | Enclosure | N: reef wall crest; E: rocky shoal wall; W + S: deep hazard water; NE corner: volcano cliff coast. No artificial boundary |
| 4 | Zone families | Bright shallow band: lagoon rim + volcano beach fringe. Main reef: **F vivid canyon** (the ring). Sparse pocket: **G hazy sand** (−700, 100). Dark cave family: **D olive cave** (short cave, volcano foot). E2 shaft: not included (user option). Trench/deep uses the dark end of the master depth ramp |
| 5 | Landmarks | Corridor: SE ring canyon (label at (−320, 360)), 3 masses. Plain: G pocket, 1 silhouette (−650, −30). Spires 6–16 m: (−240, 500), (60, 560), (420, 260). Arch opening 6 m. Cadence: see loop table below |
| 6 | Ruin sites (3) | Submerged colonnade in lagoon (120, 210); shoreline ruin on volcano S beach (270, −205); submerged wreck on trench rim (240, 610) |
| 7 | Spawn + breach + loop | Spawn (−50, 50) lagoon center. B1 (−140, −80): sees volcano summit + ring islets. B2 (400, 500): sees volcano skyline over the ring + open S water. B3 (−565, 30): sees W + SW islands + the reef-wall line. Loop drawn, 2838 m |
| 8 | Depths | Lagoon 3–10 m; ring reef 10–36 m; G plain ≈ 40–45 m; trench to −80 m; all transitions smoothstep-blended (no biome borders) |
| 9 | Caves | Short cave (family D) at volcano foot (300, −250) + the SE-pass arch. Second cave: none (user option) |

### Swim loop (A) — 2838 m ≈ 9.5 min at 5 m/s cruise (≈ 13.5 min exploring)

Spawn → lagoon N (bright shallow) → N pass current (−50, −430) → volcano W
cove → short cave (300, −250) → shoreline ruin/beach → F reef E arc (spire) →
arch at SE pass (240, 430) → trench rim + wreck → trench heart (300, 680,
discovery visible E) → S ring canyon corridor + 3 spires → lagoon SW re-entry
→ spawn. Marked formations fall every ≈ 150–300 m of route (30–60 s at
cruise): current, cave, ruin, spire, arch, wreck, trench wall, spires,
colonnade — no gap along the loop exceeds ≈ 300 m.

---

## Sketch B — BARRIER ARC (seed 60418002)

A high ridge island walls the entire N edge (+200 m summit); its S shore
carries the lagoon. A W–E barrier reef (shallow-reef family B) crosses the
middle with two passes (arch W, current E). South of the barrier: the trench,
the desaturated plain (E) SW, and the deep cavern (J). The E2 shaft is marked
as an optional element on the barrier's E arc.

### §6 element checklist (B)

| # | Element | Where (region meters) |
|---|---|---|
| 1 | Compositional seed | Lagoon band along ridge-island S shore (center ≈ (−50, −370)) → barrier reef shelf (W–E arc through (−250, 60)–(250, 80)) → trench (50, 560, floor −80 m); arch (−350, 95); deep cavern (120, 470); current E pass (350, 170, S→N); optional discovery (−300, 560) |
| 2 | Islands | Large: ridge island (spine (−550, −680)→(450, −640)), summit +200 m at (−100, −660). Smaller: E barrier island (620, 165) +55 m; W island (−700, −280) +45 m. Islets/rocks (5): barrier islets (−600, 130), (−100, 55), (150, 70); E-wall rocks (905, −300), (895, 60). Coastline variety: sandy beach (ridge S shore), cliff (ridge N coast), rocky shore (W island), cove (lagoon notch ≈ (330, −390)) |
| 3 | Enclosure | N: ridge-island cliff coast; E: reef wall; W + S: deep hazard water. No artificial boundary |
| 4 | Zone families | Bright shallow band: lagoon + beach fringe. Main reef: **B shallow reef** (the barrier). Sparse pocket: **E desaturated plain** (−550, 420). Dark cave family: **J deep cavern** (trench N wall). **E2 shaft: optional**, marked at (430, 200) |
| 5 | Landmarks | Corridor: the channel between lagoon and barrier (label (120, −180)), 3 masses at (−50, −80), (220, −60), (420, −40). Plain: 1 silhouette (−560, 460). Spires 6–16 m (5): channel ×3 + barrier (−480, 110), (500, 150). Arch opening 7 m. Cadence: see loop |
| 6 | Ruin sites (3) | Shoreline dock ruin (100, −450); submerged temple on the barrier (−30, 90); submerged wreck at plain edge (−420, 350) |
| 7 | Spawn + breach + loop | Spawn (−60, −370) lagoon. B1 (−500, −380): sees summit ridge + cliff wall. B2 (0, 270): sees the barrier islet line with the ridge island behind. B3 (480, 300): sees E island + trench water. Loop drawn, 2948 m |
| 8 | Depths | Lagoon 3–10 m; barrier 10–36 m; E plain ≈ 45 m; trench to −80 m; gradual transitions |
| 9 | Caves | Deep cavern (family J) in trench N wall (120, 470) + the W-pass arch. Second cave: none (user option); E2 shaft optional |
|  |  |  |

### Swim loop (B) — 2948 m ≈ 9.8 min at 5 m/s cruise (≈ 14.0 min exploring)

Spawn → E along lagoon past dock ruin and cove → around the barrier E end →
current at E pass (350, 170) → E2 shaft site → trench rim → deep cavern
(120, 470) → W along trench → discovery (−300, 560) → wreck at plain edge →
arch at W pass (−350, 95) → NW through the channel corridor (3 masses,
spires) → lagoon → spawn.

---

## Sketch C — TWIN BAY (seed 60418003)

A crescent island walls the W (+200 m summit); a low headland plus an islet
chain splits its lee into two bays — the north-bay lagoon and the south-bay
kelp reef (family C). The arch sits in the islet gap; a **short family-D cave
passes under the headland**, linking the bays as a loop shortcut. The trench
runs N–S in the E between the NE island and the plain; the current funnels
from the corridor toward the trench.

### §6 element checklist (C)

| # | Element | Where (region meters) |
|---|---|---|
| 1 | Compositional seed | North-bay lagoon (−180, −380) → south-bay kelp reef shelf (−180, 300) → trench (spine (560, −250)→(520, 180), floor −80 m); arch (−40, −70); short cave under headland (−420, 30); current funnel (260, −200, toward trench); optional discovery (390, 290) |
| 2 | Islands | Large: crescent island (spine (−650, −520)→(−780, −80)→(−620, 420)), summit +200 m at (−760, −100). Smaller: NE island (480, −560) +70 m; S island (−380, 640) +45 m. Islets/rocks (5): chain (−80, −70), (90, −80), (230, −90); E-wall rocks (900, −480), (905, 620). Coastline variety: sandy beach (crescent inner shore), cliff (crescent W back), rocky shore (NE island), cove (S of headland ≈ (−420, 180)) |
| 3 | Enclosure | W: crescent cliff coast; E: reef wall; N + S: deep hazard water. No artificial boundary |
| 4 | Zone families | Bright shallow band: north-bay lagoon + beach fringe. Main reef: **C kelp reef** (south bay). Sparse pocket: **E desaturated plain** (140, 660). Dark cave family: **D olive cave** (headland cave). Optional second cave marked (450, −30, trench W wall). E2: not included (user option) |
| 5 | Landmarks | Corridor: islet chain (label (40, −185)), 3 masses. Plain: 1 silhouette (250, 570). Spires 6–16 m (2): (−300, 420), (100, 330). Arch opening 5 m. Cadence: see loop |
| 6 | Ruin sites (3) | Shoreline settlement on crescent inner shore (−470, −300); submerged column field in the south bay (−120, 260); submerged wreck on trench W rim (440, 160) |
| 7 | Spawn + breach + loop | Spawn (−180, −380) north bay. B1 (−280, −300): sees crescent summit + NE island. B2 (−100, 420): sees crescent ridge + S island. B3 (430, −300): sees both E islands + open horizon. Loop drawn, 2999 m |
| 8 | Depths | Lagoon 3–10 m; kelp reef 10–36 m; E plain ≈ 44 m; trench to −80 m; gradual transitions |
| 9 | Caves | Short cave (family D) under the headland (−420, 30), drawn with its dashed passage (−430, −150)→(−420, 30); + the islet arch. **Optional second cave** marked in the trench W wall (450, −30) |

### Swim loop (C) — 2999 m ≈ 10.0 min at 5 m/s cruise (≈ 14.3 min exploring)

Spawn → SE across the lagoon → arch in the islet gap (−40, −70) → corridor →
current funnel (260, −200) → B3 at the trench N rim → S along the trench
(cave-2 site passes on the W wall) → wreck (440, 160) → discovery (390, 290)
→ plain edge → south-bay kelp reef → column-field ruin (−120, 260) → **through
the headland cave** (−420, 30 → −430, −150) → north bay → spawn.

---

## Self-audit: §6 element × sketch

Element numbering from `CHECKPOINT_03_REGION_LAYOUT_GATE.md` §6. All cells
must be (and are) PRESENT.

| §6 element | A | B | C |
|---|---|---|---|
| 1. Seed: lagoon → reef shelf → trench (−80), arch, short cave, current, optional discovery | PRESENT | PRESENT | PRESENT |
| 2. Islands: ≥1 large (+200 summit), ≥2 smaller, ≥3 islets/rocks; beach/rocky/cliff/cove variety | PRESENT (1+2+6) | PRESENT (1+2+5) | PRESENT (1+2+5) |
| 3. Natural enclosure on all four sides | PRESENT | PRESENT | PRESENT |
| 4. Zone families: bright shallow; one of B/C/F main reef; exactly one of E/G; one dark cave (D/J); E2 optional; labeled | PRESENT (F, G, D) | PRESENT (B, E, J, E2 opt) | PRESENT (C, E, D) |
| 5. Landmarks: corridor 2–4 masses; plain 0–2 silhouettes; arch 4–8 m; spires 6–16 m w/ count+positions; 30–60 s cadence on loop | PRESENT (3/1/6 m/3 spires) | PRESENT (3/1/7 m/5 spires) | PRESENT (3/1/5 m/2 spires) |
| 6. Ruins ≥3 incl. ≥1 submerged and ≥1 shoreline | PRESENT (2 sub + 1 shore) | PRESENT (2 sub + 1 shore) | PRESENT (2 sub + 1 shore) |
| 7. Spawn; ≥3 annotated breach sightlines; loop drawn | PRESENT | PRESENT | PRESENT |
| 8. Depth annotations: lagoon 3–10, reef 10–36, trench −80, gradual transitions | PRESENT | PRESENT | PRESENT |
| 9. ≥1 short cave + the arch; optional second cave per sketch | PRESENT (2nd: none) | PRESENT (2nd: none; E2 opt) | PRESENT (2nd: optional marked) |

The three arrangements are structurally different (ring-lagoon vs barrier-arc
vs twin-bay), not palette swaps: the lagoon/reef/trench topology, island
placement, enclosure mix, and loop shape differ in each.

## Determinism verification

`node apps/shared-world/authoring/region-sketches.mjs --verify` renders every
sketch twice in memory, SHA-256-compares the two runs, and compares against
the files on disk. Result at commit time: **PASS — byte-identical**.

| File | SHA-256 (first 16) | Loop length |
|---|---|---|
| sketch-A.png | `c491a76c3233d962` | 2838 m (9.5 min at 5 m/s) |
| sketch-B.png | `a67605366a7f0ee3` | 2948 m (9.8 min at 5 m/s) |
| sketch-C.png | `302b372ed61b7be6` | 2999 m (10.0 min at 5 m/s) |

No `Math.random`, no `Date`, no environment reads; fixed integer seeds per
sketch; PNG bytes from `node:zlib deflateSync` at fixed settings.

## Dependency record

**None added.** The checkpoint allows one PNG-writing dev-dependency in the
authoring scope (e.g. `pngjs`); the script instead writes PNGs with a ~40-line
encoder over Node's built-in `node:zlib`, so no `package.json` outside the
authoring folder changed. One support file was added inside the authoring
scope: `authoring/.gitignore`, which re-includes `region-sketches/*.png` past
the repo-root global `*.png` ignore (the sketches are committed artifacts).

## Performance report

Not applicable — this checkpoint makes **no runtime change**. No app code,
view, asset, or test was touched; the deliverables are an authoring script,
three PNGs, and this document. (Stated per checkpoint §10.)

## Placeholder inventory

Not applicable yet. The marked sites on the approved sketch — ruins, wrecks,
spires/masses, cave mouths, the discovery site — **define the future
placeholder positions** that Checkpoint 07 will fill with the color-coded
placeholder categories of Implementation Master §8.3. (Stated per checkpoint
§11.)

## Deviation report

- **No §6 element is unsatisfied** in any sketch (see the self-audit table).
- Composition liberties, per sketch, beyond the literal grammar:
  - **All:** enclosure mixes reef wall / cliff coast / deep hazard water per
    side rather than one mechanism everywhere; the sketch depth-tint palette
    is diagrammatic, not the Track D game palette.
  - **A:** the optional discovery sits just off the loop on the trench's far
    rim (visible from the B2/trench leg) — a spot-and-detour beat rather than
    an on-path stop.
  - **B:** the barrier carries two passes; the arch and the current are still
    exactly one each (arch = W pass, current = E pass). The E2 shaft is
    marked although optional.
  - **C:** the short cave is used as connective tissue (a bay-to-bay loop
    shortcut under the headland) rather than a dead-end pocket.
  - Loop lengths sit deliberately at the top of the 5–10-minute band
    (9.5–10.0 min at governed cruise 5 m/s); labeled exploring-pace estimates
    are also printed on each map.

## Open questions for the user (decide with your pick/redlines)

1. **Which layout** — A (ring atoll), B (barrier arc), or C (twin bay)? Or
   redline one (annotations/notes in your reply are recorded verbatim below).
2. **Second cave:** C marks an optional second cave (trench W wall). Should
   the chosen layout include a second cave (A and B currently have one)?
3. **E2 shaft chamber:** only B marks it (optional, on the barrier E arc).
   Include an E2 vertical shaft in the chosen layout?
4. **Optional discovery identity** (site is marked; content is your call).
   Proposals within the master's ruins/architecture vocabulary: A — a second,
   deeper wreck below the trench rim; B — a collapsed stone bridge span at
   the trench W end; C — a ring of ambiguous monolith stones on the trench
   rim.
5. Minor: spawn defaults to the lagoon center of each layout — fine, or move
   it?

## APPROVED LAYOUT

Approved by the user 2026-07-18 at the Checkpoint 03 decision gate. The
user's decision, verbatim:

> I approve **Sketch C — Twin Bay** as the authoritative region layout.
>
> Record the following decision verbatim for the start of Checkpoint 04A:
>
> * Chosen layout: **C — Twin Bay**
> * Redlines: **none**
> * Include the optional second cave in the trench's west wall: **yes**
> * Include an E2 vertical shaft: **no**
> * Optional discovery: **a ring of ambiguous monolith stones on the trench rim**
> * Spawn location: **keep the default spawn in the north-bay lagoon center**
>
> The headland cave should remain the main bay-to-bay loop shortcut. The
> second cave should remain a smaller optional trench-wall discovery, not
> another major route.

Checkpoint 04A therefore bakes **Sketch C (seed 60418003)** exactly as
drawn, with: both caves (headland cave (−420, 30) as the primary bay-to-bay
loop shortcut; trench-W-wall cave (450, −30) as a smaller optional
discovery, not a major route), **no** E2 shaft, the discovery site (390, 290)
realized as a ring of ambiguous monolith stones on the trench rim, and the
spawn at the north-bay lagoon center (−180, −380).
