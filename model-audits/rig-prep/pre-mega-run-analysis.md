# Pre-Mega-Run Analysis

## Overview

This is a readiness analysis bridging existing model audits to browser/site readiness.
No batch conversion was performed. No future prompt file was created.

## Phase 0 — Ubuntu Canonical State

| Check | Status |
|-------|--------|
| Generated VRMs exist | ✅ woody 5.0M, darth-vader 16M |
| audit_model.py --self-test | ✅ 27 bone mappings passed |
| rig_prep_all_models.py --dry-run | ✅ pass (enumeration) |
| convert_all_avatars_to_vrm.py --dry-run | ✅ pass (enumeration) |
| npm run build | ✅ 905KB JS, 2.9KB CSS |
| Node.js | v22.22.3 |
| Python | 3.10.12 |
| Repo | /home/o/Dev/posepuppet |
| Models | /home/o/posepuppet-assets/ModelsForAnimation |
| Generated VRM dir | /home/o/posepuppet-working/generated-vrms |

## Browser Smoke Results

| Test | Status |
|------|--------|
| Woody candidate VRM loads | ✅ pass |
| Darth Vader candidate VRM loads | ✅ pass |
| Missing avatar falls back cleanly | ✅ pass |
| Public UI cycling unchanged | ✅ pass |
| Generated avatars excluded from cycling | ✅ pass |
| All 4 Playwright tests | ✅ pass (21.5s) |

## Generated Avatar Query Param

- URL format: `/?generatedAvatar=<slug>&smoke=avatar-load-only`
- Examples:
  - `/?generatedAvatar=woody&smoke=avatar-load-only`
  - `/?generatedAvatar=darth-vader&smoke=avatar-load-only`
  - `/?generatedAvatar=missing-test&smoke=avatar-load-only` (fallback test)
- Normal mode (no smoke param) also works but requires camera
- Generated avatars NOT in public UI cycling

## Architecture

- `src/rig/generatedAvatarRegistry.ts` — separate test-only registry
- `?generatedAvatar=` query param handled in main.ts
- `?smoke=avatar-load-only` skips camera/MediaPipe entirely
- `window.__PP.avatarStatus` reports: 'loading' | 'loaded' | 'fallback' | 'error'
- `public/avatars/generated/` — gitignored, symlinked to generated VRM dir

## Mac Path References

347 total Mac path references found across model-audits, tools, and package.json.
See `mac-path-cleanup-needed.md` for classification.

## Key Findings

1. **Both proven VRMs browser-load successfully** — woody and darth-vader pass full Playwright smoke
2. **Safe test-only path exists** — generated avatars load only via query param, never enter public UI
3. **Missing avatar fallback works** — controlled warning, no crash
4. **Unsupported controls remain disabled/experimental** — warning labels visible
5. **Build is clean** — TypeScript compiles, Vite builds without errors
