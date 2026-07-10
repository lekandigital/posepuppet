#!/usr/bin/env bash
set -euo pipefail

echo "==> Remote Doctor"
echo "Repository Path: $(pwd)"
git rev-parse --is-inside-work-tree >/dev/null || { echo "Not a git repository"; exit 1; }
echo "Git OK."

echo "Branch: $(git branch --show-current)"
git status --short

echo "Checking Node.js..."
if ! command -v node >/dev/null; then
  echo "Node.js is not installed."
  exit 1
fi
node --version

echo "Checking Package Manager (npm)..."
if ! command -v npm >/dev/null; then
  echo "npm is not installed."
  exit 1
fi
npm --version

echo "Checking System Tools..."
for tool in git tmux rsync jq curl ffmpeg ffprobe python3; do
  if command -v $tool >/dev/null; then
    echo "$tool: OK"
  else
    echo "$tool: MISSING"
  fi
done

echo "Checking Disk Space..."
df -h . | awk 'NR==2 {print "Available: "$4}'

echo "Checking Memory..."
free -h | awk '/^Mem:/ {print "Available: "$7}'

echo "Checking Playwright browsers..."
if [ -d "$HOME/.cache/ms-playwright" ]; then
  echo "Playwright cache exists."
else
  echo "Playwright cache MISSING (run install script)"
fi

echo "Checking ports..."
if ss -ltnp 2>/dev/null | grep -q ':5173\b'; then
  echo "Port 5173 is in use."
else
  echo "Port 5173 is free."
fi

echo "Doctor check complete."
