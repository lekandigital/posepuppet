#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="$(dirname "$0")/../../.env.remote.local"
if [ -f "$ENV_FILE" ]; then
  source "$ENV_FILE"
else
  echo "Missing .env.remote.local"
  exit 1
fi

BRANCH=$(git branch --show-current)
HASH=$(git rev-parse HEAD)
BUNDLE_FILE="/tmp/posepuppet-$BRANCH-$HASH.bundle"

echo "Creating bundle for $BRANCH at $HASH..."
git bundle create "$BUNDLE_FILE" HEAD "$BRANCH"

echo "Transferring bundle to remote..."
rsync -avz -e "ssh -i $POSEPUPPET_REMOTE_IDENTITY" "$BUNDLE_FILE" "$POSEPUPPET_REMOTE_USER@$POSEPUPPET_REMOTE_HOST:/tmp/"

echo "Applying bundle on remote..."
ssh -i "$POSEPUPPET_REMOTE_IDENTITY" "$POSEPUPPET_REMOTE_USER@$POSEPUPPET_REMOTE_HOST" << EOF
  set -euo pipefail
  cd $POSEPUPPET_REMOTE_REPO
  if git rev-parse $BRANCH >/dev/null 2>&1; then
    git update-ref refs/heads/backup/$BRANCH-$(date +%s) $BRANCH
  fi
  git checkout $BRANCH || git checkout -b $BRANCH
  echo "Fetching bundle..."
  git fetch /tmp/posepuppet-$BRANCH-$HASH.bundle $BRANCH
  echo "Fast-forwarding branch..."
  if ! git merge --ff-only FETCH_HEAD; then
    echo "ERROR: Non-fast-forward update. Remote branch has diverged."
    echo "Please resolve locally and try again."
    exit 1
  fi
  echo "Remote branch updated to \$(git rev-parse HEAD)"
EOF

rm "$BUNDLE_FILE"
echo "Sync complete."
