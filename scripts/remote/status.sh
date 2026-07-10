#!/usr/bin/env bash
# PosePuppet Remote Status — shows current state without modifying anything.
set -euo pipefail

SESSION="posepuppet-dev"
STATE_DIR="$HOME/.local/state/posepuppet"
PID_FILE="$STATE_DIR/server.pid"
PORT=5173

echo "==> PosePuppet Remote Status"
echo ""

# --- Git ---
echo "Repository"
echo "  Branch: $(git branch --show-current)"
echo "  Commit: $(git rev-parse --short HEAD) $(git log -1 --format='%s')"
DIRTY=$(git status --short)
if [ -n "$DIRTY" ]; then
  echo "  Working tree: DIRTY"
  echo "$DIRTY" | sed 's/^/    /'
else
  echo "  Working tree: clean"
fi
echo ""

# --- tmux ---
echo "Process"
if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "  tmux $SESSION: RUNNING"
  PANE_PID=$(tmux list-panes -t "$SESSION" -F "#{pane_pid}" 2>/dev/null | head -n 1)
  echo "  Pane PID: ${PANE_PID:-unknown}"
  if [ -f "$PID_FILE" ]; then
    RECORDED_PID=$(cat "$PID_FILE")
    echo "  Recorded server PID: $RECORDED_PID"
    if kill -0 "$RECORDED_PID" 2>/dev/null; then
      echo "  Server process: ALIVE"
      CMD=$(ps -p "$RECORDED_PID" -o args= 2>/dev/null || echo "unknown")
      echo "  Command: $CMD"
    else
      echo "  Server process: DEAD (stale PID file)"
    fi
  fi
else
  echo "  tmux $SESSION: STOPPED"
fi
echo ""

# --- Listener ---
echo "Listener"
LISTENER=$(ss -ltnp 2>/dev/null | grep ":${PORT}\b" || true)
if [ -n "$LISTENER" ]; then
  echo "$LISTENER" | sed 's/^/  /'
  # Check for unsafe bindings
  if echo "$LISTENER" | grep -q '0\.0\.0\.0'; then
    echo "  ⚠ WARNING: Bound to 0.0.0.0 (LAN-accessible!)"
  fi
  if echo "$LISTENER" | grep -q '\[::\]'; then
    echo "  ⚠ WARNING: Bound to [::] (LAN-accessible!)"
  fi
  if echo "$LISTENER" | grep -q '127\.0\.0\.1'; then
    echo "  ✓ Bound to 127.0.0.1 (loopback only)"
  fi
else
  echo "  No listener on port $PORT"
fi
echo ""

# --- Route health ---
echo "Routes"
for route in "/" "/flight/"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT$route" 2>/dev/null || echo "000")
  echo "  http://127.0.0.1:$PORT$route → $CODE"
done
echo ""

# --- Recent logs ---
echo "Recent logs"
LATEST_LOG=$(ls -t "$STATE_DIR/logs/"arcade-*.log 2>/dev/null | head -1)
if [ -n "$LATEST_LOG" ]; then
  echo "  ($LATEST_LOG)"
  tail -n 8 "$LATEST_LOG" | sed 's/^/  /'
else
  echo "  No log files found"
fi
echo ""

# --- Fixtures ---
echo "Fixtures"
if [ -d ".local/cache/fake-camera" ]; then
  ls -1 .local/cache/fake-camera/*.y4m 2>/dev/null | while read -r f; do
    SIZE=$(du -h "$f" | cut -f1)
    echo "  $(basename "$f") ($SIZE)"
  done
else
  echo "  No fake-camera cache"
fi
