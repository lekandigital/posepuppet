#!/usr/bin/env bash
# PosePuppet Remote Doctor — verifies toolchain, repository, and readiness.
# Exit nonzero if any required component is missing or broken.
set -euo pipefail
[ -s "$HOME/.nvm/nvm.sh" ] && \. "$HOME/.nvm/nvm.sh"

FAIL=0
check() {
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo "  ✓ $label"
  else
    echo "  ✗ $label"
    FAIL=1
  fi
}

echo "==> PosePuppet Remote Doctor"
echo ""

# --- Repository ---
echo "Repository"
echo "  Path: $(pwd)"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "  ✗ Not a git repository"; exit 1; }
echo "  Branch: $(git branch --show-current)"
echo "  HEAD: $(git rev-parse --short HEAD)"
DIRTY=$(git status --short)
if [ -n "$DIRTY" ]; then
  echo "  ⚠ Working tree is dirty:"
  echo "$DIRTY" | sed 's/^/    /'
else
  echo "  ✓ Working tree clean"
fi
echo ""

# --- Node.js ---
echo "Node.js"
check "node installed" command -v node
if command -v node >/dev/null 2>&1; then
  ACTUAL_NODE=$(node --version)
  echo "  Version: $ACTUAL_NODE"
  if [ -f ".nvmrc" ]; then
    EXPECTED=$(cat .nvmrc | tr -d '[:space:]')
    if [[ "$ACTUAL_NODE" == v${EXPECTED}.* ]] || [[ "$ACTUAL_NODE" == v${EXPECTED} ]]; then
      echo "  ✓ Matches .nvmrc ($EXPECTED)"
    else
      echo "  ⚠ .nvmrc expects $EXPECTED, got $ACTUAL_NODE"
    fi
  fi
fi
check "npm installed" command -v npm
if command -v npm >/dev/null 2>&1; then
  echo "  npm: $(npm --version)"
fi
echo ""

# --- System tools ---
echo "System tools"
for tool in git tmux rsync jq curl ffmpeg ffprobe python3 xvfb-run; do
  check "$tool" command -v "$tool"
done
echo ""

# --- Playwright ---
echo "Playwright"
if [ -d "$HOME/.cache/ms-playwright" ]; then
  echo "  ✓ Browser cache exists"
  # Show chromium revision if available
  CHROMIUM_DIR=$(find "$HOME/.cache/ms-playwright" -maxdepth 1 -name 'chromium-*' -type d 2>/dev/null | head -1)
  if [ -n "$CHROMIUM_DIR" ]; then
    echo "  Chromium: $(basename "$CHROMIUM_DIR")"
  fi
else
  echo "  ✗ Browser cache MISSING (run scripts/remote/install.sh)"
  FAIL=1
fi
if command -v npx >/dev/null 2>&1; then
  PW_VER=$(npx playwright --version 2>/dev/null || echo "unknown")
  echo "  Playwright version: $PW_VER"
fi
echo ""

# --- GPU ---
echo "GPU / Rendering"
if command -v nvidia-smi >/dev/null 2>&1; then
  echo "  $(nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader 2>/dev/null || echo 'nvidia-smi failed')"
else
  echo "  No NVIDIA GPU detected"
fi
echo "  Note: Playwright uses SwiftShader for functional testing, not GPU"
echo ""

# --- Disk & Memory ---
echo "Resources"
echo "  Disk: $(df -h . | awk 'NR==2 {print $4 " available of " $2}')"
echo "  Memory: $(free -h | awk '/^Mem:/ {print $7 " available of " $2}')"
echo ""

# --- Port ---
echo "Port 5173"
if ss -ltnp 2>/dev/null | grep -q ':5173\b'; then
  echo "  ⚠ Port 5173 is currently in use"
  ss -ltnp 2>/dev/null | grep ':5173\b' | sed 's/^/    /'
else
  echo "  ✓ Port 5173 is free"
fi
echo ""

# --- Dependencies ---
echo "Dependencies"
if [ -d "node_modules" ] && [ -f "package-lock.json" ]; then
  echo "  ✓ node_modules exists"
else
  echo "  ⚠ node_modules missing or incomplete (run scripts/remote/install.sh)"
fi
if [ -d "apps/flight/node_modules" ]; then
  echo "  ✓ apps/flight/node_modules exists"
else
  echo "  ⚠ apps/flight dependencies may need installation"
fi
echo ""

# --- Fixtures ---
echo "Fixtures"
if [ -d "fixtures" ]; then
  FIXTURE_COUNT=$(find fixtures -type f \( -name "*.mp4" -o -name "*.mov" \) 2>/dev/null | wc -l)
  echo "  $FIXTURE_COUNT video fixtures found"
else
  echo "  ⚠ No fixtures directory"
fi
if [ -d ".local/cache/fake-camera" ]; then
  Y4M_COUNT=$(find .local/cache/fake-camera -name "*.y4m" 2>/dev/null | wc -l)
  echo "  $Y4M_COUNT Y4M files in fake-camera cache"
else
  echo "  ⚠ No fake-camera cache (run scripts/remote/prepare-fixtures.sh)"
fi
echo ""

# --- Summary ---
if [ "$FAIL" -eq 0 ]; then
  echo "Doctor: ALL CHECKS PASSED"
  exit 0
else
  echo "Doctor: SOME CHECKS FAILED"
  exit 1
fi
