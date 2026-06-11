# Site-Readiness Delta Matrix

## Readiness Tiers

| Tier | Models | Next Step | Effort |
|------|--------|-----------|--------|
| **Batch 0 — Browser smoke passed** | woody, darth-vader | Promote to public UI | 15min each |
| **Batch 1 — Inspect passed, convert next** | fortnite-batman, iron-man, shrek | Convert → validate → smoke | 30min each |
| **Batch 2 — Inspect passed or easy inspect** | amazing-spider-man-2, terminator-t-800, spider-man-no-way-home, spider-man-playstation | Inspect → convert → smoke | 30min-1h each |
| **Batch 3 — Needs cleanup or manual mapping** | jack-sparrow, elsa, teal-v2, buzz-lightyear | Manual work → convert | 2-4h each |
| **Batch 4 — Special mode** | rigged-hand | Hand-only mode impl | 1h |
| **Batch 5 — Creature profile required** | grogu, olaf, baby-yoda, godzilla, xenomorph, king-kong | Creature profile system → convert | Multi-hour |

## Per-Model Detail

| Slug | Class | Bones | Fingers | Scale | Inspect | Convert | Smoke | Batch |
|------|-------|-------|---------|-------|---------|---------|-------|-------|
| woody | smoke_passed | ✅ | palm_only | ok | ✅ | ✅ | ✅ | 0 |
| darth-vader | smoke_passed | ✅ | good | ok | ✅ | ✅ | ✅ | 0 |
| fortnite-batman | convert_next | 24 | good | 1.69m ✅ | ✅ | — | — | 1 |
| iron-man | convert_next | 21 | good | 6.49m ⚠️ | ✅ | — | — | 1 |
| shrek | convert_next | 20 | poor | 83.5m ⚠️ | ✅ | — | — | 1 |
| amazing-spider-man-2 | convert_next | 22 | missing | 69.0m ⚠️ | ✅ | — | — | 2 |
| terminator-t-800 | convert_next | 22 | missing | 203.7m ⚠️ | ✅ | — | — | 2 |
| spider-man-no-way-home | inspect_then_convert | — | — | — | — | — | — | 2 |
| spider-man-playstation | inspect_then_convert | — | — | — | — | — | — | 2 |
| jack-sparrow | inspect_then_convert | — | — | — | — | — | — | 3 |
| elsa | cleanup_first | — | — | — | — | — | — | 3 |
| teal-v2 | manual_mapping | — | — | — | — | — | — | 3 |
| buzz-lightyear | manual_mapping | — | — | — | — | — | — | 3 |
| rigged-hand | hand_only | — | — | — | — | — | — | 4 |
| grogu | creature_profile | — | — | — | — | — | — | 5 |
| olaf | creature_profile | — | — | — | — | — | — | 5 |
| baby-yoda | creature_profile | — | — | — | — | — | — | 5 |
| godzilla | creature_profile | — | — | — | — | — | — | 5 |
| xenomorph | creature_profile | — | — | — | — | — | — | 5 |
| king-kong | creature_profile | — | — | — | — | — | — | 5 |

## Scale Note

Scale values > 5m are from FBX/Blender cm-scale models. The VRM exporter normalizes these
during conversion. This is not a blocker.

## Batch A delta (2026-06-11)

| Model | Pre-batch status | Post-batch status | Delta |
|-------|-----------------|-------------------|-------|
| fortnite-batman | inspect_pass | browser_smoke_pass | converted + validated + smoke tested |
| iron-man | inspect_pass | browser_smoke_pass | converted + validated + smoke tested |
| shrek | inspect_pass | browser_smoke_pass | converted + validated + smoke tested |

Total browser-smoke-passing generated VRMs: 5 (woody, darth-vader, fortnite-batman, iron-man, shrek)
Playwright tests: 7/7 pass

## Post-Batch B Delta (2026-06-11)

| Model | Before Batch B | After Batch B |
|-------|---------------|---------------|
| amazing-spider-man-2 | convert_then_test | browser_smoke_pass, experimental, query_param_only |
| terminator-t-800 | convert_then_test | browser_smoke_pass, experimental, query_param_only |
| spider-man-no-way-home | convert_then_test | browser_smoke_pass, experimental, query_param_only |

Total browser-smoke-passing generated avatars: **8** (woody, darth-vader, fortnite-batman, iron-man, shrek, amazing-spider-man-2, terminator-t-800, spider-man-no-way-home)
Total Playwright tests: **10** (8 avatar loads + 1 missing fallback + 1 UI cycling guard)
