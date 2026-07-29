#!/usr/bin/env bash
# Run one npm script across every package that defines it.
# Continues past failures and reports a summary, so one broken service
# does not hide the state of the other eleven.
#
# For the "test" script specifically, a package with zero spec/test files
# passes via --passWithNoTests (jest and vitest both accept the flag)
# rather than failing the whole repo-wide gate. That flag is itself a
# false-green risk once a package has real tests (a broken config that
# discovers 0 suites would report green same as a real pass), so this
# script detects the zero-suite case from the runner's own output and
# reports it separately instead of letting it look identical to a real
# pass with test suites in it.
set -uo pipefail

SCRIPT="${1:?usage: run-all.sh <npm-script>}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PACKAGES=(api-gateway assessment-service certification-service content-service
          course-service education-service financial-service notification-service
          payment-service salary-service user-service frontend)

failed=()
no_tests=()
for p in "${PACKAGES[@]}"; do
  [[ -f "$ROOT/$p/package.json" ]] || continue
  if ! node -e "process.exit(require('$ROOT/$p/package.json').scripts?.['$SCRIPT']?0:1)"; then
    echo "SKIP  $p (no '$SCRIPT' script)"
    continue
  fi
  echo "=== $p: npm run $SCRIPT"
  output="$(npm --prefix "$ROOT/$p" run "$SCRIPT" --silent 2>&1)"
  status=$?
  echo "$output"
  if [[ $status -eq 0 ]]; then
    if [[ "$SCRIPT" == "test" ]] && echo "$output" | grep -qE "No tests found|No test files found"; then
      echo "PASS  $p (0 suites)"
      no_tests+=("$p")
    else
      echo "PASS  $p"
    fi
  else
    echo "FAIL  $p"
    failed+=("$p")
  fi
done

echo
echo "--- summary: ${#failed[@]} failed"
for f in "${failed[@]}"; do echo "  FAIL $f"; done

echo
echo "--- packages with zero test suites: ${#no_tests[@]}"
for n in "${no_tests[@]}"; do echo "  $n"; done

[[ ${#failed[@]} -eq 0 ]]
