# Darth Vader PosePuppet Runtime Smoke Test

- Slug: `darth-vader`
- Candidate VRM: `/home/o/posepuppet-working/generated-vrms/darth-vader.vrm` (16 MB)
- Served URL: `/avatars/generated/darth-vader.vrm`
- Browser load attempted: **yes**
- Browser load status: ✅ **pass**
- Runtime mode: `generated-avatar-query-param`
- Test URL: `/?generatedAvatar=darth-vader&smoke=avatar-load-only`
- Added to public UI: **no**
- Unsupported controls disabled: **yes** (face_touch=deferred, facial_expressions=deferred)
- Warnings visible: **yes** (`[experimental]` label)
- window.__PP.avatarStatus: `loaded`
- Console errors: **none**

## Notes

- Fingers enabled per adapter spec (full_finger_retargeting) but retargeting not yet implemented
- Face-touch deferred — IK not yet implemented
- 16MB VRM — performance=heavy, may need LOD or decimation for mobile
- Not yet `site_ready` — requires public UI cycling test and unsupported control confirmation
