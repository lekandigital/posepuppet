# Runtime Smoke Test Report

## Summary

| Tests | Status | Duration |
|-------|--------|----------|
| 4/4 passed | ✅ all pass | 21.5s |

## Test Matrix

| Test | Status | Notes |
|------|--------|-------|
| Woody candidate VRM browser load | ✅ pass | avatarStatus=loaded |
| Darth Vader candidate VRM browser load | ✅ pass | avatarStatus=loaded |
| Missing avatar controlled fallback | ✅ pass | avatarStatus=fallback, warning logged |
| Public UI cycling excludes generated avatars | ✅ pass | darth-vader not in cycle |

## Mode

`?generatedAvatar=<slug>&smoke=avatar-load-only` — skips camera/MediaPipe entirely.

## Command

```sh
npx playwright test tests/generated-avatar-load.spec.ts --reporter=line
```

## Invariants Confirmed

- No generated VRMs staged in git
- Public UI cycling unchanged (robot → astronaut → woody → robot)
- Generated avatars not visible in public UI
- Missing generated avatar fallback: no crash, avatarStatus='fallback'
