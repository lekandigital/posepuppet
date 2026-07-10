#!/usr/bin/env bash
set -euo pipefail

echo "==> Remote Stop Arcade"

if tmux has-session -t posepuppet-dev 2>/dev/null; then
  echo "Stopping tmux session posepuppet-dev..."
  tmux kill-session -t posepuppet-dev
  echo "Session killed."
else
  echo "Session posepuppet-dev is not running."
fi

if ss -ltnp 2>/dev/null | grep -q ':5173\b'; then
  echo "Warning: Port 5173 is still in use by an unknown process."
else
  echo "Port 5173 is clear."
fi
