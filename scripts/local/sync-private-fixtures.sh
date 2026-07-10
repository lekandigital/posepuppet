#!/usr/bin/env bash
# PosePuppet Local Sync Private Fixtures — transfers fixture videos to remote.
# Uses rsync over SSH. No --delete. Validates on remote afterward.
set -euo pipefail

ENV_FILE="$(dirname "$0")/../../.env.remote.local"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
else
  echo "ERROR: Missing .env.remote.local"
  exit 1
fi

FIXTURE_DIR="$(dirname "$0")/../../fixtures/"
if [ ! -d "$FIXTURE_DIR" ]; then
  echo "ERROR: fixtures/ directory not found."
  exit 1
fi

echo "==> PosePuppet Sync Private Fixtures"
echo "Source: $FIXTURE_DIR"
echo "Target: $POSEPUPPET_REMOTE_USER@$POSEPUPPET_REMOTE_HOST:$POSEPUPPET_REMOTE_REPO/fixtures/"
echo ""

echo "Synchronizing fixture videos..."
rsync -avz --progress \
  -e "ssh -i $POSEPUPPET_REMOTE_IDENTITY" \
  --include='*/' \
  --include='*.mp4' \
  --include='*.mov' \
  --exclude='*.y4m' \
  --exclude='*.log' \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.local' \
  --exclude='*.bundle' \
  --exclude='__pycache__' \
  --exclude='.DS_Store' \
  "$FIXTURE_DIR" \
  "$POSEPUPPET_REMOTE_USER@$POSEPUPPET_REMOTE_HOST:$POSEPUPPET_REMOTE_REPO/fixtures/"

echo ""
echo "Running remote fixture validation..."
ssh -i "$POSEPUPPET_REMOTE_IDENTITY" \
  "$POSEPUPPET_REMOTE_USER@$POSEPUPPET_REMOTE_HOST" \
  "cd $POSEPUPPET_REMOTE_REPO && ./scripts/remote/prepare-fixtures.sh"

echo ""
echo "Fixture sync complete."
