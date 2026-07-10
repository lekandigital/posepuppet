#!/usr/bin/env bash
# PosePuppet Remote Test-All — runs the complete test/validation suite.
# Uses strict failure propagation: no || echo, no hidden failures.
# Optional components are explicitly SKIP_EXPECTED, not silently swallowed.
set -euo pipefail
[ -s "$HOME/.nvm/nvm.sh" ] && \. "$HOME/.nvm/nvm.sh"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
STATE_DIR="$HOME/.local/state/posepuppet"
LOG_DIR="$STATE_DIR/logs"
RESULTS_DIR="$STATE_DIR/results"
mkdir -p "$LOG_DIR" "$RESULTS_DIR"

LOGFILE="$LOG_DIR/test-all-${TIMESTAMP}.log"
JSON_REPORT="$RESULTS_DIR/baseline-${TIMESTAMP}.json"
MD_REPORT="$RESULTS_DIR/baseline-${TIMESTAMP}.md"

# Result tracking
declare -A RESULTS
OVERALL_EXIT=0

run_check() {
  local name="$1"
  shift
  echo ""
  echo "--- $name ---"
  if "$@" 2>&1; then
    RESULTS["$name"]="PASS"
    echo ">>> $name: PASS"
  else
    RESULTS["$name"]="FAIL"
    echo ">>> $name: FAIL"
    OVERALL_EXIT=1
  fi
}

skip_check() {
  local name="$1"
  local reason="$2"
  echo ""
  echo "--- $name ---"
  echo ">>> $name: SKIP_EXPECTED ($reason)"
  RESULTS["$name"]="SKIP_EXPECTED"
}

env_blocked() {
  local name="$1"
  local reason="$2"
  echo ""
  echo "--- $name ---"
  echo ">>> $name: ENVIRONMENT_BLOCKED ($reason)"
  RESULTS["$name"]="ENVIRONMENT_BLOCKED"
}

exec > >(tee "$LOGFILE") 2>&1

echo "==> PosePuppet Remote Test-All"
echo "Timestamp: $TIMESTAMP"
echo "Branch: $(git branch --show-current)"
echo "HEAD: $(git rev-parse --short HEAD)"
echo ""

# --- Dependency verification ---
run_check "lockfile-integrity" npm ci --prefer-offline --no-audit

# --- TypeScript ---
run_check "typecheck" npx tsc --noEmit

# --- Root build ---
run_check "root-build" npx vite build

# --- Flight build ---
if [ -d "apps/flight" ] && [ -f "apps/flight/package.json" ]; then
  run_check "flight-build" npm --prefix apps/flight run build:client
else
  skip_check "flight-build" "apps/flight not present"
fi

# --- Pre-bundle for Vite (prevents 504 timeouts under slow SwiftShader) ---
echo ""
echo "--- vite-optimize ---"
npx vite optimize 2>&1 || true
echo ">>> vite-optimize: done (informational)"

# --- Playwright tests ---
# Wrapper function to handle xvfb-run portably
run_with_display() {
  if command -v xvfb-run >/dev/null 2>&1; then
    xvfb-run --auto-servernum --server-args="-screen 0 1920x1080x24" "$@"
  else
    "$@"
  fi
}

if [ -f "playwright.config.ts" ]; then
  # Functional tests with SwiftShader
  # Note: performance assertions (poseFps > 5) may fail under SwiftShader.
  # This is classified as ENVIRONMENT_BLOCKED, not a product failure.
  echo ""
  echo "--- playwright-functional ---"
  if USE_SWIFTSHADER=1 run_with_display npx playwright test 2>&1; then
    RESULTS["playwright-functional"]="PASS"
    echo ">>> playwright-functional: PASS"
  else
    PW_EXIT=$?
    # Check if the failure is specifically a performance assertion under SwiftShader
    RESULTS["playwright-functional"]="FAIL"
    echo ">>> playwright-functional: FAIL (exit $PW_EXIT)"
    echo "    Note: If only performance assertions failed, this is expected under SwiftShader."
    echo "    Original performance thresholds are preserved — final validation on Apple Silicon."
    OVERALL_EXIT=1
  fi
else
  skip_check "playwright-functional" "playwright.config.ts not found"
fi

# --- Model eval ---
if [ -f "eval/run.mjs" ]; then
  echo ""
  echo "--- model-eval ---"
  if USE_SWIFTSHADER=1 run_with_display npm run eval 2>&1; then
    RESULTS["model-eval"]="PASS"
    echo ">>> model-eval: PASS"
  else
    RESULTS["model-eval"]="FAIL"
    echo ">>> model-eval: FAIL"
    OVERALL_EXIT=1
  fi
else
  skip_check "model-eval" "eval/run.mjs not found"
fi

# --- Python audits ---
if grep -q '"audit:all"' package.json 2>/dev/null; then
  if command -v blender >/dev/null 2>&1; then
    run_check "audit-all" npm run audit:all
  else
    skip_check "blender-audit" "Blender is not installed on this machine"
    # Still run non-Blender audits
    if grep -q '"audit:self-test"' package.json 2>/dev/null; then
      run_check "audit-self-test" npm run audit:self-test
    fi
    if grep -q '"audit:validate"' package.json 2>/dev/null; then
      run_check "audit-validate" npm run audit:validate
    fi
  fi
else
  skip_check "python-audits" "No audit:all script in package.json"
fi

# --- Fixture validation ---
echo ""
echo "--- fixture-validation ---"
if [ -d "fixtures" ]; then
  FIXTURE_FAIL=0
  find fixtures -type f \( -name "*.mp4" -o -name "*.mov" \) | while read -r f; do
    if ffprobe -v error -show_format "$f" >/dev/null 2>&1; then
      echo "  ✓ $f"
    else
      echo "  ✗ $f (corrupt or unreadable)"
      # We write a flag file instead of setting var (subshell)
      touch /tmp/.pp_fixture_fail
    fi
  done
  if [ -f /tmp/.pp_fixture_fail ]; then
    rm -f /tmp/.pp_fixture_fail
    RESULTS["fixture-validation"]="FAIL"
    echo ">>> fixture-validation: FAIL"
    OVERALL_EXIT=1
  else
    RESULTS["fixture-validation"]="PASS"
    echo ">>> fixture-validation: PASS"
  fi
else
  skip_check "fixture-validation" "No fixtures directory"
fi

# --- Y4M validation ---
echo ""
echo "--- y4m-validation ---"
if [ -d ".local/cache/fake-camera" ]; then
  Y4M_VALID=true
  for y4m in .local/cache/fake-camera/*.y4m; do
    [ -f "$y4m" ] || continue
    if ffprobe -v error -show_format "$y4m" >/dev/null 2>&1; then
      echo "  ✓ $(basename "$y4m")"
    else
      echo "  ✗ $(basename "$y4m")"
      Y4M_VALID=false
    fi
  done
  if $Y4M_VALID; then
    RESULTS["y4m-validation"]="PASS"
    echo ">>> y4m-validation: PASS"
  else
    RESULTS["y4m-validation"]="FAIL"
    echo ">>> y4m-validation: FAIL"
    OVERALL_EXIT=1
  fi
else
  skip_check "y4m-validation" "No .local/cache/fake-camera directory"
fi

# --- Route smoke tests ---
echo ""
echo "--- route-smoke ---"
if ss -ltnp 2>/dev/null | grep -q "127\.0\.0\.1:5173\b"; then
  ROUTE_FAIL=0
  for route in "/" "/flight/"; do
    CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:5173$route" 2>/dev/null || echo "000")
    if [ "$CODE" = "200" ] || [ "$CODE" = "304" ]; then
      echo "  ✓ $route → $CODE"
    else
      echo "  ✗ $route → $CODE"
      ROUTE_FAIL=1
    fi
  done
  if [ "$ROUTE_FAIL" -eq 0 ]; then
    RESULTS["route-smoke"]="PASS"
    echo ">>> route-smoke: PASS"
  else
    RESULTS["route-smoke"]="FAIL"
    echo ">>> route-smoke: FAIL"
    OVERALL_EXIT=1
  fi
else
  skip_check "route-smoke" "Server not running on 127.0.0.1:5173"
fi

# --- git diff --check ---
run_check "whitespace-check" git diff --check

# --- Generate reports ---
echo ""
echo "========================================="
echo "BASELINE SUMMARY ($TIMESTAMP)"
echo "========================================="
echo ""

# Markdown report
{
  echo "# Baseline Report — $TIMESTAMP"
  echo ""
  echo "| Check | Result |"
  echo "|-------|--------|"
  for key in "${!RESULTS[@]}"; do
    echo "| $key | ${RESULTS[$key]} |"
  done
  echo ""
  echo "Overall exit: $OVERALL_EXIT"
} > "$MD_REPORT"

# JSON report
{
  echo "{"
  echo "  \"timestamp\": \"$TIMESTAMP\","
  echo "  \"branch\": \"$(git branch --show-current)\","
  echo "  \"commit\": \"$(git rev-parse HEAD)\","
  echo "  \"overall\": $OVERALL_EXIT,"
  echo "  \"checks\": {"
  FIRST=true
  for key in "${!RESULTS[@]}"; do
    if $FIRST; then FIRST=false; else echo ","; fi
    printf "    \"%s\": \"%s\"" "$key" "${RESULTS[$key]}"
  done
  echo ""
  echo "  }"
  echo "}"
} > "$JSON_REPORT"

# Print summary table
for key in "${!RESULTS[@]}"; do
  printf "  %-30s %s\n" "$key" "${RESULTS[$key]}"
done
echo ""
echo "Reports: $MD_REPORT"
echo "         $JSON_REPORT"
echo "Full log: $LOGFILE"
echo ""

if [ "$OVERALL_EXIT" -eq 0 ]; then
  echo "ALL APPLICABLE CHECKS PASSED"
else
  echo "SOME CHECKS FAILED — review details above"
fi

exit "$OVERALL_EXIT"
