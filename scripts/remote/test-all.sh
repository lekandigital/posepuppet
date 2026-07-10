#!/usr/bin/env bash
set -euo pipefail
[ -s "$HOME/.nvm/nvm.sh" ] && \. "$HOME/.nvm/nvm.sh"

echo "==> Remote Test All"

echo "Checking package lock..."
npm ci --prefer-offline --no-audit

echo "Running type check..."
npm run build

echo "Running tests (Playwright)..."
if [ -f "playwright.config.ts" ]; then
  npm run test || echo "Playwright tests returned failure, but continuing script to gather all info."
fi

echo "Running model eval..."
if [ -f "eval/run.mjs" ]; then
  npm run eval || echo "Eval script returned failure."
fi

echo "Running python audits (if any)..."
if grep -q "audit:all" package.json; then
  npm run audit:all || echo "Python audits failed."
fi

echo "Checking for uncommitted changes (git diff --check)..."
git diff --check

echo "Remote tests complete."
