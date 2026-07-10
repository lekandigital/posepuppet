#!/usr/bin/env bash
set -euo pipefail
[ -s "$HOME/.nvm/nvm.sh" ] && \. "$HOME/.nvm/nvm.sh"

echo "==> Remote Start Arcade"
mkdir -p ~/.local/state/posepuppet/logs

if tmux has-session -t posepuppet-dev 2>/dev/null; then
  echo "Tmux session posepuppet-dev is already running."
  exit 1
fi

if ss -ltnp 2>/dev/null | grep -q ':5173\b'; then
  echo "Port 5173 is already in use by another process."
  exit 1
fi

echo "Starting arcade in tmux session posepuppet-dev..."
tmux new-session -d -s posepuppet-dev "npm run arcade > ~/.local/state/posepuppet/logs/arcade.log 2>&1"

echo "Waiting for server to listen on 5173..."
for i in {1..15}; do
  if ss -ltnp 2>/dev/null | grep -q '127\.0\.0\.1:5173\b'; then
    echo "Server is up and listening on 127.0.0.1:5173."
    exit 0
  fi
  sleep 1
done

echo "Server failed to bind to 127.0.0.1:5173 within 15 seconds."
echo "Check logs: cat ~/.local/state/posepuppet/logs/arcade.log"
exit 1
