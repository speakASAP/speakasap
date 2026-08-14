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
)

# ai-microservice is NOT a copy target. Its contracts.ts is the vendored file plus an
# `import type { LlmMeta }` and its own Analyze* request/response types appended after —
# types no other consumer has. It was in TARGETS until 2026-08-14, which made the script
# unrunnable: `cp` deleted those additions and broke that service's build, so `--check`
# reported permanent drift and nobody ran the sync at all. The four real copies then
# drifted for weeks in both directions — REMEDIAL never reached three of them, and
# education-service's blanksResolved/blanksRevealed never reached the source.
#
# It is synced as source + its own tail instead: everything from the first local
# declaration onwards is preserved, the shared part above it is replaced. `--check` holds
# the same shape, so a stale shared half is still reported as drift.
AI_TARGET="$GITHUB/ai-microservice/src/teacher-assistant/contracts.ts"
# The banner heading ai-microservice's own additions. Everything from the separator line
# above it down to EOF is local and is carried across untouched.
AI_LOCAL_MARKER="// Task 6 — error-analysis clustering (ai-microservice /teacher-assistant)"
# Inserted into the shared half, which ai-microservice's local types depend on.
AI_LOCAL_IMPORT="import type { LlmMeta } from './llm.client';"

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

# Builds what ai-microservice's contracts.ts must contain: the shared source with the
# LlmMeta import inserted after its header, then that file's own local section verbatim.
# Written to stdout; the caller decides whether to compare it or install it.
compose_ai() {
  local target="$1"
  local marker_line sep_line
  marker_line="$(grep -n -F -x -- "$AI_LOCAL_MARKER" "$target" | cut -d: -f1)"
  if [[ -z "$marker_line" ]]; then
    echo "MISSING MARKER: $target has no line '$AI_LOCAL_MARKER'" >&2
    return 1
  fi
  # The separator comment directly above the banner opens the local section.
  sep_line=$((marker_line - 1))

  # The import goes after the file header comment, where the vendored copies have their
  # first import — matching where this file already carries it.
  awk -v imp="$AI_LOCAL_IMPORT" '
    NR == FNR { src[FNR] = $0; n = FNR; next }
    END {
      for (i = 1; i <= n; i++) {
        print src[i]
        if (src[i] == " */" && !done) { print ""; print imp; done = 1 }
      }
    }
  ' "$SRC" /dev/null
  tail -n "+$sep_line" "$target"
}

sync_ai() {
  local target="$1" composed
  if [[ ! -f "$target" ]]; then
    if [[ $CHECK_ONLY -eq 1 ]]; then
      echo "MISSING: $target does not exist"
      fail=1
    else
      echo "SKIP: $target does not exist (sibling repo not checked out)"
    fi
    return 0
  fi
  composed="$(compose_ai "$target")" || { fail=1; return 0; }
  if [[ $CHECK_ONLY -eq 1 ]]; then
    if ! diff -q <(printf '%s\n' "$composed") "$target" >/dev/null 2>&1; then
      echo "DRIFT: $target's shared half differs from $SRC"
      fail=1
    fi
  else
    printf '%s\n' "$composed" > "$target"
    echo "synced (shared half only) -> $target"
  fi
}

sync_one "$SRC" "${TARGETS[@]}"
sync_one "$EDIT_SRC" "${EDIT_TARGETS[@]}"
sync_ai "$AI_TARGET"

if [[ $CHECK_ONLY -eq 0 ]]; then
  sha256sum "$SRC" | awk '{print $1}' > "$ROOT/shared/contracts/drills.contracts.sha256"
  sha256sum "$EDIT_SRC" | awk '{print $1}' > "$ROOT/shared/contracts/drills.sentence-editing.sha256"
fi
exit $fail
