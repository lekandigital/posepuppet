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
