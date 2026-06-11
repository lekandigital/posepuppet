# Model Audit Workflow

PosePuppet avatar audits are local dossiers for deciding whether downloaded character models are worth adapting before any runtime puppeteering work begins. They summarize source provenance, rig structure, humanoid mapping, hands, feet, face support, likely cleanup cost, and what another LLM should know without seeing the binary asset.

## Git Safety

Downloaded assets stay local. Do not commit source models, ZIPs, nested ZIPs, textures, extracted temp folders, or converted avatar binaries. The audit scripts write small Markdown, JSON, and text reports under `model-audits/`.

The source folders and common binary/texture extensions are ignored in `.gitignore`. Confirm with:

```sh
git check-ignore -v models_for_animation/rigged_hand.glb
git check-ignore -v ModelsForAnimation/rigged_hand.glb
```

## Run The Full Batch Audit

```sh
python3 tools/audit_models.py \
  "/Users/lekan/Dev/posepuppet/models_for_animation" \
  "/Users/lekan/Dev/posepuppet/model-audits"
```

If the source folder is renamed to the originally requested spelling, use:

```sh
python3 tools/audit_models.py \
  "/Users/lekan/Dev/posepuppet/ModelsForAnimation" \
  "/Users/lekan/Dev/posepuppet/model-audits"
```

Useful flags:

```sh
python3 tools/audit_models.py models_for_animation model-audits --timeout 300
python3 tools/audit_models.py models_for_animation model-audits --limit 3
python3 tools/audit_models.py models_for_animation model-audits --keep-temp
python3 tools/audit_models.py models_for_animation model-audits --screenshots
```

## Run One Model

```sh
/Applications/Blender.app/Contents/MacOS/Blender \
  -b \
  --python tools/audit_model.py \
  -- "/Users/lekan/Dev/posepuppet/models_for_animation/spider_man_playstation_rigged.glb" \
     "/Users/lekan/Dev/posepuppet/model-audits/spider-man-playstation"
```

## Source ZIP Handling

`tools/audit_models.py` inspects ZIP contents with Python's `zipfile` module and writes findings to `model-audits/source-archive-report.md`. It prefers source `.blend` files, then `.fbx`, then source `.glb`/`.gltf`/`.vrm`, then top-level runtime `.glb`, then `.obj` as a static fallback.

Selected ZIP entries are extracted to `/tmp/posepuppet-model-audit-*`, not into the repo. The temp folder is deleted after the run unless `--keep-temp` is passed.

## Nested ZIP Handling

Nested ZIPs are inspected recursively on a best-effort basis. If a nested ZIP contains a better model source, the orchestrator can extract only the selected file to the temp audit folder and run Blender against that extracted copy.

## Duplicate Handling

The batch audit hashes top-level model/archive files and groups repeated downloads by canonical character slug. Exact duplicates and likely repeated downloads are documented in `model-audits/dedupe-report.md`. The script never deletes duplicates.

## Labels And Scores

Labels are conservative:

- `well-developed`: strong humanoid mapping, skinning, and runtime readiness.
- `partial`: usable after offsets or cleanup.
- `experimental`: rig exists, but mapping or anatomy is incomplete.
- `not well-developed`: substantial rig/skinning/mapping work needed.
- `non-humanoid / creature-profile-needed`: usable only with a custom profile.
- `hand-only`: useful as a hand/finger test asset, not a full avatar.
- `static / not rigged`: preview only unless rigged later.
- `reject`: automated audit failed or source is not useful.

Scores are 0-100 and combine mapping, skinning, upper body, legs, feet, hands, fingers, face-touch feasibility, expression support, and cleanup cost.

## Face-Touch Feasibility

`good` means a humanoid model has head/neck/chest, usable arms/hands, plausible proportions, and likely wrist/palm orientation. `possible_with_ik` means the bones exist but direct retargeting is probably not enough. `limited` means the anatomy or mappings are shaky. `not_supported` means key head/arm/hand/rig pieces are missing.

## Creature Profiles

Godzilla, King Kong, Xenomorph, Olaf, Grogu/Baby Yoda, and other nonstandard anatomy should not be forced through standard humanoid retargeting. Their reports should describe useful custom controls such as head, torso, jaw, tail, creature limbs, static preview, or hand/finger tests.

## What Reports Omit

Reports intentionally omit large binaries, copied textures, converted avatars, extracted source folders, and license claims. License is always `unknown; verify before redistribution` until manually checked from the original source.

## Output Location

Per-model dossiers live at:

```txt
model-audits/<character-slug>/
```

Aggregate reports:

```txt
model-audits/INDEX.md
model-audits/summary.json
model-audits/recommendations.md
model-audits/dedupe-report.md
model-audits/source-archive-report.md
model-audits/audit-failures.md
```

## LLM Handoff

Paste a model's `model-card.md` into another LLM when asking for implementation guidance. The card is designed to stand alone: it includes verdict, sources, geometry, rig summary, humanoid mapping, hands/fingers, feet/toes, face/expression support, warnings, and recommended next work.
