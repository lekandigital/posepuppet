#!/usr/bin/env bash
# PosePuppet Local Tunnel — opens SSH tunnel to remote dev server.
# Server must already be running on remote 127.0.0.1:5173.
set -euo pipefail

ENV_FILE="$(dirname "$0")/../../.env.remote.local"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
else
  echo "ERROR: Missing .env.remote.local"
  exit 1
fi

REMOTE_PORT="${POSEPUPPET_REMOTE_PORT:-5173}"
LOCAL_PORT="${POSEPUPPET_LOCAL_PORT:-5173}"

# Check if local port is available
if lsof -i ":$LOCAL_PORT" >/dev/null 2>&1; then
  echo "Port $LOCAL_PORT is occupied locally. Trying $((LOCAL_PORT + 1))..."
  LOCAL_PORT=$((LOCAL_PORT + 1))
  if lsof -i ":$LOCAL_PORT" >/dev/null 2>&1; then
    echo "ERROR: Port $LOCAL_PORT is also occupied. Free a port first."
    exit 1
  fi
fi

# Test SSH connectivity first
echo "Testing SSH connectivity..."
if ! ssh -q -o BatchMode=yes -o ConnectTimeout=5 \
  -i "$POSEPUPPET_REMOTE_IDENTITY" \
  "$POSEPUPPET_REMOTE_USER@$POSEPUPPET_REMOTE_HOST" 'exit 0'; then
  echo "ERROR: Cannot connect to $POSEPUPPET_REMOTE_HOST"
  exit 1
fi
echo "SSH OK."
echo ""

echo "Opening tunnel: localhost:$LOCAL_PORT → remote 127.0.0.1:$REMOTE_PORT"
echo "URL: http://localhost:$LOCAL_PORT"
echo "Press Ctrl-C to close the tunnel."
echo ""

ssh -N \
  -L "$LOCAL_PORT:127.0.0.1:$REMOTE_PORT" \
  -o ExitOnForwardFailure=yes \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 \
  -i "$POSEPUPPET_REMOTE_IDENTITY" \
  "$POSEPUPPET_REMOTE_USER@$POSEPUPPET_REMOTE_HOST"
