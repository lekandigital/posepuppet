# Open World ASSET_CONTRACT — user-supplied plane models

The Open World flies a **procedural placeholder plane** until real
models arrive; nothing blocks on this contract. Drop a conforming file
in `apps/openworld/assets/planes/` (gitignored until licensing is
recorded) and it becomes selectable after a validation pass.

## File

- **Format**: glTF 2.0 binary (`.glb`), self-contained (embedded
  buffers/textures). One aircraft per file.
- **Naming**: `plane_<slug>.glb` (lowercase, hyphen-free slug).

## Coordinate + rig conventions (hard requirements)

- **Units**: metres. Real-ish scale — a small GA plane ≈ 7–11 m span.
  The engine does not rescale silently; a model outside 4–20 m span
  fails validation with the measured number.
- **Axes**: +Y up, **−Z forward** (glTF convention; nose looks down −Z),
  +X out the RIGHT wing.
- **Pivot/origin**: at the center of gravity (roughly wing spar, mid
  fuselage) — the sim rotates about the node origin. Ground contact is
  handled by the sim via a `groundClearanceM` measured at import.
- **Node names** (case-sensitive; present = animated, absent = fine):
  - `prop` or `prop_L`/`prop_R` — spun about their local Z at RPM.
  - `aileron_L`, `aileron_R`, `elevator`, `rudder` — control surfaces,
    deflected about their local X (aileron/elevator) / Y (rudder) up to
    ±20°. Author hinges accordingly.
  - `gear` (optional) — hidden above 40 m AGL if present.

## Materials / animation

- Standard PBR (`KHR_materials_*` extensions allowed but not required).
  The low-poly profile may substitute flat materials; supplying a
  `flat`-suffixed variant is welcome but optional.
- No skeletal animation required; embedded animations are ignored.
  Articulation happens on the named nodes above.

## Budgets (validation-enforced)

- ≤ 25k triangles, ≤ 2 materials preferred (hard fail at 60k / 8).
- Textures ≤ 2048², total texture payload ≤ 8 MB, file ≤ 15 MB.
- Perf target: the plane must not cost more than ~0.5 ms/frame on the
  project's measured mid-tier baseline (checked at import on :2).

## Licensing (shipping requirement)

Every file needs an entry in the repo-root `ASSETS.md` **before it is
committed**: source, author, license (CC0/CC-BY preferred; anything
non-redistributable is rejected), and the attribution string if the
license requires one — it is rendered in the credits panel. Stop-level
review applies per the project's licensing rule.

## What the placeholder guarantees meanwhile

`src/vehicles/placeholderPlane.ts` is procedural (original, no license
burden), honors this same node contract (`prop`, control surfaces), and
exercises every animation path, so a conforming user model is a drop-in.
