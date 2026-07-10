#!/usr/bin/env bash
# PosePuppet Remote Start — launches the arcade dev server in a tmux session.
# Binds to 127.0.0.1:5173 only. Never kills occupying processes.
set -euo pipefail
[ -s "$HOME/.nvm/nvm.sh" ] && \. "$HOME/.nvm/nvm.sh"

SESSION="posepuppet-dev"
PORT=5173
STATE_DIR="$HOME/.local/state/posepuppet"
LOG_DIR="$STATE_DIR/logs"
PID_FILE="$STATE_DIR/server.pid"
CMD_FILE="$STATE_DIR/server.cmd"

echo "==> PosePuppet Remote Start"

# Verify repository
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "ERROR: Not in a git repository"; exit 1; }
BRANCH=$(git branch --show-current)
echo "Branch: $BRANCH"
echo "HEAD: $(git rev-parse --short HEAD)"

# Verify dependencies
if [ ! -d "node_modules" ]; then
  echo "ERROR: node_modules missing. Run scripts/remote/install.sh first."
  exit 1
fi

# Refuse duplicate starts
if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "ERROR: tmux session '$SESSION' is already running."
  echo "Use scripts/remote/stop-arcade.sh to stop it first, or scripts/remote/status.sh to inspect."
  exit 1
fi

# Refuse if port is occupied by an unrelated process
if ss -ltnp 2>/dev/null | grep -q ":${PORT}\b"; then
  echo "ERROR: Port $PORT is already in use by another process:"
  ss -ltnp 2>/dev/null | grep ":${PORT}\b" | sed 's/^/  /'
  echo "Refusing to start. Will not kill the occupying process."
  exit 1
fi

# Prepare directories
mkdir -p "$LOG_DIR"

# Build Flight prerequisites if apps/flight exists
if [ -d "apps/flight" ] && [ -f "apps/flight/package.json" ]; then
  echo "Building Flight prerequisites..."
  npm --prefix apps/flight run build:client 2>&1 | tail -3
fi

# Record the server command
SERVER_CMD="npm run dev -- --host 127.0.0.1 --port $PORT --strictPort"
echo "$SERVER_CMD" > "$CMD_FILE"

# Launch in tmux
LOGFILE="$LOG_DIR/arcade-$(date +%Y%m%d-%H%M%S).log"
echo "Starting arcade in tmux session '$SESSION'..."
echo "Log: $LOGFILE"

REPO_DIR="$(pwd)"
tmux new-session -d -s "$SESSION" \
  "cd $REPO_DIR && . \$HOME/.nvm/nvm.sh && $SERVER_CMD > $LOGFILE 2>&1"

# Wait for server to listen on loopback
echo "Waiting for server on 127.0.0.1:$PORT..."
for i in {1..30}; do
  if ss -ltnp 2>/dev/null | grep -q "127\.0\.0\.1:${PORT}\b"; then
    # Record the PID
    SERVER_PID=$(ss -ltnp 2>/dev/null | grep "127\.0\.0\.1:${PORT}\b" | grep -oP 'pid=\K[0-9]+' | head -1)
    echo "$SERVER_PID" > "$PID_FILE"
    echo ""
    echo "Server is up!"
    echo "  tmux session: $SESSION"
    echo "  PID: $SERVER_PID"
    echo "  Listener: 127.0.0.1:$PORT"
    echo "  Log: $LOGFILE"

    # Verify route readiness
    sleep 1
    if curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/" | grep -qE "^(200|304)$"; then
      echo "  Root route: OK"
    else
      echo "  Root route: waiting for Vite HMR..."
    fi
    exit 0
  fi
  sleep 1
done

echo ""
echo "ERROR: Server failed to bind to 127.0.0.1:$PORT within 30 seconds."
echo "Check logs: cat $LOGFILE"
echo "Check tmux: tmux attach -t $SESSION"
exit 1
