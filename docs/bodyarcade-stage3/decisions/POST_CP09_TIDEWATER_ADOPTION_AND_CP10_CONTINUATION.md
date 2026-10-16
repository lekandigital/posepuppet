# Post-CP09 decisions — Tidewater environment adoption (CP10) and the CP10 continuation directive

_Recorded 2026-10-16 from the user's two CP10 launch prompts. These are user decisions; they sit
at authority level 1–2 (current launch prompt / current checkpoint) above the Implementation
Master and every earlier checkpoint, and supersede the vegetation-only
`outputs/CHECKPOINT_10_VEGETATION_AND_LATER_ASSET_PASSES.md`._

## 1. CP10 is the Tidewater environment adoption, not the vegetation pass

- The active BodyArcade experience is **Tidewater** (Daniel Greenheck / DRG Software Solutions LLC,
  MIT, pinned `4811ba48d795197de5621985f404e765c0b7c0ef`) used as the HOST engine and world —
  its WebGPU / WGSL renderer, FFT ocean, shore simulation, waterline compositing, sky, terrain,
  reef, vegetation, wildlife, village, pier, whale, audio and post chain, unmodified and
  frozen as the visual baseline.
- The BodyArcade GAMICO dolphin (model, 8 clips, 120 Hz deterministic sim at 5 / 9 m/s, chase
  camera rig, keyboard + PosePuppet body input) is brought INTO Tidewater as adapters under
  `apps/tidewater-dolphin/src/`. No second renderer, no Three.js approximation.
- The decisions that made the CP05C WaterThreeJS ocean, the CP05A terrain, the re-scoped CP08
  Ecco atmosphere and the CP09 cave geometry the visual foundation are **superseded for the
  active experience**. Those systems stay intact and runnable in `apps/shared-world/`
  (recoverable), but are retired from the new game.
- Isolated workspace `apps/tidewater-dolphin/`, local branch `bodyarcade-tidewater-cp10`,
  local commits only: no push, merge, rebase, publish, deploy, no CP11.

## 2. CP10 continuation (second prompt) — amendments to the first

1. **Waterline.** The BodyArcade chase camera's inherited waterline exclusion (cp02 §6 anti-
   shimmer: ±0.75 m SURFACE_BAND, 0.35 m SHIMMER_MIN_Y, SHIMMER_HOLD_S side lock, the swim-side /
   air-side clamps on the desired eye and the TerrainCompressed probe clamp) is **revoked for
   the Tidewater integration**. The eye may sit on, straddle and cross the sea surface; Tidewater's
   near-plane waterline renderer (`post/Underwater.js`, LENS_REACH, per-pixel medium, meniscus)
   is untouched and decides what the lens sees. Airborne lift remains an ordinary framing
   effect (BREACH_PULLBACK), not a rendering constraint. Collision against solid geometry stays.
2. **Play modes.** Tidewater's walking and boating are **restored as selectable, non-default
   player modes** through the in-game menu (Play tab). The dolphin is the default on every fresh
   launch (no stored startup preference). One controller owns input and camera at a time; all
   modes share the one running world. This supersedes the first prompt's "retire the human
   walker and boat piloting as player modes".
3. **Fishing.** Tidewater's fishing is **restored as an optional activity** behind a menu toggle
   (default off), reusing Tidewater's own `Game`; available in Walking / Boat (where Tidewater
   supports it), never in Dolphin mode; fishing scenery (stalls, vendors) stays in every mode.
   This supersedes the first prompt's "retire the fishing game".
4. **Assets.** The implementer has **creative discretion** to select and integrate assets from the
   user's already downloaded, licensed collection without per-asset approval (supersedes the
   first prompt's per-category approval gate). Licensing, provenance, performance and
   original-environment preservation requirements remain; additions are additive, reversible,
   deterministic and individually toggleable, with an Original / Enhanced comparison control.
5. Everything else from the first prompt stands: Tidewater's visuals unchanged; no change to the
   dolphin model, animations, sim or (other than the waterline) the camera; keyboard works without
   a webcam; stop for user review when playable.

## 3. Implementation record

See `apps/tidewater-dolphin/eval/CP10_REPORT.md` (sources, architecture, visual proof, tests,
asset inventory, performance, unresolved issues) and `apps/tidewater-dolphin/README.md`.
