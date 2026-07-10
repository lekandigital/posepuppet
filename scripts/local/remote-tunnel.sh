#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="$(dirname "$0")/../../.env.remote.local"
if [ -f "$ENV_FILE" ]; then
  source "$ENV_FILE"
else
  echo "Missing .env.remote.local"
  exit 1
fi

echo "Testing SSH connectivity..."
if ! ssh -q -o BatchMode=yes -o ConnectTimeout=5 -i "$POSEPUPPET_REMOTE_IDENTITY" "$POSEPUPPET_REMOTE_USER@$POSEPUPPET_REMOTE_HOST" 'exit 0'; then
  echo "Failed to connect to $POSEPUPPET_REMOTE_HOST"
  exit 1
fi

LOCAL_PORT=${POSEPUPPET_LOCAL_PORT:-5173}
if lsof -i :$LOCAL_PORT >/dev/null 2>&1; then
  echo "Port $LOCAL_PORT is occupied. Falling back to 5174."
  LOCAL_PORT=5174
fi

echo "Opening tunnel from local $LOCAL_PORT to remote 127.0.0.1:$POSEPUPPET_REMOTE_PORT"
echo "Local URL: http://localhost:$LOCAL_PORT"

ssh -N -L "$LOCAL_PORT:127.0.0.1:$POSEPUPPET_REMOTE_PORT" \
  -o ExitOnForwardFailure=yes \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 \
  -i "$POSEPUPPET_REMOTE_IDENTITY" \
  "$POSEPUPPET_REMOTE_USER@$POSEPUPPET_REMOTE_HOST"
