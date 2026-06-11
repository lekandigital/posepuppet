# Combined PosePuppet Model Audit - LLM Handoff Compact V2

Normal file to give coding agents. Start here after `model-audits/avatar-adapter-specs.json`.

## Token-saving hierarchy

Level 1 - Machine-readable implementation map: `model-audits/avatar-adapter-specs.json`
Level 2 - Normal coding-agent handoff: `COMBINED_MODEL_AUDIT_LLM_HANDOFF_COMPACT_V2.md`
Level 3 - Exhaustive generated understanding: `COMBINED_MODEL_AUDIT_ALL_GENERATED_UNDERSTANDING_V2.md`

## Included summaries

## Ubuntu rig-prep update: Darth Vader

- Candidate conversion path is now proven for `darth-vader` using `fortnite-darth-vader-advanced-rig.zip!/source/darthvaderrig.blend`.
- Generated candidate VRM: `/Users/lekan/posepuppet-working/generated-vrms/darth-vader.vrm`
- Validation passed through fallback glTF/VRMC inspection.
- Runtime browser smoke remains `not_attempted`.
- Do not promote to public UI or `public/avatars/darth-vader.vrm` yet.

## File: `model-audits/llm-handoff.md`

```markdown
# PosePuppet model audit LLM handoff

## Token-saving hierarchy

Level 1 - Machine-readable implementation map: `model-audits/avatar-adapter-specs.json`
Level 2 - Normal coding-agent handoff: `COMBINED_MODEL_AUDIT_LLM_HANDOFF_COMPACT_V2.md`
Level 3 - Exhaustive generated understanding: `COMBINED_MODEL_AUDIT_ALL_GENERATED_UNDERSTANDING_V2.md`

Do not inspect source binaries, textures, duplicate downloads, screenshots, or full bone trees unless a conversion/mapping/runtime failure requires it.

## Known current app constraints

- Current avatar registry is minimal and hardcoded.
- Current runtime loads VRM avatars through the existing VRM loader.
- Do not add arbitrary FBX, BLEND, or ZIP runtime loading.
- Do not add unfinished avatars to UI cycling by default.
- Use warning labels and feature flags when adding experimental avatars.
- If a target VRM is missing locally, the app should fail gracefully or fall back.
- Current audit phase should generate implementation plans, not modify runtime registry unless explicitly asked.

## Top recommended models

- **Woody** (`woody`): `/Users/lekan/Downloads/woody/woody-toy-story-rig-free-download/source/T-Pose (9).fbx` -> `public/avatars/woody.vrm`; profile `humanoid`; disabled face_touch, facial_expressions, fingers.
- **Darth Vader** (`darth-vader`): `fortnite-darth-vader-advanced-rig.zip!/source/darthvaderrig.blend` -> `public/avatars/darth-vader.vrm`; profile `humanoid`; disabled face_touch, facial_expressions.
- **Fortnite Batman** (`fortnite-batman`): `fortnite-batman-advanced-rig.zip!/source/BATMANRIG.blend` -> `public/avatars/fortnite-batman.vrm`; profile `humanoid`; disabled face_touch, facial_expressions.
- **Iron Man** (`iron-man`): `iron-man-rig.zip!/source/iron man.zip!/iron-man-rig/source/iron man.blend` -> `public/avatars/iron-man.vrm`; profile `humanoid`; disabled face_touch, facial_expressions.
- **Shrek** (`shrek`): `shrek-rig.zip!/source/shrek 4.zip!/source/Dying.fbx` -> `public/avatars/shrek.vrm`; profile `humanoid`; disabled face_touch, facial_expressions, fingers, toes.
- **Spider-Man No Way Home** (`spider-man-no-way-home`): `OtherSpiderman/spider-man_no_way_home_rigged.glb` -> `public/avatars/spider-man-no-way-home.vrm`; profile `humanoid`; disabled face_touch, facial_expressions, fingers.
- **Spider-Man PlayStation** (`spider-man-playstation`): `spider-man-playstation-rigged.zip!/source/spider man playstation realistic.blend` -> `public/avatars/spider-man-playstation.vrm`; profile `humanoid`; disabled face_touch, facial_expressions, fingers.
- **The Amazing Spider-Man 2** (`amazing-spider-man-2`): `OtherSpiderman/the-amazing-spider-man-2-rigged-model.zip!/source/Amazing Spider Man 2 Rigged.fbx` -> `public/avatars/amazing-spider-man-2.vrm`; profile `humanoid`; disabled face_touch, facial_expressions, fingers.

## Creature/custom profile candidates

- **Grogu**: use creature profile; disable standard humanoid full body.
- **King Kong**: use creature profile; disable standard humanoid full body.
- **Olaf**: use creature profile; disable standard humanoid full body.
- **Godzilla**: use creature profile; disable standard humanoid full body.
- **Xenomorph**: use creature profile; disable standard humanoid full body.
- **Baby Yoda**: use creature profile; disable standard humanoid full body.

## Files to read next

- `model-audits/avatar-adapter-specs.json`
- `model-audits/model-family-strategies.md`
- `model-audits/coding-queue.md`
- Per-model `avatar-adapter-spec.json` only for the avatar being implemented.

```

## File: `model-audits/avatar-adapter-specs.md`

```markdown
# Avatar Adapter Specs

This is the Level 1 machine-readable implementation map in markdown form.

| Priority | Model | Profile | Action | Source | Target VRM | Enabled | Disabled | Risk | Read first |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | Woody | humanoid | convert_to_vrm | `/Users/lekan/Downloads/woody/woody-toy-story-rig-free-download/source/T-Pose (9).fbx` | `public/avatars/woody.vrm` | arms, feet, hands, head, legs, root_motion, toes, upper_body | face_touch, facial_expressions, fingers | medium | `model-audits/woody/avatar-adapter-spec.json` |
| 2 | Darth Vader | humanoid | convert_to_vrm | `fortnite-darth-vader-advanced-rig.zip!/source/darthvaderrig.blend` | `public/avatars/darth-vader.vrm` | arms, feet, fingers, hands, head, legs, root_motion, toes, upper_body | face_touch, facial_expressions | medium | `model-audits/darth-vader/avatar-adapter-spec.json` |
| 3 | Fortnite Batman | humanoid | convert_to_vrm | `fortnite-batman-advanced-rig.zip!/source/BATMANRIG.blend` | `public/avatars/fortnite-batman.vrm` | arms, feet, fingers, hands, head, legs, root_motion, toes, upper_body | face_touch, facial_expressions | medium | `model-audits/fortnite-batman/avatar-adapter-spec.json` |
| 4 | Iron Man | humanoid | convert_to_vrm | `iron-man-rig.zip!/source/iron man.zip!/iron-man-rig/source/iron man.blend` | `public/avatars/iron-man.vrm` | arms, feet, fingers, hands, head, legs, root_motion, toes, upper_body | face_touch, facial_expressions | medium | `model-audits/iron-man/avatar-adapter-spec.json` |
| 5 | Shrek | humanoid | convert_to_vrm | `shrek-rig.zip!/source/shrek 4.zip!/source/Dying.fbx` | `public/avatars/shrek.vrm` | arms, feet, hands, head, legs, root_motion, upper_body | face_touch, facial_expressions, fingers, toes | medium | `model-audits/shrek/avatar-adapter-spec.json` |
| 6 | Spider-Man No Way Home | humanoid | convert_to_vrm | `OtherSpiderman/spider-man_no_way_home_rigged.glb` | `public/avatars/spider-man-no-way-home.vrm` | arms, feet, hands, head, legs, root_motion, toes, upper_body | face_touch, facial_expressions, fingers | medium | `model-audits/spider-man-no-way-home/avatar-adapter-spec.json` |
| 7 | Spider-Man PlayStation | humanoid | convert_to_vrm | `spider-man-playstation-rigged.zip!/source/spider man playstation realistic.blend` | `public/avatars/spider-man-playstation.vrm` | arms, feet, hands, head, legs, root_motion, toes, upper_body | face_touch, facial_expressions, fingers | medium | `model-audits/spider-man-playstation/avatar-adapter-spec.json` |
| 8 | The Amazing Spider-Man 2 | humanoid | convert_to_vrm | `OtherSpiderman/the-amazing-spider-man-2-rigged-model.zip!/source/Amazing Spider Man 2 Rigged.fbx` | `public/avatars/amazing-spider-man-2.vrm` | arms, feet, hands, head, legs, root_motion, toes, upper_body | face_touch, facial_expressions, fingers | medium | `model-audits/amazing-spider-man-2/avatar-adapter-spec.json` |
| 9 | Terminator T-800 | humanoid | convert_to_vrm | `terminator-t-800-endo-skeleton-damaged.zip!/source/terminator-t-800-endo-skeleton-damaged.zip!/source/t-800_LP.blend` | `public/avatars/terminator-t-800.vrm` | arms, feet, hands, head, legs, root_motion, toes, upper_body | face_touch, facial_expressions, fingers | medium | `model-audits/terminator-t-800/avatar-adapter-spec.json` |
| 10 | Jack Sparrow | humanoid_with_offsets | convert_to_vrm | `jack-sparrow-ready-for-animation.zip!/source/Jack Sparrow.blend` | `public/avatars/jack-sparrow.vrm` | arms, feet, hands, head, legs, toes, upper_body | face_touch, facial_expressions, fingers | medium | `model-audits/jack-sparrow/avatar-adapter-spec.json` |
| 11 | Elsa | humanoid_with_offsets | cleanup_then_convert | `elsa-free-fall-frozen-with-rig-included (1).zip!/source/elsa free fall.zip!/Elsa (merge).glb` | `public/avatars/elsa.vrm` | arms, hands, head, upper_body | face_touch, facial_expressions, feet, fingers, toes | high | `model-audits/elsa/avatar-adapter-spec.json` |
| 12 | Grogu | creature | custom_profile | `the-mandalorian-grogu-advanced-rig.zip!/source/Grogurig.blend` | `public/avatars/grogu.vrm` | arms, creature_head, creature_jaw, legs | face_touch, facial_expressions, fingers, standard_humanoid_full_body | high | `model-audits/grogu/avatar-adapter-spec.json` |
| 13 | King Kong | creature | custom_profile | `king-kong-animated.zip!/source/king kong.glb` | `public/avatars/king-kong.vrm` | arms, creature_head, creature_jaw, legs | face_touch, facial_expressions, fingers, standard_humanoid_full_body | high | `model-audits/king-kong/avatar-adapter-spec.json` |
| 14 | Olaf | creature | custom_profile | `olaf-3d-rigged.zip!/source/OlafRig.blend` | `public/avatars/olaf.vrm` | arms, creature_head, legs | face_touch, facial_expressions, fingers, standard_humanoid_full_body | high | `model-audits/olaf/avatar-adapter-spec.json` |
| 15 | Godzilla | creature | custom_profile | `godzilla-rigged-animated.zip!/source/Godzilla (New Glow).blend` | `public/avatars/godzilla.vrm` | arms, creature_head, creature_jaw, legs | face_touch, facial_expressions, fingers, standard_humanoid_full_body | high | `model-audits/godzilla/avatar-adapter-spec.json` |
| 16 | Xenomorph | creature | custom_profile | `realistic-xenomorph-rig.zip!/source/Xenomorph Default.fbx` | `public/avatars/xenomorph.vrm` | creature_head, creature_jaw, legs | face_touch, facial_expressions, fingers, standard_humanoid_full_body | high | `model-audits/xenomorph/avatar-adapter-spec.json` |
| 17 | Rigged Hand | hand_only | hand_only_test | `rigged-hand.zip!/source/handRig_02.fbx` | `public/avatars/rigged-hand.vrm` | fingers, hands | arms, face_touch, facial_expressions, feet, head, legs, root_motion, toes, torso, upper_body | high | `model-audits/rigged-hand/avatar-adapter-spec.json` |
| 18 | Teal v2 | humanoid_with_offsets | cleanup_then_convert | `teal-v2.zip!/source/Tealv2.fbx` | `public/avatars/teal-v2.vrm` | arms, feet, hands, head, legs, upper_body | face_touch, facial_expressions, fingers, toes | high | `model-audits/teal-v2/avatar-adapter-spec.json` |
| 19 | Buzz Lightyear | humanoid_with_offsets | cleanup_then_convert | `adi-20-buzz-lightyear-fully-rigged.zip!/source/Buzz Lightyear.blend` | `public/avatars/buzz-lightyear.vrm` | arms, hands, head, upper_body | face_touch, facial_expressions, feet, fingers, toes | high | `model-audits/buzz-lightyear/avatar-adapter-spec.json` |
| 20 | Baby Yoda | creature | custom_profile | `baby-yoda-mandalorian-low-poly-basic-rig.zip!/source/BABY YODA SHARE.blend` | `public/avatars/baby-yoda.vrm` | creature_head | face_touch, facial_expressions, fingers, standard_humanoid_full_body | high | `model-audits/baby-yoda/avatar-adapter-spec.json` |

```

## File: `model-audits/runtime-readiness.md`

```markdown
# Runtime readiness

| Model | Slug | Recommended action | Runtime profile | Best conversion source | Target VRM path | Conversion status | PosePuppet load status | Upper body | Hand/finger | Leg | Face/expression | Risk | Disabled controls | Performance | Adapter spec | Priority | Reason |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---:|---|
| Woody | woody | convert_then_test | humanoid | `/Users/lekan/Downloads/woody/woody-toy-story-rig-free-download/source/T-Pose (9).fbx` | `public/avatars/woody.vrm` | pass | not_attempted | not_tested | not_tested / missing | not_tested | missing / missing | medium | face_touch, facial_expressions, fingers | medium | `model-audits/woody/avatar-adapter-spec.json` | 1 | Good structural candidate, but runtime load and deformation tests are still required. |
| Darth Vader | darth-vader | convert_then_test | humanoid | `fortnite-darth-vader-advanced-rig.zip!/source/darthvaderrig.blend` | `public/avatars/darth-vader.vrm` | not_attempted | not_attempted | not_tested | not_tested / not_tested | not_tested | not_tested / not_tested | medium | face_touch, facial_expressions | heavy | `model-audits/darth-vader/avatar-adapter-spec.json` | 2 | Good structural candidate, but runtime load and deformation tests are still required. |
| Fortnite Batman | fortnite-batman | convert_then_test | humanoid | `fortnite-batman-advanced-rig.zip!/source/BATMANRIG.blend` | `public/avatars/fortnite-batman.vrm` | not_attempted | not_attempted | not_tested | not_tested / not_tested | not_tested | not_tested / not_tested | medium | face_touch, facial_expressions | heavy | `model-audits/fortnite-batman/avatar-adapter-spec.json` | 3 | Good structural candidate, but runtime load and deformation tests are still required. |
| Iron Man | iron-man | convert_then_test | humanoid | `iron-man-rig.zip!/source/iron man.zip!/iron-man-rig/source/iron man.blend` | `public/avatars/iron-man.vrm` | not_attempted | not_attempted | not_tested | not_tested / not_tested | not_tested | missing / missing | medium | face_touch, facial_expressions | heavy | `model-audits/iron-man/avatar-adapter-spec.json` | 4 | Good structural candidate, but runtime load and deformation tests are still required. |
| Shrek | shrek | convert_then_test | humanoid | `shrek-rig.zip!/source/shrek 4.zip!/source/Dying.fbx` | `public/avatars/shrek.vrm` | not_attempted | not_attempted | not_tested | not_tested / not_tested | not_tested | not_tested / not_tested | medium | face_touch, facial_expressions, fingers, toes | medium | `model-audits/shrek/avatar-adapter-spec.json` | 5 | Good structural candidate, but runtime load and deformation tests are still required. |
| Spider-Man No Way Home | spider-man-no-way-home | convert_then_test | humanoid | `OtherSpiderman/spider-man_no_way_home_rigged.glb` | `public/avatars/spider-man-no-way-home.vrm` | not_attempted | not_attempted | not_tested | not_tested / missing | not_tested | missing / missing | medium | face_touch, facial_expressions, fingers | heavy | `model-audits/spider-man-no-way-home/avatar-adapter-spec.json` | 6 | Good structural candidate, but runtime load and deformation tests are still required. |
| Spider-Man PlayStation | spider-man-playstation | convert_then_test | humanoid | `spider-man-playstation-rigged.zip!/source/spider man playstation realistic.blend` | `public/avatars/spider-man-playstation.vrm` | not_attempted | not_attempted | not_tested | not_tested / missing | not_tested | missing / missing | medium | face_touch, facial_expressions, fingers | very_heavy | `model-audits/spider-man-playstation/avatar-adapter-spec.json` | 7 | Good structural candidate, but runtime load and deformation tests are still required. |
| The Amazing Spider-Man 2 | amazing-spider-man-2 | convert_then_test | humanoid | `OtherSpiderman/the-amazing-spider-man-2-rigged-model.zip!/source/Amazing Spider Man 2 Rigged.fbx` | `public/avatars/amazing-spider-man-2.vrm` | not_attempted | not_attempted | not_tested | not_tested / missing | not_tested | missing / missing | medium | face_touch, facial_expressions, fingers | medium | `model-audits/amazing-spider-man-2/avatar-adapter-spec.json` | 8 | Good structural candidate, but runtime load and deformation tests are still required. |
| Terminator T-800 | terminator-t-800 | convert_then_test | humanoid | `terminator-t-800-endo-skeleton-damaged.zip!/source/terminator-t-800-endo-skeleton-damaged.zip!/source/t-800_LP.blend` | `public/avatars/terminator-t-800.vrm` | not_attempted | not_attempted | not_tested | not_tested / missing | not_tested | missing / missing | medium | face_touch, facial_expressions, fingers | medium | `model-audits/terminator-t-800/avatar-adapter-spec.json` | 9 | Good structural candidate, but runtime load and deformation tests are still required. |
| Jack Sparrow | jack-sparrow | convert_then_test | humanoid_with_offsets | `jack-sparrow-ready-for-animation.zip!/source/Jack Sparrow.blend` | `public/avatars/jack-sparrow.vrm` | not_attempted | not_attempted | not_tested | not_tested / missing | not_tested | missing / missing | medium | face_touch, facial_expressions, fingers | very_heavy | `model-audits/jack-sparrow/avatar-adapter-spec.json` | 10 | Good structural candidate, but runtime load and deformation tests are still required. |
| Elsa | elsa | cleanup_then_convert | humanoid_with_offsets | `elsa-free-fall-frozen-with-rig-included (1).zip!/source/elsa free fall.zip!/Elsa (merge).glb` | `public/avatars/elsa.vrm` | not_attempted | not_attempted | not_tested | not_tested / not_tested | disabled | not_tested / not_tested | high | face_touch, facial_expressions, feet, fingers, toes | light | `model-audits/elsa/avatar-adapter-spec.json` | 11 | Partial structure exists, but cleanup or custom mapping is needed first. |
| Grogu | grogu | custom_profile | creature | `the-mandalorian-grogu-advanced-rig.zip!/source/Grogurig.blend` | `public/avatars/grogu.vrm` | not_attempted | not_attempted | not_tested | not_tested / not_tested | not_tested | not_tested / not_tested | high | face_touch, facial_expressions, fingers, standard_humanoid_full_body | medium | `model-audits/grogu/avatar-adapter-spec.json` | 12 | Nonstandard anatomy should not be forced into standard humanoid full-body mode. |
| King Kong | king-kong | custom_profile | creature | `king-kong-animated.zip!/source/king kong.glb` | `public/avatars/king-kong.vrm` | not_attempted | not_attempted | not_tested | not_tested / not_tested | not_tested | not_tested / not_tested | high | face_touch, facial_expressions, fingers, standard_humanoid_full_body | very_heavy | `model-audits/king-kong/avatar-adapter-spec.json` | 13 | Nonstandard anatomy should not be forced into standard humanoid full-body mode. |
| Olaf | olaf | custom_profile | creature | `olaf-3d-rigged.zip!/source/OlafRig.blend` | `public/avatars/olaf.vrm` | not_attempted | not_attempted | not_tested | not_tested / not_tested | not_tested | missing / missing | high | face_touch, facial_expressions, fingers, standard_humanoid_full_body | medium | `model-audits/olaf/avatar-adapter-spec.json` | 14 | Nonstandard anatomy should not be forced into standard humanoid full-body mode. |
| Godzilla | godzilla | custom_profile | creature | `godzilla-rigged-animated.zip!/source/Godzilla (New Glow).blend` | `public/avatars/godzilla.vrm` | not_attempted | not_attempted | not_tested | not_tested / not_tested | not_tested | missing / missing | high | face_touch, facial_expressions, fingers, standard_humanoid_full_body | heavy | `model-audits/godzilla/avatar-adapter-spec.json` | 15 | Nonstandard anatomy should not be forced into standard humanoid full-body mode. |
| Xenomorph | xenomorph | custom_profile | creature | `realistic-xenomorph-rig.zip!/source/Xenomorph Default.fbx` | `public/avatars/xenomorph.vrm` | not_attempted | not_attempted | not_tested | disabled / not_tested | not_tested | not_tested / not_tested | high | face_touch, facial_expressions, fingers, standard_humanoid_full_body | heavy | `model-audits/xenomorph/avatar-adapter-spec.json` | 16 | Nonstandard anatomy should not be forced into standard humanoid full-body mode. |
| Rigged Hand | rigged-hand | hand_test_only | hand_only | `rigged-hand.zip!/source/handRig_02.fbx` | `public/avatars/rigged-hand.vrm` | not_attempted | not_attempted | not_tested | not_tested / not_tested | disabled | missing / missing | high | arms, face_touch, facial_expressions, feet, head, legs, root_motion, toes, torso, upper_body | medium | `model-audits/rigged-hand/avatar-adapter-spec.json` | 17 | Use only for hand/finger experiments; it is not a full avatar. |
| Teal v2 | teal-v2 | cleanup_then_convert | humanoid_with_offsets | `teal-v2.zip!/source/Tealv2.fbx` | `public/avatars/teal-v2.vrm` | not_attempted | not_attempted | not_tested | disabled / missing | not_tested | not_tested / not_tested | high | face_touch, facial_expressions, fingers, toes | medium | `model-audits/teal-v2/avatar-adapter-spec.json` | 18 | Automatic mapping is too weak; inspect hierarchy and create a manual map first. |
| Buzz Lightyear | buzz-lightyear | cleanup_then_convert | humanoid_with_offsets | `adi-20-buzz-lightyear-fully-rigged.zip!/source/Buzz Lightyear.blend` | `public/avatars/buzz-lightyear.vrm` | not_attempted | not_attempted | not_tested | disabled / missing | disabled | missing / missing | high | face_touch, facial_expressions, feet, fingers, toes | light | `model-audits/buzz-lightyear/avatar-adapter-spec.json` | 19 | Automatic mapping is too weak; inspect hierarchy and create a manual map first. |
| Baby Yoda | baby-yoda | custom_profile | creature | `baby-yoda-mandalorian-low-poly-basic-rig.zip!/source/BABY YODA SHARE.blend` | `public/avatars/baby-yoda.vrm` | not_attempted | not_attempted | not_tested | disabled / missing | disabled | not_tested / not_tested | high | face_touch, facial_expressions, fingers, standard_humanoid_full_body | medium | `model-audits/baby-yoda/avatar-adapter-spec.json` | 20 | Nonstandard anatomy should not be forced into standard humanoid full-body mode. |

```

## File: `model-audits/conversion-matrix.md`

```markdown
# Conversion matrix

| Model | Slug | Selected source | Source format | Reference/runtime GLB | Target VRM | Armature found | Humanoid mapping | Missing required VRM bones | Manual mapping | Texture expectation | VRM status | Conversion diff | Command/notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Woody | woody | `/Users/lekan/Downloads/woody/woody-toy-story-rig-free-download/source/T-Pose (9).fbx` | fbx | `/Users/lekan/Downloads/woody/woody_toy_story_rig_free_download.glb` | `public/avatars/woody.vrm` | true | high | none | false | embedded | pass | completed | see per-model conversion-report.md |
| Darth Vader | darth-vader | `fortnite-darth-vader-advanced-rig.zip!/source/darthvaderrig.blend` | blend | `fortnite_darth_vader_advanced_rig (2).glb` | `public/avatars/darth-vader.vrm` | true | high | none | true | not_attempted | not_attempted | not_attempted | see per-model conversion-report.md |
| Fortnite Batman | fortnite-batman | `fortnite-batman-advanced-rig.zip!/source/BATMANRIG.blend` | blend | `fortnite_batman_advanced_rig.glb` | `public/avatars/fortnite-batman.vrm` | true | high | none | true | not_attempted | not_attempted | not_attempted | see per-model conversion-report.md |
| Iron Man | iron-man | `iron-man-rig.zip!/source/iron man.zip!/iron-man-rig/source/iron man.blend` | blend | `iron_man_rig.glb` | `public/avatars/iron-man.vrm` | true | high | none | true | not_attempted | not_attempted | not_attempted | see per-model conversion-report.md |
| Shrek | shrek | `shrek-rig.zip!/source/shrek 4.zip!/source/Dying.fbx` | fbx | `shrek_rig.glb` | `public/avatars/shrek.vrm` | true | high | neck | true | not_attempted | not_attempted | not_attempted | see per-model conversion-report.md |
| Spider-Man No Way Home | spider-man-no-way-home | `OtherSpiderman/spider-man_no_way_home_rigged.glb` | glb | `none` | `public/avatars/spider-man-no-way-home.vrm` | true | high | none | true | not_attempted | not_attempted | not_attempted | see per-model conversion-report.md |
| Spider-Man PlayStation | spider-man-playstation | `spider-man-playstation-rigged.zip!/source/spider man playstation realistic.blend` | blend | `spider_man_playstation_rigged.glb` | `public/avatars/spider-man-playstation.vrm` | true | high | none | true | not_attempted | not_attempted | not_attempted | see per-model conversion-report.md |
| The Amazing Spider-Man 2 | amazing-spider-man-2 | `OtherSpiderman/the-amazing-spider-man-2-rigged-model.zip!/source/Amazing Spider Man 2 Rigged.fbx` | fbx | `OtherSpiderman/the_amazing_spider_man_2_rigged_model.glb` | `public/avatars/amazing-spider-man-2.vrm` | true | high | none | true | not_attempted | not_attempted | not_attempted | see per-model conversion-report.md |
| Terminator T-800 | terminator-t-800 | `terminator-t-800-endo-skeleton-damaged.zip!/source/terminator-t-800-endo-skeleton-damaged.zip!/source/t-800_LP.blend` | blend | `terminator-t-800-endo-skeleton-damaged.glb` | `public/avatars/terminator-t-800.vrm` | true | high | none | true | not_attempted | not_attempted | not_attempted | see per-model conversion-report.md |
| Jack Sparrow | jack-sparrow | `jack-sparrow-ready-for-animation.zip!/source/Jack Sparrow.blend` | blend | `jack_sparrow_ready_for_animation.glb` | `public/avatars/jack-sparrow.vrm` | true | high | none | true | not_attempted | not_attempted | not_attempted | see per-model conversion-report.md |
| Elsa | elsa | `elsa-free-fall-frozen-with-rig-included (1).zip!/source/elsa free fall.zip!/Elsa (merge).glb` | glb | `elsa_free_fall_frozen_with_rig_included (2).glb` | `public/avatars/elsa.vrm` | true | medium | spine | true | not_attempted | not_attempted | not_attempted | see per-model conversion-report.md |
| Grogu | grogu | `the-mandalorian-grogu-advanced-rig.zip!/source/Grogurig.blend` | blend | `the_mandalorian_grogu_advanced_rig.glb` | `public/avatars/grogu.vrm` | true | medium | chest, neck, head | true | not_attempted | not_attempted | not_attempted | see per-model conversion-report.md |
| King Kong | king-kong | `king-kong-animated.zip!/source/king kong.glb` | glb | `king_kong_animated.glb` | `public/avatars/king-kong.vrm` | true | high | chest | true | not_attempted | not_attempted | not_attempted | see per-model conversion-report.md |
| Olaf | olaf | `olaf-3d-rigged.zip!/source/OlafRig.blend` | blend | `olaf_3d_rigged.glb` | `public/avatars/olaf.vrm` | true | medium | spine, chest, neck | true | not_attempted | not_attempted | not_attempted | see per-model conversion-report.md |
| Godzilla | godzilla | `godzilla-rigged-animated.zip!/source/Godzilla (New Glow).blend` | blend | `godzilla_rigged_animated.glb` | `public/avatars/godzilla.vrm` | true | high | hips, chest | true | not_attempted | not_attempted | not_attempted | see per-model conversion-report.md |
| Xenomorph | xenomorph | `realistic-xenomorph-rig.zip!/source/Xenomorph Default.fbx` | fbx | `realistic_xenomorph_rig.glb` | `public/avatars/xenomorph.vrm` | true | medium | hips, chest | true | not_attempted | not_attempted | not_attempted | see per-model conversion-report.md |
| Rigged Hand | rigged-hand | `rigged-hand.zip!/source/handRig_02.fbx` | fbx | `rigged_hand.glb` | `public/avatars/rigged-hand.vrm` | true | low | hips, spine, chest, neck, head | true | not_attempted | not_attempted | not_attempted | see per-model conversion-report.md |
| Teal v2 | teal-v2 | `teal-v2.zip!/source/Tealv2.fbx` | fbx | `teal_v.2.glb` | `public/avatars/teal-v2.vrm` | true | low | hips, chest, neck | true | not_attempted | not_attempted | not_attempted | see per-model conversion-report.md |
| Buzz Lightyear | buzz-lightyear | `adi-20-buzz-lightyear-fully-rigged.zip!/source/Buzz Lightyear.blend` | blend | `adi_2.0_buzz_lightyear_fully_rigged.glb` | `public/avatars/buzz-lightyear.vrm` | true | low | hips, spine, chest, neck, head | true | not_attempted | not_attempted | not_attempted | see per-model conversion-report.md |
| Baby Yoda | baby-yoda | `baby-yoda-mandalorian-low-poly-basic-rig.zip!/source/BABY YODA SHARE.blend` | blend | `baby_yoda_mandalorian_-_low_poly_-_basic_rig.glb` | `public/avatars/baby-yoda.vrm` | true | low | hips, spine, chest, neck, head | true | not_attempted | not_attempted | not_attempted | see per-model conversion-report.md |

```

## File: `model-audits/model-family-strategies.md`

```markdown
# Model family strategies

## Humanoid full-body VRM candidates

- `darth-vader`
- `fortnite-batman`
- `iron-man`

- Shared controls: enable only structurally supported controls from each adapter spec.
- Shared risk: runtime deformation is not proven until VRM load and pose tests pass.
- Inspect per-model dossier only when the aggregate adapter spec is insufficient.
- Do not inspect source binaries or duplicate downloads unless source-lock/conversion failures require it.

## Humanoid palm-only / no-finger candidates

- `woody`
- `shrek`
- `spider-man-no-way-home`
- `spider-man-playstation`
- `amazing-spider-man-2`
- `terminator-t-800`

- Shared controls: enable only structurally supported controls from each adapter spec.
- Shared risk: runtime deformation is not proven until VRM load and pose tests pass.
- Inspect per-model dossier only when the aggregate adapter spec is insufficient.
- Do not inspect source binaries or duplicate downloads unless source-lock/conversion failures require it.

## Humanoid-with-offsets / custom mapping candidates

- `jack-sparrow`
- `elsa`
- `teal-v2`
- `buzz-lightyear`

- Shared controls: enable only structurally supported controls from each adapter spec.
- Shared risk: runtime deformation is not proven until VRM load and pose tests pass.
- Inspect per-model dossier only when the aggregate adapter spec is insufficient.
- Do not inspect source binaries or duplicate downloads unless source-lock/conversion failures require it.

## Creature-profile candidates

- `grogu`
- `king-kong`
- `olaf`
- `godzilla`
- `xenomorph`
- `baby-yoda`

- Shared controls: enable only structurally supported controls from each adapter spec.
- Shared risk: runtime deformation is not proven until VRM load and pose tests pass.
- Inspect per-model dossier only when the aggregate adapter spec is insufficient.
- Do not inspect source binaries or duplicate downloads unless source-lock/conversion failures require it.

## Hand-only candidates

- `rigged-hand`

- Shared controls: enable only structurally supported controls from each adapter spec.
- Shared risk: runtime deformation is not proven until VRM load and pose tests pass.
- Inspect per-model dossier only when the aggregate adapter spec is insufficient.
- Do not inspect source binaries or duplicate downloads unless source-lock/conversion failures require it.

## Static-preview / ignore-for-now candidates

- None.

- Shared controls: enable only structurally supported controls from each adapter spec.
- Shared risk: runtime deformation is not proven until VRM load and pose tests pass.
- Inspect per-model dossier only when the aggregate adapter spec is insufficient.
- Do not inspect source binaries or duplicate downloads unless source-lock/conversion failures require it.


```

## File: `model-audits/avatar-registry-plan.md`

```markdown
# Avatar registry plan

Documentation only. Do not modify `src/rig/avatarRegistry.ts` until explicitly asked.

| Avatar | Profile | Warning | Add now | Required before enable | Spec |
|---|---|---|---:|---|---|
| Woody | humanoid | experimental | false | convert_to_vrm, load_test, orientation_test | `model-audits/woody/avatar-adapter-spec.json` |
| Darth Vader | humanoid | conversion-needed | false | convert_to_vrm, load_test, orientation_test | `model-audits/darth-vader/avatar-adapter-spec.json` |
| Fortnite Batman | humanoid | conversion-needed | false | convert_to_vrm, load_test, orientation_test | `model-audits/fortnite-batman/avatar-adapter-spec.json` |
| Iron Man | humanoid | conversion-needed | false | convert_to_vrm, load_test, orientation_test | `model-audits/iron-man/avatar-adapter-spec.json` |
| Shrek | humanoid | conversion-needed | false | convert_to_vrm, load_test, orientation_test | `model-audits/shrek/avatar-adapter-spec.json` |
| Spider-Man No Way Home | humanoid | conversion-needed | false | convert_to_vrm, load_test, orientation_test | `model-audits/spider-man-no-way-home/avatar-adapter-spec.json` |
| Spider-Man PlayStation | humanoid | conversion-needed | false | convert_to_vrm, load_test, orientation_test | `model-audits/spider-man-playstation/avatar-adapter-spec.json` |
| The Amazing Spider-Man 2 | humanoid | conversion-needed | false | convert_to_vrm, load_test, orientation_test | `model-audits/amazing-spider-man-2/avatar-adapter-spec.json` |
| Terminator T-800 | humanoid | conversion-needed | false | convert_to_vrm, load_test, orientation_test | `model-audits/terminator-t-800/avatar-adapter-spec.json` |
| Jack Sparrow | humanoid_with_offsets | conversion-needed | false | convert_to_vrm, load_test, orientation_test | `model-audits/jack-sparrow/avatar-adapter-spec.json` |
| Elsa | humanoid_with_offsets | cleanup-needed | false | convert_to_vrm, load_test, orientation_test | `model-audits/elsa/avatar-adapter-spec.json` |
| Grogu | creature | creature-profile-needed | false | convert_to_vrm, load_test, orientation_test | `model-audits/grogu/avatar-adapter-spec.json` |
| King Kong | creature | creature-profile-needed | false | convert_to_vrm, load_test, orientation_test | `model-audits/king-kong/avatar-adapter-spec.json` |
| Olaf | creature | creature-profile-needed | false | convert_to_vrm, load_test, orientation_test | `model-audits/olaf/avatar-adapter-spec.json` |
| Godzilla | creature | creature-profile-needed | false | convert_to_vrm, load_test, orientation_test | `model-audits/godzilla/avatar-adapter-spec.json` |
| Xenomorph | creature | creature-profile-needed | false | convert_to_vrm, load_test, orientation_test | `model-audits/xenomorph/avatar-adapter-spec.json` |
| Rigged Hand | hand_only | hand-only | false | convert_to_vrm, load_test, orientation_test | `model-audits/rigged-hand/avatar-adapter-spec.json` |
| Teal v2 | humanoid_with_offsets | cleanup-needed | false | convert_to_vrm, load_test, orientation_test | `model-audits/teal-v2/avatar-adapter-spec.json` |
| Buzz Lightyear | humanoid_with_offsets | cleanup-needed | false | convert_to_vrm, load_test, orientation_test | `model-audits/buzz-lightyear/avatar-adapter-spec.json` |
| Baby Yoda | creature | creature-profile-needed | false | convert_to_vrm, load_test, orientation_test | `model-audits/baby-yoda/avatar-adapter-spec.json` |

## Buckets

- Safe to add to registry now: none.
- Safe behind feature flag after conversion/load/orientation tests: Woody, Darth Vader, Fortnite Batman, Iron Man, Shrek, Spider-Man variants, Terminator.
- Convert first: all humanoid candidates without completed conversion diff.
- Cleanup first: Elsa, Buzz Lightyear, Teal v2, Jack Sparrow if offsets/clothing fail.
- Custom profile first: Godzilla, King Kong, Xenomorph, Grogu, Olaf, Baby Yoda.
- Ignore for now: none hard-blocked, but low-scoring models should stay out of UI until improved.

```

## File: `model-audits/coding-queue.md`

```markdown
# Coding queue

## 1. Convert Woody FBX to VRM and verify runtime load

- Models: woody
- Depends on: none
- Reads: model-audits/woody/avatar-adapter-spec.json, model-audits/woody/llm-dossier.md
- Do not read: source textures unless conversion fails, duplicate GLBs
- Acceptance tests: public/avatars/woody.vrm loads in @pixiv/three-vrm, PosePuppet fallback is graceful if missing

## 2. Add a gated avatar registry path for converted humanoid VRMs

- Models: woody, darth-vader, fortnite-batman, iron-man, shrek
- Depends on: VRM conversion/load tests
- Reads: model-audits/avatar-registry-plan.json, model-audits/avatar-adapter-specs.json
- Do not read: source binaries
- Acceptance tests: avatars are hidden or warning-labeled until target VRMs exist

## 3. Implement humanoid offset profiles and palm-only fallback

- Models: spider-man-no-way-home, spider-man-playstation, amazing-spider-man-2, terminator-t-800, jack-sparrow, elsa
- Depends on: basic registry support
- Reads: model-audits/model-family-strategies.md
- Do not read: duplicate downloads
- Acceptance tests: missing fingers disable finger controls, face-touch remains disabled until IK tests pass

## 4. Create creature profile prototypes

- Models: godzilla, king-kong, xenomorph, grogu, olaf, baby-yoda
- Depends on: none
- Reads: model-audits/model-family-strategies.md
- Do not read: source binaries until profile targets are chosen
- Acceptance tests: standard_humanoid_full_body is disabled for creature models

## 5. Create hand/finger test harness

- Models: rigged-hand
- Depends on: none
- Reads: model-audits/rigged-hand/avatar-adapter-spec.json
- Do not read: full avatar folders
- Acceptance tests: hand asset is not exposed as a full avatar


```

## File: `model-audits/implementation-playbook.md`

```markdown
# Implementation playbook

## Token-saving hierarchy

Level 1 - Machine-readable implementation map:
`model-audits/avatar-adapter-specs.json`

Level 2 - Normal coding-agent handoff:
`COMBINED_MODEL_AUDIT_LLM_HANDOFF_COMPACT_V2.md`

Level 3 - Exhaustive generated understanding:
`COMBINED_MODEL_AUDIT_ALL_GENERATED_UNDERSTANDING_V2.md`

Start with Level 1. Open Level 2 only if implementation needs reasoning context. Open Level 3 only if compact handoff is insufficient. Open per-model files only if Level 3 points you there. Open `bone-tree.txt` only if mapping fails. Open screenshots/contact sheets only if visual review is missing or inconclusive. Open source binaries only if conversion/debugging fails.

## Known app constraints

- Current avatar registry is minimal and hardcoded.
- Current runtime loads VRM avatars through the existing VRM loader.
- Do not add arbitrary FBX, BLEND, or ZIP runtime loading.
- Do not add unfinished avatars to UI cycling by default.
- Use warning labels and feature flags when adding experimental avatars.
- If a target VRM is missing locally, the app should fail gracefully or fall back.
- Current audit phase should generate implementation plans, not modify runtime registry unless explicitly asked.

## Runtime format and VRM policy

- Runtime format: VRM.
- Path convention: `public/avatars/<slug>.vrm`.
- Policy A - local/private avatars: keep `*.vrm` ignored, user manually places VRMs under `public/avatars/`, app gracefully falls back if missing.
- Policy B - committed approved demo avatars: keep sources ignored, explicitly unignore only approved runtime VRMs such as `!public/avatars/woody.vrm`, and commit only after user approval.
- This audit uses Policy A.

## Warning-label taxonomy

| Label | Meaning | UI policy | Default disabled controls |
|---|---|---|---|
| none | Fully verified runtime avatar | Can appear normally | unsupported controls only |
| partial | Usable with known limitations | Feature flag or warning | fingers/face as needed |
| experimental | Conversion/runtime not fully proven | Feature flag | risky controls |
| not-well-developed | Weak or incomplete model support | Hide by default | most controls |
| creature-profile-needed | Needs non-humanoid profile | Hide until profile exists | standard_humanoid_full_body |
| hand-only | Hand/finger test asset | Tools/tests only | body/face/feet |
| static-preview-only | Non-retargeted preview | Preview only | all tracking controls |
| conversion-needed | Source selected but VRM missing | Hide until converted | all runtime controls |
| cleanup-needed | Blender/manual mapping needed | Hide until cleaned | controls with bad mapping |

## Acceptance tests

- VRM loads in @pixiv/three-vrm.
- Avatar appears upright and facing the camera.
- Head and arms track without runtime errors.
- Unsupported controls are disabled.
- Missing VRM files show warnings/fallback rather than breaking the app.


```

## Per-model summary: Woody (`woody`)

- Action: `convert_then_test`
- Profile: `humanoid`
- Source: `/Users/lekan/Downloads/woody/woody-toy-story-rig-free-download/source/T-Pose (9).fbx`
- Target: `public/avatars/woody.vrm`
- Read first: `model-audits/woody/avatar-adapter-spec.json`
- Do not implement: Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.; Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.; Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.; Do not enable fingers; use palm-only or curl presets.; Do not enable facial expressions for this model yet.

## Per-model summary: Darth Vader (`darth-vader`)

- Action: `convert_then_test`
- Profile: `humanoid`
- Source: `fortnite-darth-vader-advanced-rig.zip!/source/darthvaderrig.blend`
- Target: `public/avatars/darth-vader.vrm`
- Read first: `model-audits/darth-vader/avatar-adapter-spec.json`
- Do not implement: Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.; Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.; Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.; Do not enable facial expressions for this model yet.

## Per-model summary: Fortnite Batman (`fortnite-batman`)

- Action: `convert_then_test`
- Profile: `humanoid`
- Source: `fortnite-batman-advanced-rig.zip!/source/BATMANRIG.blend`
- Target: `public/avatars/fortnite-batman.vrm`
- Read first: `model-audits/fortnite-batman/avatar-adapter-spec.json`
- Do not implement: Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.; Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.; Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.; Do not enable facial expressions for this model yet.

## Per-model summary: Iron Man (`iron-man`)

- Action: `convert_then_test`
- Profile: `humanoid`
- Source: `iron-man-rig.zip!/source/iron man.zip!/iron-man-rig/source/iron man.blend`
- Target: `public/avatars/iron-man.vrm`
- Read first: `model-audits/iron-man/avatar-adapter-spec.json`
- Do not implement: Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.; Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.; Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.; Do not enable facial expressions for this model yet.

## Per-model summary: Shrek (`shrek`)

- Action: `convert_then_test`
- Profile: `humanoid`
- Source: `shrek-rig.zip!/source/shrek 4.zip!/source/Dying.fbx`
- Target: `public/avatars/shrek.vrm`
- Read first: `model-audits/shrek/avatar-adapter-spec.json`
- Do not implement: Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.; Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.; Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.; Do not enable fingers; use palm-only or curl presets.; Do not enable facial expressions for this model yet.

## Per-model summary: Spider-Man No Way Home (`spider-man-no-way-home`)

- Action: `convert_then_test`
- Profile: `humanoid`
- Source: `OtherSpiderman/spider-man_no_way_home_rigged.glb`
- Target: `public/avatars/spider-man-no-way-home.vrm`
- Read first: `model-audits/spider-man-no-way-home/avatar-adapter-spec.json`
- Do not implement: Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.; Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.; Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.; Do not enable fingers; use palm-only or curl presets.; Do not enable facial expressions for this model yet.

## Per-model summary: Spider-Man PlayStation (`spider-man-playstation`)

- Action: `convert_then_test`
- Profile: `humanoid`
- Source: `spider-man-playstation-rigged.zip!/source/spider man playstation realistic.blend`
- Target: `public/avatars/spider-man-playstation.vrm`
- Read first: `model-audits/spider-man-playstation/avatar-adapter-spec.json`
- Do not implement: Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.; Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.; Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.; Do not enable fingers; use palm-only or curl presets.; Do not enable facial expressions for this model yet.

## Per-model summary: The Amazing Spider-Man 2 (`amazing-spider-man-2`)

- Action: `convert_then_test`
- Profile: `humanoid`
- Source: `OtherSpiderman/the-amazing-spider-man-2-rigged-model.zip!/source/Amazing Spider Man 2 Rigged.fbx`
- Target: `public/avatars/amazing-spider-man-2.vrm`
- Read first: `model-audits/amazing-spider-man-2/avatar-adapter-spec.json`
- Do not implement: Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.; Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.; Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.; Do not enable fingers; use palm-only or curl presets.; Do not enable facial expressions for this model yet.

## Per-model summary: Terminator T-800 (`terminator-t-800`)

- Action: `convert_then_test`
- Profile: `humanoid`
- Source: `terminator-t-800-endo-skeleton-damaged.zip!/source/terminator-t-800-endo-skeleton-damaged.zip!/source/t-800_LP.blend`
- Target: `public/avatars/terminator-t-800.vrm`
- Read first: `model-audits/terminator-t-800/avatar-adapter-spec.json`
- Do not implement: Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.; Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.; Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.; Do not enable fingers; use palm-only or curl presets.; Do not enable facial expressions for this model yet.

## Per-model summary: Jack Sparrow (`jack-sparrow`)

- Action: `convert_then_test`
- Profile: `humanoid_with_offsets`
- Source: `jack-sparrow-ready-for-animation.zip!/source/Jack Sparrow.blend`
- Target: `public/avatars/jack-sparrow.vrm`
- Read first: `model-audits/jack-sparrow/avatar-adapter-spec.json`
- Do not implement: Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.; Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.; Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.; Do not enable fingers; use palm-only or curl presets.; Do not enable facial expressions for this model yet.

## Per-model summary: Elsa (`elsa`)

- Action: `cleanup_then_convert`
- Profile: `humanoid_with_offsets`
- Source: `elsa-free-fall-frozen-with-rig-included (1).zip!/source/elsa free fall.zip!/Elsa (merge).glb`
- Target: `public/avatars/elsa.vrm`
- Read first: `model-audits/elsa/avatar-adapter-spec.json`
- Do not implement: Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.; Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.; Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.; Do not enable fingers; use palm-only or curl presets.; Do not enable facial expressions for this model yet.; Do not enable feet for this model yet.

## Per-model summary: Grogu (`grogu`)

- Action: `custom_profile`
- Profile: `creature`
- Source: `the-mandalorian-grogu-advanced-rig.zip!/source/Grogurig.blend`
- Target: `public/avatars/grogu.vrm`
- Read first: `model-audits/grogu/avatar-adapter-spec.json`
- Do not implement: Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.; Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.; Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.; Do not enable facial expressions for this model yet.; Do not force standard full-body humanoid mode; use a creature profile.

## Per-model summary: King Kong (`king-kong`)

- Action: `custom_profile`
- Profile: `creature`
- Source: `king-kong-animated.zip!/source/king kong.glb`
- Target: `public/avatars/king-kong.vrm`
- Read first: `model-audits/king-kong/avatar-adapter-spec.json`
- Do not implement: Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.; Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.; Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.; Do not enable facial expressions for this model yet.; Do not force standard full-body humanoid mode; use a creature profile.

## Per-model summary: Olaf (`olaf`)

- Action: `custom_profile`
- Profile: `creature`
- Source: `olaf-3d-rigged.zip!/source/OlafRig.blend`
- Target: `public/avatars/olaf.vrm`
- Read first: `model-audits/olaf/avatar-adapter-spec.json`
- Do not implement: Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.; Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.; Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.; Do not enable facial expressions for this model yet.; Do not force standard full-body humanoid mode; use a creature profile.

## Per-model summary: Godzilla (`godzilla`)

- Action: `custom_profile`
- Profile: `creature`
- Source: `godzilla-rigged-animated.zip!/source/Godzilla (New Glow).blend`
- Target: `public/avatars/godzilla.vrm`
- Read first: `model-audits/godzilla/avatar-adapter-spec.json`
- Do not implement: Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.; Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.; Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.; Do not enable fingers; use palm-only or curl presets.; Do not enable facial expressions for this model yet.; Do not force standard full-body humanoid mode; use a creature profile.

## Per-model summary: Xenomorph (`xenomorph`)

- Action: `custom_profile`
- Profile: `creature`
- Source: `realistic-xenomorph-rig.zip!/source/Xenomorph Default.fbx`
- Target: `public/avatars/xenomorph.vrm`
- Read first: `model-audits/xenomorph/avatar-adapter-spec.json`
- Do not implement: Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.; Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.; Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.; Do not enable fingers; use palm-only or curl presets.; Do not enable facial expressions for this model yet.; Do not force standard full-body humanoid mode; use a creature profile.

## Per-model summary: Rigged Hand (`rigged-hand`)

- Action: `hand_test_only`
- Profile: `hand_only`
- Source: `rigged-hand.zip!/source/handRig_02.fbx`
- Target: `public/avatars/rigged-hand.vrm`
- Read first: `model-audits/rigged-hand/avatar-adapter-spec.json`
- Do not implement: Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.; Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.; Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.; Do not enable fingers; use palm-only or curl presets.; Do not enable facial expressions for this model yet.; Do not enable feet for this model yet.; Do not treat this as a full avatar; use it only for hand/finger tests.

## Per-model summary: Teal v2 (`teal-v2`)

- Action: `cleanup_then_convert`
- Profile: `humanoid_with_offsets`
- Source: `teal-v2.zip!/source/Tealv2.fbx`
- Target: `public/avatars/teal-v2.vrm`
- Read first: `model-audits/teal-v2/avatar-adapter-spec.json`
- Do not implement: Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.; Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.; Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.; Do not enable fingers; use palm-only or curl presets.; Do not enable facial expressions for this model yet.

## Per-model summary: Buzz Lightyear (`buzz-lightyear`)

- Action: `cleanup_then_convert`
- Profile: `humanoid_with_offsets`
- Source: `adi-20-buzz-lightyear-fully-rigged.zip!/source/Buzz Lightyear.blend`
- Target: `public/avatars/buzz-lightyear.vrm`
- Read first: `model-audits/buzz-lightyear/avatar-adapter-spec.json`
- Do not implement: Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.; Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.; Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.; Do not enable fingers; use palm-only or curl presets.; Do not enable facial expressions for this model yet.; Do not enable feet for this model yet.

## Per-model summary: Baby Yoda (`baby-yoda`)

- Action: `custom_profile`
- Profile: `creature`
- Source: `baby-yoda-mandalorian-low-poly-basic-rig.zip!/source/BABY YODA SHARE.blend`
- Target: `public/avatars/baby-yoda.vrm`
- Read first: `model-audits/baby-yoda/avatar-adapter-spec.json`
- Do not implement: Do not implement FBX, BLEND, ZIP, or texture loading in the browser runtime.; Do not add this avatar to public UI cycling until VRM conversion and runtime load tests pass.; Do not inspect duplicate GLBs or source textures unless conversion/debugging fails.; Do not enable fingers; use palm-only or curl presets.; Do not enable facial expressions for this model yet.; Do not enable feet for this model yet.; Do not force standard full-body humanoid mode; use a creature profile.
