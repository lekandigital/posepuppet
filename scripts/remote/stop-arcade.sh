#!/usr/bin/env bash
set -euo pipefail
[ -s "$HOME/.nvm/nvm.sh" ] && \. "$HOME/.nvm/nvm.sh"

echo "==> Remote Stop Arcade"

if tmux has-session -t posepuppet-dev 2>/dev/null; then
  echo "Stopping tmux session posepuppet-dev gracefully..."
  tmux send-keys -t posepuppet-dev C-c
  sleep 2
  tmux kill-session -t posepuppet-dev 2>/dev/null || true
  echo "Session killed."
else
  echo "Session posepuppet-dev is not running."
fi

for i in {1..5}; do
  if ! ss -ltn 2>/dev/null | grep -q ':5173\b'; then
    echo "Port 5173 is clear."
    exit 0
  fi
  sleep 1
done

echo "Warning: Port 5173 is still in use."
