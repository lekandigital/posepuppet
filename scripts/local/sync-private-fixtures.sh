#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="$(dirname "$0")/../../.env.remote.local"
if [ -f "$ENV_FILE" ]; then
  source "$ENV_FILE"
else
  echo "Missing .env.remote.local"
  exit 1
fi

echo "Synchronizing private fixtures..."
rsync -avz -e "ssh -i $POSEPUPPET_REMOTE_IDENTITY" \
  --exclude="node_modules" \
  --exclude=".git" \
  --exclude="*.log" \
  --exclude="dist" \
  --exclude=".local" \
  --include="*/" \
  --include="*.mp4" \
  --include="*.mov" \
  --exclude="*" \
  "$(dirname "$0")/../../fixtures/" \
  "$POSEPUPPET_REMOTE_USER@$POSEPUPPET_REMOTE_HOST:$POSEPUPPET_REMOTE_REPO/fixtures/"

echo "Running remote fixture validation..."
ssh -i "$POSEPUPPET_REMOTE_IDENTITY" "$POSEPUPPET_REMOTE_USER@$POSEPUPPET_REMOTE_HOST" "cd $POSEPUPPET_REMOTE_REPO && ./scripts/remote/prepare-fixtures.sh"
