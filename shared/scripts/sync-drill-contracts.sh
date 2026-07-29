#!/usr/bin/env bash
# Vendor the drill contracts into every consumer. Idempotent.
# --check exits non-zero when any copy has drifted from the source.
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
  mkdir -p "$(dirname "$t")"
  if [[ $CHECK_ONLY -eq 1 ]]; then
    if ! diff -q "$SRC" "$t" >/dev/null 2>&1; then
      echo "DRIFT: $t differs from $SRC"
      fail=1
    fi
  else
    cp "$SRC" "$t"
    echo "synced -> $t"
  fi
done

sha256sum "$SRC" | awk '{print $1}' > "$ROOT/shared/contracts/drills.contracts.sha256"
exit $fail
