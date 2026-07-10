#!/usr/bin/env bash
# PosePuppet Local Remote Shell — opens an interactive SSH session to the remote.
set -euo pipefail

ENV_FILE="$(dirname "$0")/../../.env.remote.local"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
else
  echo "ERROR: Missing .env.remote.local"
  exit 1
fi

echo "Connecting to $POSEPUPPET_REMOTE_HOST..."
exec ssh -i "$POSEPUPPET_REMOTE_IDENTITY" \
  -t \
  "$POSEPUPPET_REMOTE_USER@$POSEPUPPET_REMOTE_HOST" \
  "cd $POSEPUPPET_REMOTE_REPO && exec bash -l"
