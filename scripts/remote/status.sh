#!/usr/bin/env bash
set -euo pipefail

echo "==> Remote Status"
echo "Active branch: $(git branch --show-current)"
echo "Current commit: $(git rev-parse HEAD)"
echo "Working-tree state:"
git status --short

echo ""
echo "Process status:"
if tmux has-session -t posepuppet-dev 2>/dev/null; then
  echo "tmux posepuppet-dev: RUNNING"
else
  echo "tmux posepuppet-dev: STOPPED"
fi

echo ""
echo "Listening ports:"
ss -ltnp 2>/dev/null | grep -E ':5173\b' || echo "None on 5173"

echo ""
echo "Recent logs (last 10 lines):"
if [ -f ~/.local/state/posepuppet/logs/arcade.log ]; then
  tail -n 10 ~/.local/state/posepuppet/logs/arcade.log
else
  echo "No log file found."
fi

echo ""
echo "Fixture preparation status:"
ls -la .local/cache/fake-camera/ 2>/dev/null || echo "No fake-camera fixtures generated."
