#!/usr/bin/env bash
set -euo pipefail

echo "========================================="
echo "FINAL TEST HANDOFF"
echo "========================================="
echo "Branch: $(git branch --show-current)"
echo "Commit: $(git rev-parse HEAD)"
echo ""
echo "Working-tree state:"
git status --short
echo ""
echo "Server state:"
if ss -ltnp 2>/dev/null | grep -q '127\.0\.0\.1:5173\b'; then
  echo "RUNNING on 127.0.0.1:5173"
else
  echo "NOT RUNNING or not bound to loopback"
fi
echo ""
echo "Exact tunnel command:"
echo "ssh -N -L 5173:127.0.0.1:5173 -i ~/.ssh/pinn_rtx3090 o@192.168.86.152"
echo ""
echo "Local URL:"
echo "http://localhost:5173"
echo ""
echo "Feature route:"
echo "http://localhost:5173/flight/ (or root for PosePuppet)"
echo ""
echo "Please remember to evaluate obstacle avoidance before final acceptance if a navigable mode was changed."
echo "========================================="
