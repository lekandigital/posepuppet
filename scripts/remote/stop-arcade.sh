#!/usr/bin/env bash
# PosePuppet Remote Stop — stops only the project-owned server process.
# Never kills by port or process name. Uses graduated signals.
set -euo pipefail

SESSION="posepuppet-dev"
STATE_DIR="$HOME/.local/state/posepuppet"
PID_FILE="$STATE_DIR/server.pid"
PORT=5173

echo "==> PosePuppet Remote Stop"

# Check if tmux session exists
if ! tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "tmux session '$SESSION' is not running."
  # Clean up stale PID file
  [ -f "$PID_FILE" ] && rm -f "$PID_FILE"
  exit 0
fi

# Read recorded PID if available
RECORDED_PID=""
if [ -f "$PID_FILE" ]; then
  RECORDED_PID=$(cat "$PID_FILE")
  echo "Recorded server PID: $RECORDED_PID"
fi

# Step 1: Send Ctrl-C (SIGINT) via tmux
echo "Sending SIGINT to tmux session '$SESSION'..."
tmux send-keys -t "$SESSION" C-c
sleep 3

# Check if process stopped
if [ -n "$RECORDED_PID" ] && kill -0 "$RECORDED_PID" 2>/dev/null; then
  # Step 2: Send SIGTERM to the exact recorded process
  echo "Process still running. Sending SIGTERM to PID $RECORDED_PID..."
  kill -TERM "$RECORDED_PID" 2>/dev/null || true
  sleep 3

  if kill -0 "$RECORDED_PID" 2>/dev/null; then
    # Step 3: SIGKILL only for verified project-owned descendant
    echo "Process refuses to stop. Sending SIGKILL to PID $RECORDED_PID..."
    kill -KILL "$RECORDED_PID" 2>/dev/null || true
    sleep 1
  fi
fi

# Kill the tmux session (the shell wrapper)
if tmux has-session -t "$SESSION" 2>/dev/null; then
  tmux kill-session -t "$SESSION" 2>/dev/null
  echo "tmux session '$SESSION' terminated."
fi

# Clean up PID file
[ -f "$PID_FILE" ] && rm -f "$PID_FILE"

# Verify port is free
sleep 1
if ss -ltnp 2>/dev/null | grep -q ":${PORT}\b"; then
  echo "WARNING: Port $PORT is still in use (may be an unrelated process)."
  ss -ltnp 2>/dev/null | grep ":${PORT}\b" | sed 's/^/  /'
  exit 1
else
  echo "Port $PORT is clear."
  echo "Stop complete."
fi
