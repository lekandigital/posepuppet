# Recommended Batch Execution Analysis

## Batch Summary

| Batch | Models | Prerequisite Features | Est. Time | Risk |
|-------|--------|----------------------|-----------|------|
| **0** — Promote proven | woody, darth-vader | none | 30min | low |
| **1** — Convert inspect-passed | fortnite-batman, iron-man, shrek | none | 2h | medium |
| **2** — Inspect + convert | asm2, t-800, spiderman-nwh, spiderman-ps | none | 3h | medium |
| **3** — Cleanup + convert | jack-sparrow, elsa, teal-v2, buzz | manual bone map | 8-16h | high |
| **4** — Hand-only test | rigged-hand | hand_only_mode, finger_retargeting | 1 day | medium |
| **5** — Creatures | grogu, olaf, baby-yoda, godzilla, xenomorph, king-kong | creature_profile_system | 3-5 days | high |

## Batch 0 — Promote Proven (READY NOW)

Woody and Darth Vader have passed browser smoke testing. To promote:

1. Add entries to `src/rig/avatarRegistry.ts` with `enabledInUi: true`
2. Copy VRMs to `public/avatars/` (committed to git)
3. Run Playwright full test suite
4. Deploy

## Batch 1 — Convert Inspect-Passed (READY NOW)

```sh
# On Ubuntu canonical machine
cd /home/o/Dev/posepuppet
source .venv/bin/activate

for slug in fortnite-batman iron-man shrek; do
  echo "=== $slug ==="
  python3 tools/rig_prep_model.py --slug $slug --mode convert
  python3 tools/validate_vrm_candidate.py --slug $slug
done
```

Then for each: add to `generatedAvatarRegistry.ts`, symlink, run Playwright.

### Per-model notes

- **fortnite-batman**: Best candidate — correct scale (1.69m), 24 bones, full fingers
- **iron-man**: Scale 6.49m → VRM exporter normalizes. 21 bones, full fingers
- **shrek**: FBX cm scale (83.5). Poor finger support — disable fingers in adapter

## Batch 2 — Inspect Then Convert (READY NOW)

ASM2 and T-800 already inspected. Spider-men need inspect first:

```sh
for slug in spider-man-no-way-home spider-man-playstation; do
  python3 tools/rig_prep_model.py --slug $slug --mode inspect
done

for slug in amazing-spider-man-2 terminator-t-800 spider-man-no-way-home spider-man-playstation; do
  python3 tools/rig_prep_model.py --slug $slug --mode convert
  python3 tools/validate_vrm_candidate.py --slug $slug
done
```

## Batch 3 — Cleanup Required (BLOCKED on manual bone map work)

These models have low automatic humanoid mapping. Each needs:
1. Blender inspect to verify hierarchy
2. Manual bone map editing (`model-audits/<slug>/suggested-bone-map.json`)
3. Convert + validate + smoke

## Batch 4-5 — New features required

Rigged-hand needs `hand_only_mode`. Creatures need `creature_profile_system`.

## Key Insight

**9 of 20 models (Batches 0-2) can be processed with ZERO new feature work.** The existing
pipeline handles them end-to-end. A mega-run covering Batches 0-2 would take ~5.5 hours
and produce 9 browser-loadable avatars.
