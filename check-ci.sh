#!/usr/bin/env bash
# Mirrors the GitHub Actions CI pipeline locally.
# Runs automatically on `git push` via .husky/pre-push.
# Can also be run manually: ./check-ci.sh
set -euo pipefail

PASS="✅"
FAIL="❌"
results=()
failed=0

run_step() {
  local label="$1"
  shift
  printf "  %-40s " "$label..."
  if output=$(eval "$@" 2>&1); then
    echo "$PASS"
    results+=("$PASS  $label")
  else
    echo "$FAIL"
    echo ""
    echo "$output" | tail -20 | sed 's/^/    /'
    echo ""
    results+=("$FAIL  $label")
    failed=1
  fi
}

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  CI CHECK  (mirrors GitHub Actions)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  ── Backend ────────────────────────────────────────"
run_step "Tests"            "npm test --silent"
run_step "Security audit"   "npm audit --audit-level=high"

echo ""
echo "  ── Frontend ───────────────────────────────────────"
run_step "ESLint"           "npm --prefix client run lint --silent"
run_step "Type check"       "node client/node_modules/typescript/bin/tsc --noEmit -p client/tsconfig.json"
run_step "Build"            "npm --prefix client run build --silent"
run_step "Security audit"   "npm --prefix client audit --audit-level=high"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for r in "${results[@]}"; do
  echo "  $r"
done
echo ""

if [ "$failed" -eq 1 ]; then
  echo "  RESULT  ❌  One or more checks failed — push blocked."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  exit 1
else
  echo "  RESULT  ✅  All checks passed — safe to push."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  exit 0
fi
