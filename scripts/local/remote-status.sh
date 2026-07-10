#!/usr/bin/env bash
# PosePuppet Local Remote Status — runs the status script on the remote machine.
set -euo pipefail

ENV_FILE="$(dirname "$0")/../../.env.remote.local"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
else
  echo "ERROR: Missing .env.remote.local"
  exit 1
fi

ssh -i "$POSEPUPPET_REMOTE_IDENTITY" \
  "$POSEPUPPET_REMOTE_USER@$POSEPUPPET_REMOTE_HOST" \
  "cd $POSEPUPPET_REMOTE_REPO && ./scripts/remote/status.sh"
