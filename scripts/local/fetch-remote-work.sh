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
echo "Creating local backup ref..."
git update-ref refs/heads/backup/$BRANCH-$(date +%s) $BRANCH

echo "Fetching from remote..."
git fetch "ssh://$POSEPUPPET_REMOTE_USER@$POSEPUPPET_REMOTE_HOST$POSEPUPPET_REMOTE_REPO" "$BRANCH"

echo "Fast-forwarding local branch..."
git merge --ff-only FETCH_HEAD

echo "Local branch $BRANCH is now at $(git rev-parse HEAD)"
