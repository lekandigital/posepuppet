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

not_implemented() {
  local name="$1"
  local reason="$2"
  echo ""
  echo "--- $name ---"
  echo ">>> $name: NOT_IMPLEMENTED ($reason)"
  RESULTS["$name"]="NOT_IMPLEMENTED"
}

exec > >(tee "$LOGFILE") 2>&1

echo "==> PosePuppet Remote Test-All"
echo "Timestamp: $TIMESTAMP"
echo "Branch: $(git branch --show-current)"
echo "HEAD: $(git rev-parse --short HEAD)"
echo ""

# ===================================================================
# DEPENDENCY VERIFICATION
# ===================================================================
run_check "lockfile-integrity" npm ci --prefer-offline --no-audit

# ===================================================================
# STATIC ANALYSIS
# ===================================================================
run_check "typecheck" npx tsc --noEmit

# ===================================================================
# BUILDS
# ===================================================================
run_check "root-build" npx vite build

if [ -d "apps/flight" ] && [ -f "apps/flight/package.json" ]; then
  run_check "flight-build" npm --prefix apps/flight run build:client
else
  skip_check "flight-build" "apps/flight not present"
fi

# Pre-bundle for Vite (prevents 504 timeouts under slow SwiftShader)
echo ""
echo "--- vite-optimize ---"
npx vite optimize 2>&1 || true
echo ">>> vite-optimize: done (informational)"

# ===================================================================
# PLAYWRIGHT: SWIFTSHADER FUNCTIONAL TESTS
# ===================================================================
# Wrapper function to handle xvfb-run portably
run_with_display() {
  if command -v xvfb-run >/dev/null 2>&1; then
    xvfb-run --auto-servernum --server-args="-screen 0 1920x1080x24" "$@"
  else
    "$@"
  fi
}

if [ -f "playwright.config.ts" ]; then
  echo ""
  echo "--- playwright-swiftshader ---"
  if USE_SWIFTSHADER=1 run_with_display npx playwright test --project=default 2>&1; then
    RESULTS["playwright-swiftshader"]="PASS"
    echo ">>> playwright-swiftshader: PASS"
  else
    PW_EXIT=$?
    RESULTS["playwright-swiftshader"]="FAIL"
    echo ">>> playwright-swiftshader: FAIL (exit $PW_EXIT)"
    echo "    Note: If only performance assertions failed, this is expected under SwiftShader."
    echo "    Original performance thresholds are preserved — final validation on Apple Silicon."
    OVERALL_EXIT=1
  fi
else
  skip_check "playwright-swiftshader" "playwright.config.ts not found"
fi

# ===================================================================
# PLAYWRIGHT: NVIDIA GPU PERFORMANCE TESTS (opt-in)
# ===================================================================
GPU_DISPLAY="${POSEPUPPET_GPU_DISPLAY:-}"
GPU_TESTS="${POSEPUPPET_GPU_TESTS:-}"

if [ -n "$GPU_TESTS" ] && [ -n "$GPU_DISPLAY" ]; then
  echo ""
  echo "--- gpu-preflight ---"
  if POSEPUPPET_GPU_DISPLAY="$GPU_DISPLAY" node scripts/remote/gpu-preflight.mjs 2>&1; then
    RESULTS["gpu-preflight"]="PASS"
    echo ">>> gpu-preflight: PASS"

    # Run GPU performance tests (3 independent runs)
    GPU_ALL_PASS=true
    for run_num in 1 2 3; do
      echo ""
      echo "--- nvidia-performance-run-${run_num} ---"
      echo "Start: $(date -Iseconds)"
      if POSEPUPPET_GPU_TESTS=1 POSEPUPPET_GPU_DISPLAY="$GPU_DISPLAY" DISPLAY="$GPU_DISPLAY" \
         npx playwright test --project=gpu-performance 2>&1; then
        RESULTS["nvidia-performance-run-${run_num}"]="PASS"
        echo ">>> nvidia-performance-run-${run_num}: PASS"
      else
        RESULTS["nvidia-performance-run-${run_num}"]="FAIL"
        echo ">>> nvidia-performance-run-${run_num}: FAIL"
        GPU_ALL_PASS=false
        OVERALL_EXIT=1
      fi
      echo "End: $(date -Iseconds)"
    done

    if $GPU_ALL_PASS; then
      RESULTS["nvidia-performance"]="PASS"
    else
      RESULTS["nvidia-performance"]="FAIL"
    fi
  else
    RESULTS["gpu-preflight"]="FAIL"
    echo ">>> gpu-preflight: FAIL (renderer is not NVIDIA-accelerated)"
    env_blocked "nvidia-performance" "GPU preflight failed — no NVIDIA renderer"
  fi
else
  if [ -z "$GPU_TESTS" ]; then
    skip_check "nvidia-performance" "POSEPUPPET_GPU_TESTS not set"
  else
    skip_check "nvidia-performance" "POSEPUPPET_GPU_DISPLAY not set"
  fi
fi

# ===================================================================
# MODEL EVAL
# ===================================================================
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

# ===================================================================
# PYTHON AUDITS
# ===================================================================
if grep -q '"audit:all"' package.json 2>/dev/null; then
  if command -v blender >/dev/null 2>&1; then
    run_check "blender-audit" npm run audit:all
  else
    skip_check "blender-audit" "Blender is not installed on this machine"
  fi
else
  skip_check "blender-audit" "No audit:all script in package.json"
fi

# Always run non-Blender audits when available
if grep -q '"audit:self-test"' package.json 2>/dev/null; then
  run_check "audit-self-test" npm run audit:self-test
fi
if grep -q '"audit:validate"' package.json 2>/dev/null; then
  run_check "audit-validate" npm run audit:validate
fi

# ===================================================================
# FIXTURE VALIDATION
# ===================================================================
echo ""
echo "--- fixture-validation ---"
if [ -d "fixtures" ]; then
  FIXTURE_FAIL=0
  find fixtures -type f \( -name "*.mp4" -o -name "*.mov" \) | sort | while read -r f; do
    if ffprobe -v error -show_format "$f" >/dev/null 2>&1; then
      echo "  ✓ $f"
    else
      echo "  ✗ $f (corrupt or unreadable)"
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

# ===================================================================
# Y4M VALIDATION
# ===================================================================
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

# ===================================================================
# FAKE CAMERA VALIDATION
# ===================================================================
echo ""
echo "--- fake-camera-validation ---"
FAKE_CAM="${POSEPUPPET_FAKE_CAMERA:-}"
if [ -z "$FAKE_CAM" ]; then
  # Use default resolution path
  CACHED=".local/cache/fake-camera/arms_tpose.y4m"
  ORIG="fixtures/arms.y4m"
  if [ -f "$CACHED" ]; then
    FAKE_CAM="$CACHED"
  elif [ -f "$ORIG" ]; then
    FAKE_CAM="$ORIG"
  fi
fi
if [ -n "$FAKE_CAM" ] && [ -f "$FAKE_CAM" ]; then
  if ffprobe -v error -show_format "$FAKE_CAM" >/dev/null 2>&1; then
    echo "  ✓ $FAKE_CAM"
    RESULTS["fake-camera-validation"]="PASS"
    echo ">>> fake-camera-validation: PASS"
  else
    echo "  ✗ $FAKE_CAM"
    RESULTS["fake-camera-validation"]="FAIL"
    echo ">>> fake-camera-validation: FAIL"
    OVERALL_EXIT=1
  fi
else
  skip_check "fake-camera-validation" "No fake camera file found"
fi

# ===================================================================
# ROUTE SMOKE TESTS
# ===================================================================
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

# ===================================================================
# NOT-YET-IMPLEMENTED CHECKS (scaffolding for future development)
# ===================================================================
not_implemented "rowing-tests" "Rowing test suite not yet written"
not_implemented "rowing-fixture-eval" "Rowing fixture evaluation not yet written"
not_implemented "ppc-regressions" "PPC regression suite not yet separated"
not_implemented "deterministic-replay" "Deterministic replay harness not yet written"
not_implemented "closed-loop-rowing-sim" "Closed-loop rowing simulation not yet written"

# ===================================================================
# GENERATED OUTPUT HANDLING
# ===================================================================
echo ""
echo "--- generated-output-handling ---"
if git diff --name-only 2>/dev/null | grep -q "eval/results.json"; then
  echo "  eval/results.json modified by test run (expected)"
  echo "  Preserving generated version and restoring committed baseline..."
  GEN_DIR="$STATE_DIR/generated/${TIMESTAMP}"
  mkdir -p "$GEN_DIR"
  cp eval/results.json "$GEN_DIR/eval-results.json"
  sha256sum eval/results.json > "$GEN_DIR/eval-results-sha256.txt"
  git checkout -- eval/results.json
  echo "  ✓ Committed version restored, generated version saved to $GEN_DIR/"
  RESULTS["generated-output-handling"]="PASS"
  echo ">>> generated-output-handling: PASS"
else
  echo "  eval/results.json unchanged"
  RESULTS["generated-output-handling"]="PASS"
  echo ">>> generated-output-handling: PASS"
fi

# ===================================================================
# WHITESPACE / DIFF CHECK
# ===================================================================
run_check "whitespace-check" git diff --check

# ===================================================================
# REPORTS
# ===================================================================
echo ""
echo "========================================="
echo "BASELINE SUMMARY ($TIMESTAMP)"
echo "========================================="
echo ""

# Ordered check list for consistent output
ORDERED_CHECKS=(
  "lockfile-integrity"
  "typecheck"
  "root-build"
  "flight-build"
  "playwright-swiftshader"
  "gpu-preflight"
  "nvidia-performance"
  "nvidia-performance-run-1"
  "nvidia-performance-run-2"
  "nvidia-performance-run-3"
  "model-eval"
  "blender-audit"
  "audit-self-test"
  "audit-validate"
  "fixture-validation"
  "y4m-validation"
  "fake-camera-validation"
  "route-smoke"
  "rowing-tests"
  "rowing-fixture-eval"
  "ppc-regressions"
  "deterministic-replay"
  "closed-loop-rowing-sim"
  "generated-output-handling"
  "whitespace-check"
)

# Markdown report
{
  echo "# Baseline Report — $TIMESTAMP"
  echo ""
  echo "| Check | Result |"
  echo "|-------|--------|"
  for key in "${ORDERED_CHECKS[@]}"; do
    if [ -n "${RESULTS[$key]+x}" ]; then
      echo "| $key | ${RESULTS[$key]} |"
    fi
  done
  # Also include any checks not in the ordered list
  for key in "${!RESULTS[@]}"; do
    found=false
    for ordered in "${ORDERED_CHECKS[@]}"; do
      if [ "$key" = "$ordered" ]; then found=true; break; fi
    done
    if ! $found; then
      echo "| $key | ${RESULTS[$key]} |"
    fi
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
  for key in "${ORDERED_CHECKS[@]}"; do
    if [ -n "${RESULTS[$key]+x}" ]; then
      if $FIRST; then FIRST=false; else echo ","; fi
      printf "    \"%s\": \"%s\"" "$key" "${RESULTS[$key]}"
    fi
  done
  for key in "${!RESULTS[@]}"; do
    found=false
    for ordered in "${ORDERED_CHECKS[@]}"; do
      if [ "$key" = "$ordered" ]; then found=true; break; fi
    done
    if ! $found; then
      if $FIRST; then FIRST=false; else echo ","; fi
      printf "    \"%s\": \"%s\"" "$key" "${RESULTS[$key]}"
    fi
  done
  echo ""
  echo "  }"
  echo "}"
} > "$JSON_REPORT"

# Print summary table (ordered)
for key in "${ORDERED_CHECKS[@]}"; do
  if [ -n "${RESULTS[$key]+x}" ]; then
    printf "  %-35s %s\n" "$key" "${RESULTS[$key]}"
  fi
done
# Print any extras
for key in "${!RESULTS[@]}"; do
  found=false
  for ordered in "${ORDERED_CHECKS[@]}"; do
    if [ "$key" = "$ordered" ]; then found=true; break; fi
  done
  if ! $found; then
    printf "  %-35s %s\n" "$key" "${RESULTS[$key]}"
  fi
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
