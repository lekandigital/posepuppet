# Hard-model final verification

- Branch: `hard-model-fix`
- Build: `npm run build` passed; Vite emitted existing chunk-size/dynamic-import warnings only.
- Generated-avatar smoke: `npx playwright test tests/generated-avatar-load.spec.ts --reporter=line` passed, `15 passed`.
- Audit self-test: `python3 tools/audit_model.py --self-test` passed, `27` examples passed with one non-fatal wrist/palm mapping warning.
- Rig-readiness validation: `python3 tools/validate_rig_readiness.py model-audits` passed, `20` model directories, no errors.
- Diff checks: `git diff --check` and `git diff --cached --check` passed.
- Forbidden staged file scans: no staged `.vrm`, `.blend`, `.fbx`, `.glb`, `.gltf`, images, zips, `model-working*`, `public/avatars/generated`, prompt, `.codex-local`, or `codex-goals` paths.
- Public UI status: generated avatars remain query-param-only with `enabledInUi: false`; no public promotion.
