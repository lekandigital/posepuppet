#!/usr/bin/env bash
set -euo pipefail
[ -s "$HOME/.nvm/nvm.sh" ] && \. "$HOME/.nvm/nvm.sh"

echo "==> Remote Install"
if [ ! -f "package.json" ]; then
  echo "Error: package.json not found."
  exit 1
fi

echo "Installing npm dependencies (clean install)..."
npm ci

if [ -d "apps/flight" ]; then
  echo "Installing apps/flight dependencies..."
  npm --prefix apps/flight ci
fi

echo "Installing Playwright browsers (Chromium only)..."
npx playwright install chromium

echo "Attempting to install Playwright system dependencies..."
if command -v sudo >/dev/null && sudo -n true 2>/dev/null; then
  npx playwright install-deps chromium || echo "Warning: Could not install system deps automatically."
else
  echo "Sudo unavailable or requires password. Skipping system deps installation."
  echo "If Playwright fails, run 'npx playwright install-deps' manually."
fi

echo "Install complete."
