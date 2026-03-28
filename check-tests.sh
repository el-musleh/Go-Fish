#!/usr/bin/env bash
set -euo pipefail

OUTPUT=$(npm test 2>&1)

FILES_LINE=$(echo "$OUTPUT"  | grep -E "^( Test Files| Test Files )" | tail -1)
TESTS_LINE=$(echo "$OUTPUT"  | grep -E "^(      Tests|Tests)" | tail -1)
DURATION_LINE=$(echo "$OUTPUT" | grep -E "^   Duration" | tail -1)

# Extract numbers
FILES_PASSED=$(echo "$FILES_LINE"  | grep -oP '\d+ passed'  | grep -oP '\d+' || echo 0)
FILES_FAILED=$(echo "$FILES_LINE"  | grep -oP '\d+ failed'  | grep -oP '\d+' || echo 0)

TESTS_PASSED=$(echo "$TESTS_LINE"  | grep -oP '\d+ passed'  | grep -oP '\d+' || echo 0)
TESTS_FAILED=$(echo "$TESTS_LINE"  | grep -oP '\d+ failed'  | grep -oP '\d+' || echo 0)
TESTS_SKIPPED=$(echo "$TESTS_LINE" | grep -oP '\d+ skipped' | grep -oP '\d+' || echo 0)

DURATION=$(echo "$DURATION_LINE" | grep -oP '[\d.]+s' | head -1 || echo "?")

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  TEST RESULTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$FILES_FAILED" -gt 0 ] || [ "$TESTS_FAILED" -gt 0 ]; then
  echo "  STATUS   ❌  FAILED"
  echo ""

  # Print each failing test name
  echo "  FAILURES:"
  echo "$OUTPUT" | grep -E "^ (FAIL|×)" | sed 's/^ /    /' || true
  echo ""
else
  echo "  STATUS   ✅  ALL GREEN"
fi

echo ""
echo "  Files    ${FILES_PASSED} passed, ${FILES_FAILED} failed"
echo "  Tests    ${TESTS_PASSED} passed, ${TESTS_FAILED} failed, ${TESTS_SKIPPED} skipped"
echo "  Duration ${DURATION}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Exit with failure code if any tests failed
[ "$TESTS_FAILED" -eq 0 ] && [ "$FILES_FAILED" -eq 0 ]
