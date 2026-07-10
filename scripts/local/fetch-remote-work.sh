#!/usr/bin/env bash
# PosePuppet Local Fetch Remote Work — fetches commits from remote via bundle.
# Fast-forward only. Never uses git reset.
set -euo pipefail

ENV_FILE="$(dirname "$0")/../../.env.remote.local"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
else
  echo "ERROR: Missing .env.remote.local"
  exit 1
fi

BRANCH=$(git branch --show-current)
TIMESTAMP=$(date +%s)

echo "==> PosePuppet Fetch Remote Work"
echo "Local branch: $BRANCH"
echo "Local HEAD: $(git rev-parse --short HEAD)"
echo ""

# Verify clean working tree
if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: Local working tree is not clean."
  exit 1
fi

# Create bundle on remote
REMOTE_BUNDLE="/tmp/posepuppet-fetch-${TIMESTAMP}.bundle"
echo "Creating bundle on remote..."
ssh -i "$POSEPUPPET_REMOTE_IDENTITY" \
  "$POSEPUPPET_REMOTE_USER@$POSEPUPPET_REMOTE_HOST" \
  "cd $POSEPUPPET_REMOTE_REPO && git bundle create $REMOTE_BUNDLE HEAD $BRANCH && git bundle verify $REMOTE_BUNDLE >/dev/null 2>&1"

# Download bundle
BUNDLE_DIR="$HOME/.local/state/posepuppet/bundles"
mkdir -p "$BUNDLE_DIR"
LOCAL_BUNDLE="$BUNDLE_DIR/fetch-${TIMESTAMP}.bundle"
echo "Downloading bundle..."
rsync -az -e "ssh -i $POSEPUPPET_REMOTE_IDENTITY" \
  "$POSEPUPPET_REMOTE_USER@$POSEPUPPET_REMOTE_HOST:$REMOTE_BUNDLE" \
  "$LOCAL_BUNDLE"

# Verify and fetch
echo "Verifying bundle..."
git bundle verify "$LOCAL_BUNDLE" >/dev/null 2>&1

echo "Fetching..."
git fetch "$LOCAL_BUNDLE" "$BRANCH":refs/tmp/fetch-incoming

INCOMING=$(git rev-parse refs/tmp/fetch-incoming)
CURRENT=$(git rev-parse HEAD)
echo "Current: $CURRENT"
echo "Incoming: $INCOMING"

if [ "$CURRENT" = "$INCOMING" ]; then
  echo "Already up to date."
  git update-ref -d refs/tmp/fetch-incoming
  exit 0
fi

# Verify ancestry
if ! git merge-base --is-ancestor "$CURRENT" "$INCOMING"; then
  echo "ERROR: Non-fast-forward. Remote has diverged."
  git update-ref -d refs/tmp/fetch-incoming
  exit 1
fi

# Create backup
git tag "backup/pre-fetch-${TIMESTAMP}" HEAD 2>/dev/null || true

# Fast-forward
echo "Fast-forwarding..."
git merge --ff-only refs/tmp/fetch-incoming

# Clean up
git update-ref -d refs/tmp/fetch-incoming

echo "Updated to $(git rev-parse --short HEAD)"
echo "Fetch complete."

# Clean up remote bundle
ssh -i "$POSEPUPPET_REMOTE_IDENTITY" \
  "$POSEPUPPET_REMOTE_USER@$POSEPUPPET_REMOTE_HOST" \
  "rm -f $REMOTE_BUNDLE" 2>/dev/null || true
