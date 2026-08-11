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

# Sentence editing shares the contracts' fate: the rules deciding whether a teacher's
# sentence is a valid drill must be identical in the browser and in both services that
# accept a write, or one of them accepts what another rejects. It imports from
# ./contracts, so every target sits beside a synced contracts.ts. ai-microservice is
# absent deliberately — it generates sentences, it never accepts a teacher's edit.
EDIT_SRC="$ROOT/shared/contracts/drills.sentence-editing.ts"
EDIT_TARGETS=(
  "$ROOT/content-service/src/drills/sentence-editing.ts"
  "$ROOT/education-service/src/drills/sentence-editing.ts"
  "$ROOT/frontend/lib/drills/sentence-editing.ts"
)

CHECK_ONLY=0
[[ "${1:-}" == "--check" ]] && CHECK_ONLY=1

fail=0

# $1 = source file, rest = targets. Same semantics as before for each pair.
sync_one() {
  local src="$1"; shift
  local t
  for t in "$@"; do
    if [[ $CHECK_ONLY -eq 1 ]]; then
      if [[ ! -f "$t" ]]; then
        echo "MISSING: $t does not exist (expected a synced copy of $src)"
        fail=1
      elif ! diff -q "$src" "$t" >/dev/null 2>&1; then
        echo "DRIFT: $t differs from $src"
        fail=1
      fi
    else
      mkdir -p "$(dirname "$t")"
      cp "$src" "$t"
      echo "synced -> $t"
    fi
  done
}

sync_one "$SRC" "${TARGETS[@]}"
sync_one "$EDIT_SRC" "${EDIT_TARGETS[@]}"

if [[ $CHECK_ONLY -eq 0 ]]; then
  sha256sum "$SRC" | awk '{print $1}' > "$ROOT/shared/contracts/drills.contracts.sha256"
  sha256sum "$EDIT_SRC" | awk '{print $1}' > "$ROOT/shared/contracts/drills.sentence-editing.sha256"
fi
exit $fail
