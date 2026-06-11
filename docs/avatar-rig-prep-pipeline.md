# Avatar Rig Prep Pipeline

This pipeline is for controlled source inspection and candidate VRM generation outside the public app UI.

## Node 22 for Noninteractive Shells

Always source `nvm` before repo `npm` commands on the Ubuntu rigging server:

```sh
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 22
npm run build
```

The repo pins the expected runtime in `.nvmrc`.

## Safe Output Rules

- Keep original source assets in the external model storage area.
- Write working extracts under `~/posepuppet-working/model-working`.
- Write generated candidate VRMs under `~/posepuppet-working/generated-vrms`.
- Do not write candidate VRMs into `public/avatars/` unless the user explicitly approves promotion.
- Do not claim runtime-ready until a browser load smoke test passes.

## Narrow-Scope Commands

Dry-run one model:

```sh
python3 tools/rig_prep_model.py --slug darth-vader --dry-run
python3 tools/convert_avatar_to_vrm.py --slug darth-vader --dry-run
```

Inspect one model in Blender:

```sh
python3 tools/rig_prep_model.py --slug darth-vader --mode inspect
```

Attempt one candidate conversion:

```sh
python3 tools/convert_avatar_to_vrm.py --slug darth-vader --attempt
python3 tools/validate_vrm_candidate.py --slug darth-vader
```
