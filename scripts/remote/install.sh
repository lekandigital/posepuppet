#!/usr/bin/env bash
# PosePuppet Remote Install — clean dependency installation.
set -euo pipefail
[ -s "$HOME/.nvm/nvm.sh" ] && \. "$HOME/.nvm/nvm.sh"

echo "==> PosePuppet Remote Install"

# Verify we're in the right place
if [ ! -f "package.json" ]; then
  echo "ERROR: package.json not found. Are you in the posepuppet directory?"
  exit 1
fi

echo "Node: $(node --version)"
echo "npm: $(npm --version)"
echo ""

# Root dependencies
echo "Installing root dependencies (npm ci)..."
npm ci
echo "Root dependencies installed."
echo ""

# Flight dependencies
if [ -d "apps/flight" ] && [ -f "apps/flight/package.json" ]; then
  echo "Installing apps/flight dependencies..."
  npm --prefix apps/flight ci
  echo "Flight dependencies installed."
else
  echo "apps/flight not found, skipping."
fi
echo ""

# Playwright browsers (Chromium only)
echo "Installing Playwright browsers (Chromium)..."
npx playwright install chromium
echo "Playwright Chromium installed."
echo ""

# System dependencies for Playwright
echo "Checking Playwright system dependencies..."
if command -v sudo >/dev/null && sudo -n true 2>/dev/null; then
  echo "Installing system dependencies for Chromium..."
  npx playwright install-deps chromium
  echo "System dependencies installed."
else
  echo "NOTE: sudo unavailable or requires password."
  echo "If Playwright fails, run manually: sudo npx playwright install-deps chromium"
fi
echo ""

echo "Install complete."
