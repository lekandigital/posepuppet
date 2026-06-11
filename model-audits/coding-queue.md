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

## Ubuntu rig-prep update: Darth Vader

- Darth Vader has now cleared source dry-run, Blender inspect, candidate conversion, and candidate validation.
- The next blocking proof is a runtime browser load smoke test, not more source conversion work.
- Keep `public/avatars/darth-vader.vrm` untouched until that runtime smoke test passes and the user explicitly approves promotion.
