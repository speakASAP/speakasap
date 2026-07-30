#!/usr/bin/env bash
# Vendor the drill contracts into every consumer. Idempotent.
# --check exits non-zero when any copy has drifted from the source. --check
# is read-only: it never creates directories and never writes the checksum
# file, so a missing sibling repo (e.g. ai-microservice) or a read-only
# checkout fails clearly on actual drift/missing-file findings, not on a
# permission error or a stray created directory.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC="$ROOT/shared/contracts/drills.contracts.ts"
GITHUB="$(cd "$ROOT/.." && pwd)"

TARGETS=(
  "$ROOT/content-service/src/drills/contracts.ts"
  "$ROOT/education-service/src/drills/contracts.ts"
  "$ROOT/notification-service/src/drills/contracts.ts"
  "$ROOT/frontend/lib/drills/contracts.ts"
  "$GITHUB/ai-microservice/src/teacher-assistant/contracts.ts"
)

CHECK_ONLY=0
[[ "${1:-}" == "--check" ]] && CHECK_ONLY=1

fail=0
for t in "${TARGETS[@]}"; do
  if [[ $CHECK_ONLY -eq 1 ]]; then
    if [[ ! -f "$t" ]]; then
      echo "MISSING: $t does not exist (expected a synced copy of $SRC)"
      fail=1
    elif ! diff -q "$SRC" "$t" >/dev/null 2>&1; then
      echo "DRIFT: $t differs from $SRC"
      fail=1
    fi
  else
    mkdir -p "$(dirname "$t")"
    cp "$SRC" "$t"
    echo "synced -> $t"
  fi
done

if [[ $CHECK_ONLY -eq 0 ]]; then
  sha256sum "$SRC" | awk '{print $1}' > "$ROOT/shared/contracts/drills.contracts.sha256"
fi
exit $fail
