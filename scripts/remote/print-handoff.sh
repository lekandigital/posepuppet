#!/usr/bin/env bash
# PosePuppet Remote Print Handoff — generates final test handoff information.
# No private IPs or usernames hardcoded.
set -euo pipefail

echo "========================================="
echo "FINAL TEST HANDOFF"
echo "========================================="
echo ""
echo "Branch: $(git branch --show-current)"
echo "Commit: $(git rev-parse HEAD)"
echo "Subject: $(git log -1 --format='%s')"
echo ""

echo "Working-tree state:"
DIRTY=$(git status --short)
if [ -n "$DIRTY" ]; then
  echo "$DIRTY" | sed 's/^/  /'
else
  echo "  clean"
fi
echo ""

echo "Server state:"
if ss -ltnp 2>/dev/null | grep -q '127\.0\.0\.1:5173\b'; then
  echo "  RUNNING on 127.0.0.1:5173 (loopback)"
  PID=$(ss -ltnp 2>/dev/null | grep '127\.0\.0\.1:5173\b' | grep -oP 'pid=\K[0-9]+' | head -1)
  echo "  PID: ${PID:-unknown}"
else
  echo "  NOT RUNNING"
  echo "  Start with: ./scripts/remote/start-arcade.sh"
fi
echo ""

echo "Tunnel command (run on Mac):"
echo "  Use: ./scripts/local/remote-tunnel.sh"
echo "  Or manually: ssh -N -L 5173:127.0.0.1:5173 \\"
echo "    -o ExitOnForwardFailure=yes \\"
echo "    -o ServerAliveInterval=30 \\"
echo "    -o ServerAliveCountMax=3 \\"
echo "    -i <SSH_KEY> <USER>@<HOST>"
echo ""

echo "Local URLs:"
echo "  PosePuppet: http://localhost:5173"
echo "  Flight:     http://localhost:5173/flight/"
echo ""

echo "Reminder:"
echo "  - Test on Chrome and Safari"
echo "  - Verify real webcam tracking"
echo "  - Evaluate Apple Silicon performance"
echo "  - Check rhythm, steering, seated operation"
echo "  - Evaluate comfort and nausea"
echo "  - If a navigable mode changed, evaluate obstacle avoidance"
echo "========================================="
