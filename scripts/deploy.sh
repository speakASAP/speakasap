#!/bin/bash
# speakasap/scripts/deploy.sh — RETIRED. Do not restore the old contents.
#
# This script applied manifests and ran `kubectl rollout restart`. It never
# contained a `docker build`, so the pods re-pulled whatever tag the manifest
# already named. Running it after a code change shipped NOTHING while printing
# a green success banner.
#
# Measured 2026-08-03: production was serving speakasap-education:4ed5579,
# two days and 27 commits behind main, having been "deployed" repeatedly.
#
# The working path builds and pushes all twelve images, then `kubectl set image`
# to the real git SHA. It reads speakasap/deploy.config.sh and takes the
# ecosystem-wide deploy lock:
#
#     /home/ssf/Documents/Github/shared/scripts/deploy.sh speakasap
#
# A stub that exec'd the shared runner was considered and rejected: the two
# scripts do not take the same arguments, and silently redirecting a deploy is
# how the wrong mental model survives. This refuses loudly instead.
set -euo pipefail

SHARED_RUNNER="/home/ssf/Documents/Github/shared/scripts/deploy.sh"

cat >&2 <<EOF
speakasap/scripts/deploy.sh is retired — it built nothing and shipped nothing.

Use the shared runner, which builds, pushes and sets images by git SHA:

    ${SHARED_RUNNER} speakasap

Add --dry-run to see every docker/kubectl command without executing any of them.
EOF

exit 1
