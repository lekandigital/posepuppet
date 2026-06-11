# Batch A Conversion Smoke Report

- Batch: `A`
- Created: `2026-06-11T16:21:00+00:00`
- Models attempted: `fortnite-batman`, `iron-man`, `shrek`
- Models converted: `3/3`
- Models validated: `3/3`
- Models browser-smoke pass: `3/3`
- Models failed: `0`

## Per-Model Summary

| Model | Conversion | VRM Size | Bones | VRMC | Validation | Browser Smoke |
|-------|-----------|----------|-------|------|-----------|---------------|
| fortnite-batman | pass | 16.0 MB | 24 | ✓ | pass | pass |
| iron-man | pass | 841 KB | 21 | ✓ | pass | pass |
| shrek | pass | 4.1 MB | 20 | ✓ | pass | pass |

## Playwright Tests

- Total: `7`
- Passed: `7`
- Failed: `0`
- Duration: `25.5s`

## Safety Invariants

- npm build: `pass`
- Generated VRMs staged: `no`
- Public UI promotion: `no`
- Normal avatar cycling unchanged: `yes`
- Generated VRMs ignored by git: `yes`

## Notes

All three Batch A models converted cleanly from their source .blend/.fbx files through the Blender VRM export pipeline. All three produced valid VRMs with VRMC_vrm humanoid extensions and loaded successfully in the browser via the smoke test query parameter path.
