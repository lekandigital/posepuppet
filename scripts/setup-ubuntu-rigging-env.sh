#!/usr/bin/env bash
set -Eeuo pipefail

REPO_DIR="${POSEPUPPET_REPO:-/home/o/Dev/posepuppet}"
MODELS_DIR="${POSEPUPPET_MODELS:-/home/o/posepuppet-assets/ModelsForAnimation}"
WOODY_DIR="${POSEPUPPET_WOODY:-/home/o/posepuppet-assets/woody}"
WORK_DIR="${POSEPUPPET_WORK:-/home/o/posepuppet-working}"
TOOLS_DIR="${POSEPUPPET_TOOLS:-/home/o/posepuppet-tools}"
LOG_DIR="$WORK_DIR/logs"
NODE_VERSION="${POSEPUPPET_NODE_VERSION:-22}"
NVM_VERSION="${POSEPUPPET_NVM_VERSION:-v0.40.5}"
BLENDER_VERSION="${POSEPUPPET_BLENDER_VERSION:-5.1.2}"
BLENDER_SERIES="${POSEPUPPET_BLENDER_SERIES:-5.1}"
VRM_ADDON_TAG="${POSEPUPPET_VRM_ADDON_TAG:-v4.2.3}"
RUN_TESTS="${POSEPUPPET_RUN_TESTS:-1}"
ALLOW_INTERACTIVE_SUDO="${POSEPUPPET_ALLOW_INTERACTIVE_SUDO:-0}"

APT_PACKAGES=(
  build-essential git git-lfs curl wget unzip p7zip-full rsync jq
  ca-certificates gnupg lsb-release software-properties-common pkg-config
  python3 python3-pip python3-venv python3-dev xvfb mesa-utils
  libgl1 libgl1-mesa-dri libglu1-mesa libxi6 libxrender1 libxrandr2
  libxfixes3 libxcursor1 libxinerama1 libxxf86vm1 libxkbcommon0
  libsm6 libice6 libfontconfig1 libfreetype6 ffmpeg imagemagick
)

PYTHON_PACKAGES=(
  numpy pillow jsonschema rich tqdm trimesh pygltflib
)

mkdir -p "$LOG_DIR" "$TOOLS_DIR" "$MODELS_DIR" "$WOODY_DIR" \
  "$WORK_DIR/model-working" "$WORK_DIR/generated-vrms"

STATUS_FILE="$LOG_DIR/setup-status.tsv"
BLOCKERS_FILE="$LOG_DIR/setup-blockers.txt"
: > "$STATUS_FILE"
: > "$BLOCKERS_FILE"

log() {
  printf '[posepuppet-setup] %s\n' "$*"
}

blocker() {
  printf '%s\n' "$*" | tee -a "$BLOCKERS_FILE" >&2
}

record_status() {
  printf '%s\t%s\n' "$1" "$2" >> "$STATUS_FILE"
}

run_check() {
  local key="$1"
  local logfile="$2"
  shift 2
  {
    printf '=== %s ===\n' "$key"
    date
    printf '$'
    printf ' %q' "$@"
    printf '\n'
  } | tee "$logfile"
  set +e
  "$@" 2>&1 | tee -a "$logfile"
  local status=${PIPESTATUS[0]}
  set -e
  if [ "$status" -eq 0 ]; then
    record_status "$key" "pass"
  else
    record_status "$key" "fail"
  fi
  return 0
}

install_base_packages() {
  log "Checking sudo availability for base Ubuntu packages"
  if sudo -n true 2>/dev/null; then
    log "Installing base Ubuntu packages with non-interactive sudo"
    sudo apt update
    sudo apt install -y "${APT_PACKAGES[@]}"
    record_status "base_packages" "pass"
    return 0
  fi

  if [ "$ALLOW_INTERACTIVE_SUDO" = "1" ]; then
    log "Installing base Ubuntu packages with interactive sudo"
    sudo apt update
    sudo apt install -y "${APT_PACKAGES[@]}"
    record_status "base_packages" "pass"
    return 0
  fi

  record_status "base_packages" "skipped"
  blocker "Base apt package install skipped: sudo is not passwordless. Re-run with POSEPUPPET_ALLOW_INTERACTIVE_SUDO=1 from an interactive shell, or run the apt command from docs/ubuntu-rigging-server-setup.md."
}

load_nvm() {
  export NVM_DIR="$HOME/.nvm"
  if [ ! -d "$NVM_DIR" ]; then
    log "Installing nvm $NVM_VERSION"
    curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/$NVM_VERSION/install.sh" | bash
  fi
  # shellcheck source=/dev/null
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
}

repo_node_version() {
  if [ -f "$REPO_DIR/.nvmrc" ]; then
    tr -d '[:space:]' < "$REPO_DIR/.nvmrc"
    return 0
  fi
  printf '%s\n' "$NODE_VERSION"
}

ensure_repo_node() {
  load_nvm
  local version
  version="$(repo_node_version)"
  if ! command -v nvm >/dev/null 2>&1; then
    blocker "nvm is not available after sourcing $NVM_DIR/nvm.sh; cannot guarantee Node $version for noninteractive npm commands."
    record_status "node" "fail"
    return 1
  fi
  nvm install "$version"
  nvm use "$version"
}

install_node() {
  local version
  version="$(repo_node_version)"
  log "Installing/using Node $version via nvm"
  ensure_repo_node
  nvm alias default "$version"
  node --version | tee "$LOG_DIR/node-version.txt"
  npm --version | tee -a "$LOG_DIR/node-version.txt"
  record_status "node" "pass"
}

install_blender_user_local() {
  local blender_dir="$TOOLS_DIR/blender-versions"
  local tarball="blender-${BLENDER_VERSION}-linux-x64.tar.xz"
  local url="https://download.blender.org/release/Blender${BLENDER_SERIES}/${tarball}"
  mkdir -p "$blender_dir" "$HOME/.local/bin"

  if [ ! -f "$blender_dir/$tarball" ]; then
    log "Downloading Blender $BLENDER_VERSION from official Blender release storage"
    wget -O "$blender_dir/$tarball" "$url"
  fi
  if [ ! -x "$blender_dir/blender-${BLENDER_VERSION}-linux-x64/blender" ]; then
    tar -xf "$blender_dir/$tarball" -C "$blender_dir"
  fi
  ln -sfn "$blender_dir/blender-${BLENDER_VERSION}-linux-x64" "$TOOLS_DIR/blender"
  ln -sfn "$TOOLS_DIR/blender/blender" "$HOME/.local/bin/blender"
}

resolve_blender() {
  export PATH="$HOME/.local/bin:$PATH"
  if command -v blender >/dev/null 2>&1; then
    BLENDER_BIN="$(command -v blender)"
  else
    install_blender_user_local
    BLENDER_BIN="$HOME/.local/bin/blender"
  fi
  export BLENDER_BIN
  run_check "blender_headless" "$LOG_DIR/blender-headless.txt" \
    "$BLENDER_BIN" -b --python-expr "import bpy; print('Blender Python OK', bpy.app.version_string)"
}

install_vrm_addon() {
  export PATH="$HOME/.local/bin:$PATH"
  local vrm_repo="$TOOLS_DIR/VRM-Addon-for-Blender"
  local blender_version
  blender_version="$("$BLENDER_BIN" -b --python-expr 'import bpy; print("%d.%d" % bpy.app.version[:2])' | awk '/^[0-9]+\.[0-9]+$/ {print; exit}')"
  local ext_dir="$HOME/.config/blender/$blender_version/extensions/user_default"

  if "$BLENDER_BIN" -b --python-expr "import bpy; raise SystemExit(0 if 'vrm' in dir(bpy.ops.export_scene) else 1)" >/dev/null 2>&1; then
    record_status "vrm_addon" "pass"
    return 0
  fi

  log "Installing VRM Add-on for Blender $VRM_ADDON_TAG"
  if [ ! -d "$vrm_repo/.git" ]; then
    git clone --depth 1 --branch "$VRM_ADDON_TAG" \
      https://github.com/saturday06/VRM-Addon-for-Blender.git "$vrm_repo"
  else
    git -C "$vrm_repo" fetch --tags --depth 1 origin "$VRM_ADDON_TAG" || true
    git -C "$vrm_repo" checkout "$VRM_ADDON_TAG"
  fi

  mkdir -p "$ext_dir"
  ln -sfn "$vrm_repo/src/io_scene_vrm" "$ext_dir/vrm"

  run_check "vrm_addon" "$LOG_DIR/blender-vrm-addon-check.txt" \
    "$BLENDER_BIN" -b --python-expr "import addon_utils, bpy; mods=[m.__name__ for m in addon_utils.modules() if 'vrm' in m.__name__.lower()]; print('vrm modules', mods); [bpy.ops.preferences.addon_enable(module=m) for m in mods]; bpy.ops.wm.save_userpref(); print('export_scene attrs containing vrm=', [n for n in dir(bpy.ops.export_scene) if 'vrm' in n.lower()]); raise SystemExit(0 if 'vrm' in dir(bpy.ops.export_scene) else 1)"
}

create_links() {
  mkdir -p "$MODELS_DIR" "$WOODY_DIR" "$WORK_DIR/model-working" \
    "$WORK_DIR/generated-vrms" "$LOG_DIR" "$TOOLS_DIR"
  if [ -d "$REPO_DIR" ]; then
    ln -sfn "$MODELS_DIR" "$REPO_DIR/ModelsForAnimation"
    ln -sfn "$MODELS_DIR" "$REPO_DIR/models_for_animation"
  fi
  record_status "paths" "pass"
}

setup_python() {
  cd "$REPO_DIR"
  python3 -m venv .venv
  # shellcheck source=/dev/null
  . .venv/bin/activate
  python -m pip install --upgrade pip wheel setuptools
  python -m pip install "${PYTHON_PACKAGES[@]}"
  run_check "python_imports" "$LOG_DIR/python-imports.txt" python - <<'PY'
for name in ["numpy", "PIL", "jsonschema", "trimesh", "pygltflib"]:
    __import__(name)
    print("OK", name)
PY
}

run_repo_checks() {
  cd "$REPO_DIR"
  ensure_repo_node
  # shellcheck source=/dev/null
  [ -f .venv/bin/activate ] && . .venv/bin/activate
  run_check "npm_install" "$LOG_DIR/npm-install.txt" npm install
  run_check "npm_build" "$LOG_DIR/npm-build.txt" npm run build
  run_check "audit_self_test" "$LOG_DIR/audit-self-test.txt" python3 tools/audit_model.py --self-test
  if [ "$RUN_TESTS" = "1" ]; then
    run_check "npm_test" "$LOG_DIR/npm-test.txt" npm test
  else
    record_status "npm_test" "not_attempted"
  fi
  if [ -f tools/validate_model_audits.py ]; then
    run_check "audit_validation" "$LOG_DIR/validate-model-audits.txt" python3 tools/validate_model_audits.py model-audits
  else
    record_status "audit_validation" "missing"
  fi
  if [ -f tools/check_audit_staleness.py ]; then
    run_check "audit_staleness" "$LOG_DIR/check-audit-staleness.txt" python3 tools/check_audit_staleness.py ModelsForAnimation model-audits --warn-only
  else
    record_status "audit_staleness" "missing"
  fi
  if [ -f tools/rig_prep_all_models.py ]; then
    run_check "rig_prep_dry_run" "$LOG_DIR/rig-prep-dry-run.txt" python3 tools/rig_prep_all_models.py --dry-run
  else
    record_status "rig_prep_dry_run" "missing"
    blocker "Missing tools/rig_prep_all_models.py; dry-run rig prep not attempted."
  fi
  if [ -f tools/convert_all_avatars_to_vrm.py ]; then
    run_check "convert_dry_run" "$LOG_DIR/convert-all-avatars-to-vrm-dry-run.txt" python3 tools/convert_all_avatars_to_vrm.py --dry-run
  else
    record_status "convert_dry_run" "missing"
    blocker "Missing tools/convert_all_avatars_to_vrm.py; conversion dry run not attempted."
  fi
}

write_report() {
  cd "$REPO_DIR"
  mkdir -p model-audits
  python3 - "$STATUS_FILE" "$BLOCKERS_FILE" <<'PY'
import json
import os
import platform
import subprocess
import sys
from pathlib import Path

status_file = Path(sys.argv[1])
blockers_file = Path(sys.argv[2])
repo = Path(os.environ.get("POSEPUPPET_REPO", "/home/o/Dev/posepuppet"))

def run(cmd):
    try:
        return subprocess.check_output(cmd, text=True, stderr=subprocess.STDOUT).strip()
    except Exception:
        return ""

statuses = {}
if status_file.exists():
    for line in status_file.read_text().splitlines():
        if "\t" in line:
            key, value = line.split("\t", 1)
            statuses[key] = value

blockers = []
if blockers_file.exists():
    blockers = [line for line in blockers_file.read_text().splitlines() if line.strip()]

nvidia = run(["nvidia-smi", "--query-gpu=name,driver_version,memory.total", "--format=csv,noheader"])
cuda = run(["bash", "-lc", "nvidia-smi | sed -n '3p'"])
report = {
    "server": {
        "host": "192.168.86.152",
        "user": run(["whoami"]),
        "os": run(["bash", "-lc", ". /etc/os-release && echo \"$PRETTY_NAME\""]),
        "kernel": platform.release(),
        "cpu": run(["bash", "-lc", "lscpu | awk -F: '/Model name/ {gsub(/^[ \\t]+/, \"\", $2); print $2; exit}'"]),
        "gpu": nvidia.split(",")[0].strip() if nvidia else "",
        "nvidia_driver": nvidia.split(",")[1].strip() if "," in nvidia else "",
        "cuda_visible": bool(run(["bash", "-lc", "nvidia-smi >/dev/null 2>&1 && echo yes"])),
        "cuda_runtime_from_nvidia_smi": cuda,
    },
    "tools": {
        "python": run(["python3", "--version"]),
        "node": run(["bash", "-lc", "export NVM_DIR=\"$HOME/.nvm\"; [ -s \"$NVM_DIR/nvm.sh\" ] && . \"$NVM_DIR/nvm.sh\"; node --version"]),
        "npm": run(["bash", "-lc", "export NVM_DIR=\"$HOME/.nvm\"; [ -s \"$NVM_DIR/nvm.sh\" ] && . \"$NVM_DIR/nvm.sh\"; npm --version"]),
        "blender": run(["bash", "-lc", "PATH=\"$HOME/.local/bin:$PATH\" blender --version | head -n 1"]),
        "vrm_addon": "available" if statuses.get("vrm_addon") == "pass" else "missing",
        "git": run(["git", "--version"]),
        "ffmpeg": run(["bash", "-lc", "ffmpeg -version 2>/dev/null | head -n 1"]),
    },
    "paths": {
        "repo": str(repo),
        "models": "/home/o/posepuppet-assets/ModelsForAnimation",
        "woody": "/home/o/posepuppet-assets/woody",
        "working": "/home/o/posepuppet-working",
    },
    "checks": {
        "npm_install": statuses.get("npm_install", "not_attempted"),
        "npm_build": statuses.get("npm_build", "not_attempted"),
        "npm_test": statuses.get("npm_test", "not_attempted"),
        "audit_self_test": statuses.get("audit_self_test", "not_attempted"),
        "audit_validation": statuses.get("audit_validation", "not_attempted"),
        "audit_staleness": statuses.get("audit_staleness", "not_attempted"),
        "blender_headless": statuses.get("blender_headless", "not_attempted"),
        "vrm_export_possible": "pass" if statuses.get("vrm_addon") == "pass" else "unknown",
        "rig_prep_dry_run": statuses.get("rig_prep_dry_run", "not_attempted"),
        "convert_dry_run": statuses.get("convert_dry_run", "not_attempted"),
    },
    "blockers": blockers,
    "next_commands": [
        "source ~/posepuppet-working/posepuppet-env.sh",
        "python3 tools/audit_model.py --self-test",
        "python3 tools/validate_model_audits.py model-audits",
        "python3 tools/check_audit_staleness.py ModelsForAnimation model-audits --warn-only",
    ],
}

(repo / "model-audits" / "ubuntu-setup-report.json").write_text(json.dumps(report, indent=2) + "\n")
lines = [
    "# Ubuntu Setup Report",
    "",
    f"- Host: `{report['server']['user']}@{report['server']['host']}`",
    f"- OS: `{report['server']['os']}`",
    f"- Kernel: `{report['server']['kernel']}`",
    f"- CPU: `{report['server']['cpu']}`",
    f"- GPU: `{report['server']['gpu']}`",
    f"- NVIDIA driver: `{report['server']['nvidia_driver']}`",
    f"- Blender: `{report['tools']['blender']}`",
    f"- VRM add-on: `{report['tools']['vrm_addon']}`",
    f"- Node/npm: `{report['tools']['node']}` / `{report['tools']['npm']}`",
    f"- Python: `{report['tools']['python']}`",
    "",
    "## Checks",
]
for key, value in report["checks"].items():
    lines.append(f"- `{key}`: `{value}`")
lines.extend(["", "## Blockers"])
if blockers:
    lines.extend(f"- {item}" for item in blockers)
else:
    lines.append("- None")
lines.extend(["", "## Next Commands"])
lines.extend(f"- `{cmd}`" for cmd in report["next_commands"])
(repo / "model-audits" / "ubuntu-setup-report.md").write_text("\n".join(lines) + "\n")
PY
}

main() {
  if [ ! -d "$REPO_DIR" ]; then
    blocker "Repo is missing at $REPO_DIR. Sync or clone it before running this setup script."
    exit 1
  fi
  install_base_packages
  create_links
  install_node
  resolve_blender
  install_vrm_addon
  setup_python
  run_repo_checks
  write_report
  log "Done. Reports written to $REPO_DIR/model-audits/ubuntu-setup-report.{md,json}"
}

main "$@"
