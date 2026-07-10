#!/usr/bin/env bash
# PosePuppet Local Sync Git Bundle — safely synchronizes source to remote via Git bundle.
# Uses fast-forward only. Never uses git reset. Never overwrites diverged history.
set -euo pipefail

ENV_FILE="$(dirname "$0")/../../.env.remote.local"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
else
  echo "ERROR: Missing .env.remote.local"
  echo "Create it with: POSEPUPPET_REMOTE_USER, POSEPUPPET_REMOTE_HOST, POSEPUPPET_REMOTE_IDENTITY, POSEPUPPET_REMOTE_REPO"
  exit 1
fi

DRY_RUN=false
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=true
  echo "==> DRY RUN MODE (no changes will be made)"
fi

BRANCH=$(git branch --show-current)
LOCAL_HASH=$(git rev-parse HEAD)
TIMESTAMP=$(date +%s)

echo "==> PosePuppet Sync Git Bundle"
echo "Branch: $BRANCH"
echo "Local HEAD: $LOCAL_HASH"
echo ""

# Verify local working tree is clean
if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: Local working tree is not clean. Commit or stash changes first."
  exit 1
fi

# Bundle location — outside repo root, in state directory
BUNDLE_DIR="$HOME/.local/state/posepuppet/bundles"
mkdir -p "$BUNDLE_DIR"
BUNDLE_FILE="$BUNDLE_DIR/sync-${BRANCH}-${LOCAL_HASH:0:12}-${TIMESTAMP}.bundle"

echo "Creating bundle..."
git bundle create "$BUNDLE_FILE" HEAD "$BRANCH"
echo "Bundle: $BUNDLE_FILE"

echo "Verifying bundle locally..."
git bundle verify "$BUNDLE_FILE" >/dev/null 2>&1
echo "Bundle verified."
echo ""

if $DRY_RUN; then
  echo "DRY RUN: Would transfer $BUNDLE_FILE to remote"
  echo "DRY RUN: Would fetch and fast-forward $BRANCH on remote"
  echo "DRY RUN: No changes made."
  rm -f "$BUNDLE_FILE"
  exit 0
fi

# Transfer bundle
REMOTE_BUNDLE="/tmp/posepuppet-sync-${TIMESTAMP}.bundle"
echo "Transferring bundle to remote..."
rsync -az -e "ssh -i $POSEPUPPET_REMOTE_IDENTITY" "$BUNDLE_FILE" \
  "$POSEPUPPET_REMOTE_USER@$POSEPUPPET_REMOTE_HOST:$REMOTE_BUNDLE"
echo "Transfer complete."
echo ""

# Apply on remote
echo "Applying bundle on remote..."
ssh -i "$POSEPUPPET_REMOTE_IDENTITY" "$POSEPUPPET_REMOTE_USER@$POSEPUPPET_REMOTE_HOST" bash -s "$BRANCH" "$LOCAL_HASH" "$REMOTE_BUNDLE" "$TIMESTAMP" << 'REMOTE_SCRIPT'
  set -euo pipefail
  BRANCH="$1"
  EXPECTED_HASH="$2"
  BUNDLE="$3"
  TS="$4"
  REPO="$HOME/Dev/posepuppet"

  cd "$REPO"

  # Verify clean working tree
  if [ -n "$(git status --porcelain)" ]; then
    echo "ERROR: Remote working tree is not clean."
    git status --short
    exit 1
  fi

  CURRENT_HASH=$(git rev-parse HEAD)
  echo "Remote current HEAD: $CURRENT_HASH"
  echo "Expected new HEAD: $EXPECTED_HASH"

  # Create timestamped backup ref
  if git rev-parse "$BRANCH" >/dev/null 2>&1; then
    git tag "backup/pre-sync-${TS}" "$BRANCH" 2>/dev/null || true
    echo "Backup ref: backup/pre-sync-${TS}"
  fi

  # Verify bundle
  echo "Verifying bundle..."
  git bundle verify "$BUNDLE" >/dev/null 2>&1

  # Fetch into temp ref
  echo "Fetching bundle..."
  git fetch "$BUNDLE" "$BRANCH":refs/tmp/sync-incoming

  INCOMING_HASH=$(git rev-parse refs/tmp/sync-incoming)
  echo "Incoming hash: $INCOMING_HASH"

  # Verify ancestry (fast-forward check)
  if ! git merge-base --is-ancestor "$CURRENT_HASH" "$INCOMING_HASH"; then
    echo "ERROR: Non-fast-forward update detected!"
    echo "  Current: $CURRENT_HASH"
    echo "  Incoming: $INCOMING_HASH"
    echo "  The remote branch has diverged. Resolve locally and try again."
    git update-ref -d refs/tmp/sync-incoming
    exit 1
  fi

  # Ensure we're on the right branch
  CURRENT_BRANCH=$(git branch --show-current)
  if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
    echo "Checking out $BRANCH..."
    git checkout "$BRANCH"
  fi

  # Fast-forward
  echo "Fast-forwarding $BRANCH..."
  git merge --ff-only refs/tmp/sync-incoming

  # Clean up temp ref
  git update-ref -d refs/tmp/sync-incoming

  # Verify
  FINAL_HASH=$(git rev-parse HEAD)
  echo "Remote HEAD after sync: $FINAL_HASH"

  if [ "$FINAL_HASH" != "$EXPECTED_HASH" ]; then
    echo "ERROR: Final hash mismatch!"
    echo "  Expected: $EXPECTED_HASH"
    echo "  Got: $FINAL_HASH"
    exit 1
  fi

  echo "Sync verified."
  rm -f "$BUNDLE"
REMOTE_SCRIPT

echo ""
echo "Sync complete."
echo "Local:  $LOCAL_HASH"

# Verify by querying remote
REMOTE_FINAL=$(ssh -i "$POSEPUPPET_REMOTE_IDENTITY" "$POSEPUPPET_REMOTE_USER@$POSEPUPPET_REMOTE_HOST" "cd $POSEPUPPET_REMOTE_REPO && git rev-parse HEAD")
echo "Remote: $REMOTE_FINAL"

if [ "$LOCAL_HASH" = "$REMOTE_FINAL" ]; then
  echo "✓ Hashes match."
else
  echo "✗ Hash mismatch!"
  exit 1
fi

# Clean up local bundle (keep for a bit in case of issues)
echo "Local bundle preserved at: $BUNDLE_FILE"
