# CHECKPOINT 07 — Placeholder Layout

## Header

**Checkpoint:** 07 — Placeholder Layout
**Prerequisite:** Checkpoint 06 approved. Breach and region-scale swimming verified.
**Base state:** Full region with water, terrain, islands, breach, camera.

---

## Scope

**Build:**
1. **Create the placement data** (`assets/world/placement.json`) based on the approved region layout from checkpoint 03. Each entry: `{ type, x, z, yaw, scale, category }`.

2. **Place color-coded rectangular placeholder blocks** for every asset category at their intended positions:

   | Category | Color (hex) | Typical size (m) | Placement density guidance |
   |---|---|---|---|
   | Coral (plate/soft/anemone) | #FF8C00 (orange) | 1–3 | Dense on reef shelves, sparse on plains |
   | Kelp / seagrass | #228B22 (green) | 1–5 tall | Kelp forests in mid-depth; seagrass on sandy shallows |
   | Rock / reef formation | #808080 (gray) | 2–8 | Scattered; denser near landmarks |
   | Fish school volume | #00CED1 (cyan) | 3–10 (volume marker) | 2–4 ambient per reef zone; 1 school per 60–120 s |
   | Ruins / architecture | #D2B48C (tan) | 5–20 | Moderately common, integrated into landscape |
   | Tree / shrub | #006400 (dark green) | 2–8 above water | On islands (above waterline only) |
   | Large marine wildlife | #800080 (purple) | 2–4 | Rare; 0–1 per zone |
   | Wreck / dock | #8B4513 (brown) | 10–30 | Rare; 1–2 in region |
   | Sponge | #FFD700 (yellow) | 0.5–2 | Scattered on reef and cave mouths |

3. **Landmark markers** at positions identified in the approved layout:
   - Arches (at least 1)
   - Spires/pinnacles (at least 2)
   - Cave mouths (at least 1)
   - Ruin sites (at least 2)

4. **Development mode labels** (optional, toggle-able): each placeholder shows its category name as a text label in dev mode.

5. **Density follows Track D §14 guidelines:**
   - Corridors: 2–4 landmarks/features per view.
   - Open plains: 0–2 features per view.
   - A distinctive formation or discovery roughly every 30–60 s of normal exploration.
   - No uniform fill — density is authored contrast.

6. **Above-water placeholders:**
   - Tree/shrub blocks on island surfaces (above sea level).
   - No underwater placeholders on land; no land placeholders underwater.

**Out of scope:**
- Replacing any placeholder with a real asset (checkpoints 10–12).
- Atmosphere/fog zones (checkpoint 08).
- Caves (checkpoint 09).
- Audio (checkpoint 13).

---

## Inputs

| Input | Section | Purpose |
|---|---|---|
| Implementation Master | §8.3 (Placeholder Inventory) | Category list, colors |
| Approved region layout (from checkpoint 03) | — | Positions for all placeholders |
| `TRACK_D_PS2_VISUAL_SPEC_REPORT.md` | §14 | Composition grammar, density cadence |
| `TRACK_C_ASSETS_AUDIO_DOLPHIN_REPORT.md` | §4 | Asset categories and expected counts |
| `TRACK_D_PS2_VISUAL_SPEC_REPORT.md` | §12 (Wildlife) | Wildlife budgets per zone |

---

## Specification

### Placeholder geometry

Each placeholder is a `BoxGeometry` with `MeshBasicMaterial` at the category color. Placed using the baked `placement.json`. Position on the terrain via `terrainHeight(x, z)` — each block sits on the seabed or land surface at its placement point.

### Placement JSON schema

```json
{
  "placements": [
    {
      "type": "coral",
      "x": 150.5,
      "z": -200.3,
      "yaw": 0.7,
      "scale": 2.0,
      "subtype": "plate"
    }
  ]
}
```

### Wildlife density budgets (Track D §17.8, Table 12.1)

| Zone | Ambient creatures | Schools |
|---|---|---|
| Reef | 2–4 | 1 school (12–24 fish) per 60–120 s |
| Plain | 0–1 | 1 patrolling shark per pocket |
| Caves | 0–3 | Jelly rows of 2–4 |
| Above water | None | None |

---

## Demo

```bash
npm --prefix apps/shared-world run dev
```

**What the user should see:**
- Color-coded rectangular blocks scattered across the region at intended asset positions.
- Orange blocks on reef shelves (coral), green blocks in mid-depth (kelp), gray blocks everywhere (rocks).
- Tan blocks at ruin sites. Dark green blocks on islands (trees).
- Cyan volume markers showing where fish schools will swim.
- The composition should look dense and authored — not uniform fill.

**What the user should try:**
- Swim a full loop — see the density variation (dense reef vs. sparse plains).
- Surface near each island — see the above-water tree placeholders.
- Find landmarks (the largest tan/gray blocks at arch/spire/ruin positions).
- Assess: does the layout feel right? Too dense? Too sparse? Landmarks visible?

---

## Verification

### Automated
- All placement categories from the inventory have at least one block present.
- No underwater placeholders above sea level; no land placeholders below.
- Each block sits on the terrain surface (within 1 m tolerance).
- fps ≥ 60 at 1728×1080.

### Manual review
- Density feels right — corridors denser, plains sparser.
- Landmarks are visible and serve as navigation aids.
- At least 1 arch position, 1 cave mouth position, 2+ ruin positions marked.
- The region feels like it will be "dense and consistently rich" when placeholders become assets.

---

## Stop

**STOP.** Report:
1. Complete placeholder inventory (category → count placed → color).
2. Placement JSON statistics (total entries by type).
3. Density assessment per zone.
4. Landmark positions.
5. Screenshots of representative views (reef, plain, island, ruin site).
6. Performance: fps with all placeholders rendered.
7. Deviations from this specification.

**Wait for user review and approval. Approval of checkpoint 07 does not authorize starting checkpoint 08.**

---

## Guardrails

- No invented assets. Every placeholder is a plain colored rectangular block.
- Placeholders mark where assets belong — they are never permission to generate fake assets.
- Approved visuals (water, terrain, breach) immutable.
- Local-only.
- The user supplies real assets over time; agents purchase nothing.
