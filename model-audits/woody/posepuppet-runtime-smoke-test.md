# Woody PosePuppet Runtime Smoke Test

- Slug: `woody`
- Candidate VRM: `/home/o/posepuppet-working/generated-vrms/woody.vrm` (5.0 MB)
- Served URL: `/avatars/generated/woody.vrm`
- Browser load attempted: **yes**
- Browser load status: ✅ **pass**
- Runtime mode: `generated-avatar-query-param`
- Test URL: `/?generatedAvatar=woody&smoke=avatar-load-only`
- Added to public UI: **no**
- Unsupported controls disabled: **yes** (fingers=palm_only, face_touch=deferred)
- Warnings visible: **yes** (`[experimental]` label)
- window.__PP.avatarStatus: `loaded`
- Console errors: **none**

## Notes

- Fingers disabled — palm_only per adapter spec; finger bones not yet validated post-VRM
- Face-touch deferred — IK not yet implemented
- Not yet `site_ready` — requires public UI cycling test and unsupported control confirmation
