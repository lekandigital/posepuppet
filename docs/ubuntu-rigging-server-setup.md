# Ubuntu Rigging Server Setup

This server is for PosePuppet model audit, rig-prep, and VRM-conversion experiments. It is not the place to enable unfinished avatars in the app UI, commit source assets, or commit generated VRMs.

## SSH

```sh
ssh -i ~/.ssh/pinn_rtx3090 o@192.168.86.152
```

## Folder Layout

```txt
/home/o/Dev/posepuppet
/home/o/posepuppet-assets/ModelsForAnimation
/home/o/posepuppet-assets/woody
/home/o/posepuppet-working/model-working
/home/o/posepuppet-working/generated-vrms
/home/o/posepuppet-working/logs
/home/o/posepuppet-tools
```

The repo uses symlinks for model inputs:

```sh
ln -sfn /home/o/posepuppet-assets/ModelsForAnimation /home/o/Dev/posepuppet/ModelsForAnimation
ln -sfn /home/o/posepuppet-assets/ModelsForAnimation /home/o/Dev/posepuppet/models_for_animation
```

## Asset Sync From Mac

Sync the repo without dependency/build folders:

```sh
rsync -azP \
  --exclude 'node_modules/' \
  --exclude 'dist/' \
  --exclude 'test-results/' \
  --exclude 'playwright-report/' \
  --exclude 'fixtures/' \
  --exclude 'media/' \
  --exclude 'models_for_animation/' \
  --exclude 'ModelsForAnimation/' \
  --exclude '.DS_Store' \
  -e "ssh -i ~/.ssh/pinn_rtx3090" \
  /Users/lekan/Dev/posepuppet/ \
  o@192.168.86.152:/home/o/Dev/posepuppet/
```

Sync model sources outside the repo:

```sh
rsync -azP \
  --exclude '.DS_Store' \
  -e "ssh -i ~/.ssh/pinn_rtx3090" \
  /Users/lekan/Dev/posepuppet/models_for_animation/ \
  o@192.168.86.152:/home/o/posepuppet-assets/ModelsForAnimation/
```

Sync Woody outside the repo:

```sh
rsync -azP \
  --exclude '.DS_Store' \
  -e "ssh -i ~/.ssh/pinn_rtx3090" \
  /Users/lekan/Downloads/woody/ \
  o@192.168.86.152:/home/o/posepuppet-assets/woody/
```

## Base Ubuntu Packages

The setup script installs these when passwordless sudo is available. If sudo requires a password, run this manually on the server:

```sh
sudo apt update
sudo apt install -y \
  build-essential git git-lfs curl wget unzip p7zip-full rsync jq \
  ca-certificates gnupg lsb-release software-properties-common pkg-config \
  python3 python3-pip python3-venv python3-dev xvfb mesa-utils \
  libgl1 libgl1-mesa-dri libglu1-mesa libxi6 libxrender1 libxrandr2 \
  libxfixes3 libxcursor1 libxinerama1 libxxf86vm1 libxkbcommon0 \
  libsm6 libice6 libfontconfig1 libfreetype6 ffmpeg imagemagick
```

These packages support native builds, asset transfer, archive inspection, Python venvs, Blender headless dependencies, audit media generation, and Playwright/browser smoke tests.

## Run Setup

```sh
cd /home/o/Dev/posepuppet
chmod +x scripts/setup-ubuntu-rigging-env.sh
./scripts/setup-ubuntu-rigging-env.sh
```

The repo expects Node 22 via `nvm` in both interactive and noninteractive shells:

```sh
cd /home/o/Dev/posepuppet
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 22
node --version
npm --version
npm run build
```

If sudo is needed interactively:

```sh
POSEPUPPET_ALLOW_INTERACTIVE_SUDO=1 ./scripts/setup-ubuntu-rigging-env.sh
```

The script writes logs to:

```txt
/home/o/posepuppet-working/logs
```

And reports to:

```txt
model-audits/ubuntu-setup-report.md
model-audits/ubuntu-setup-report.json
```

## Verify Blender

```sh
export PATH="$HOME/.local/bin:$PATH"
blender --version
blender -b --python-expr "import bpy; print('Blender Python OK', bpy.app.version_string)"
```

## Verify VRM Export

```sh
blender -b --python-expr "import bpy; print([name for name in dir(bpy.ops.export_scene) if 'vrm' in name.lower()])"
```

Expected output includes `vrm`. If it does not, VRM conversion should be marked `not_attempted` or `unknown`.

## Run Audit Checks

```sh
cd /home/o/Dev/posepuppet
source .venv/bin/activate
python3 tools/audit_model.py --self-test
python3 tools/generate_model_audit_v2.py model-audits
python3 tools/validate_model_audits.py model-audits
python3 tools/check_audit_staleness.py ModelsForAnimation model-audits --warn-only
```

Run one Blender-backed model inspection:

```sh
python3 tools/audit_models.py ModelsForAnimation model-audits \
  --blender /home/o/.local/bin/blender \
  --woody-dir /home/o/posepuppet-assets/woody \
  --limit 1 \
  --timeout 300
```

## Dry Runs

Only run these if the scripts exist:

```sh
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 22
npm run build
python3 tools/rig_prep_all_models.py --dry-run
python3 tools/convert_all_avatars_to_vrm.py --dry-run
```

Generated working files should go under:

```txt
/home/o/posepuppet-working/model-working
/home/o/posepuppet-working/generated-vrms
```

## What Not To Commit

Do not commit source assets, generated VRMs, generated GLBs/FBXs, `.blend` files, screenshots, local fixture media, `node_modules`, `.venv`, or Playwright reports. Check first:

```sh
git status --short
git status --short --ignored ModelsForAnimation models_for_animation public/avatars .venv
```

## Common Failures

- `sudo: a password is required`: run the apt command manually or re-run setup with `POSEPUPPET_ALLOW_INTERACTIVE_SUDO=1` in an interactive SSH shell.
- `blender: command not found`: add `~/.local/bin` to `PATH` or run `/home/o/posepuppet-tools/blender/blender`.
- No `vrm` export operator: re-run the setup script and inspect `~/posepuppet-working/logs/blender-vrm-addon-check.txt`.
- Playwright browser tests time out on video readiness: verify fake camera/browser dependencies first; this does not invalidate Blender audit setup by itself.
- Missing `rig_prep_all_models.py` or `convert_all_avatars_to_vrm.py`: record dry-run status as `missing` and do not claim conversion readiness.
