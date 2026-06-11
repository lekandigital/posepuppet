# Browser Generated Avatar Serving

## Method

Symlinks in `public/avatars/generated/` pointing to `/home/o/posepuppet-working/generated-vrms/`.

```sh
mkdir -p public/avatars/generated
ln -sfn /home/o/posepuppet-working/generated-vrms/woody.vrm public/avatars/generated/woody.vrm
ln -sfn /home/o/posepuppet-working/generated-vrms/darth-vader.vrm public/avatars/generated/darth-vader.vrm
```

## Git Safety

`.gitignore` includes:
```
public/avatars/generated/
public/avatars/generated/*.vrm
```

The directory itself is gitignored. No VRMs will ever be staged.

## URLs

| Avatar | Served URL | Source |
|--------|------------|--------|
| Woody | `/avatars/generated/woody.vrm` | `/home/o/posepuppet-working/generated-vrms/woody.vrm` (5.0 MB) |
| Darth Vader | `/avatars/generated/darth-vader.vrm` | `/home/o/posepuppet-working/generated-vrms/darth-vader.vrm` (16 MB) |

## Verification

Both URLs were successfully loaded by Playwright (21.5s total for 4 tests).

## Fallback

If symlinks fail, copy instead:
```sh
cp /home/o/posepuppet-working/generated-vrms/woody.vrm public/avatars/generated/woody.vrm
cp /home/o/posepuppet-working/generated-vrms/darth-vader.vrm public/avatars/generated/darth-vader.vrm
```
