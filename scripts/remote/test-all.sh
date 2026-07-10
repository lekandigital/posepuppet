#!/usr/bin/env bash
set -euo pipefail
[ -s "$HOME/.nvm/nvm.sh" ] && \. "$HOME/.nvm/nvm.sh"

echo "==> Remote Test All"

echo "Checking package lock..."
npm ci --prefer-offline --no-audit

echo "Running type check..."
npm run build

echo "Pre-bundling dependencies to prevent Vite 504 timeouts..."
npx vite optimize

echo "Running tests (Playwright)..."
if [ -f "playwright.config.ts" ]; then
  if command -v xvfb-run >/dev/null 2>&1; then
    USE_SWIFTSHADER=1 xvfb-run --auto-servernum --server-args="-screen 0 1920x1080x24" npm run test || echo "Playwright tests returned failure, but continuing script to gather all info."
  else
    USE_SWIFTSHADER=1 npm run test || echo "Playwright tests returned failure, but continuing script to gather all info."
  fi
fi

echo "Running model eval..."
if [ -f "eval/run.mjs" ]; then
  if command -v xvfb-run >/dev/null 2>&1; then
    USE_SWIFTSHADER=1 xvfb-run --auto-servernum --server-args="-screen 0 1920x1080x24" npm run eval || echo "Eval script returned failure."
  else
    USE_SWIFTSHADER=1 npm run eval || echo "Eval script returned failure."
  fi
fi

echo "Running python audits (if any)..."
if grep -q "audit:all" package.json; then
  if command -v blender >/dev/null 2>&1 || [ -d "/Applications/Blender.app" ]; then
    npm run audit:all || echo "Python audits failed."
  else
    echo "Blender not found, running safe audits only..."
    npm run audit:self-test || echo "Self-test failed."
    npm run audit:validate || echo "Validate failed."
  fi
fi

echo "Checking for uncommitted changes (git diff --check)..."
git diff --check

echo "Remote tests complete."
