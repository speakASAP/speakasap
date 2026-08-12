#!/bin/bash
# Frontend-only deploy and rollback path.
#
# As of 2026-08-12 speakasap-frontend is ALSO built, pushed and rolled out by
# the shared runner (`shared/scripts/deploy.sh speakasap`), declared in
# deploy.config.sh. It was previously absent from there, so a full-repo deploy
# left the frontend behind on an older tag.
#
# Use this script when you want the frontend alone — notably a rollback:
#
#     TAG_OVERRIDE=<previous-tag> scripts/deploy-frontend.sh
#
# Both paths compute the tag with deploy_compute_default_tag and push the same
# image names, so they cannot disagree about what is running. Keep the build
# arguments here in sync with the IMAGES entry in deploy.config.sh.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Hand-written script with real build/apply logic, so it needs the guard: without it
# `DRY_RUN=1` here would perform a real production deploy while the caller believed
# otherwise. See the 2026-08-03 findings, Finding 2.
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../../shared/scripts/deploy-lib/dry-run-guard.sh"
deploy_dry_run_guard "$@"

PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
NAMESPACE="${NAMESPACE:-statex-apps}"
PUBLIC_URL="${PUBLIC_URL:-https://speakasap.alfares.cz}"
IMAGE_REPO="${IMAGE_REPO:-localhost:5000/speakasap-frontend}"

# Tag from git, the same way the shared runner tags every other service.
#
# A ":latest" tag makes the running image untraceable to a commit and leaves
# nothing to roll back to, because each build silently replaces the previous
# one under the same name. deploy_compute_default_tag also appends -wt<stamp>
# for a dirty tree, so an uncommitted change still produces a new tag rather
# than a `kubectl set image` no-op that keeps the old image running.
# shellcheck disable=SC1091
source "$PROJECT_ROOT/../shared/scripts/deploy-lib/tag.sh"
IMAGE_TAG="${TAG_OVERRIDE:-$(deploy_compute_default_tag "$PROJECT_ROOT")}"
IMAGE="${IMAGE:-${IMAGE_REPO}:${IMAGE_TAG}}"

echo "Tag: ${IMAGE_TAG}"

smoke_head() {
  local label="$1"
  local url="$2"
  local fail_on_error="${3:-true}"
  local attempt
  local output
  local status=0

  echo "Smoke: $label"
  for attempt in 1 2 3 4 5; do
    if [ "$fail_on_error" = "true" ]; then
      if output="$(curl -fsS -I "$url" 2>&1)"; then
        printf '%s
' "$output" | sed -n "1,12p"
        return 0
      fi
    else
      if output="$(curl -sS -I "$url" 2>&1)"; then
        printf '%s
' "$output" | sed -n "1,12p"
        return 0
      fi
    fi
    status=$?
    echo "Smoke attempt $attempt failed for $url: $output" >&2
    sleep 5
  done
  return "$status"
}

echo "Checking hosted Auth frontend contract"
"$PROJECT_ROOT/scripts/check-hosted-auth-contract.py"

# Tag :latest alongside the real tag, as the shared runner does.
#
# k8s/services/frontend.yaml carries :latest as its bootstrap image. If only
# the SHA tag were pushed, that bootstrap reference would rot to whatever was
# built last time, and a plain `kubectl apply -f` outside this script would
# quietly roll production back to a stale image.
echo "Building $IMAGE from frontend/Dockerfile"
docker build --build-arg NEXT_PUBLIC_API_URL="$PUBLIC_URL" \
  -f "$PROJECT_ROOT/frontend/Dockerfile" \
  -t "$IMAGE" -t "${IMAGE_REPO}:latest" \
  "$PROJECT_ROOT/frontend"

echo "Pushing $IMAGE and ${IMAGE_REPO}:latest"
docker push "$IMAGE"
docker push "${IMAGE_REPO}:latest"

echo "Applying frontend and ingress manifests"
kubectl apply -f "$PROJECT_ROOT/k8s/services/frontend.yaml" -n "$NAMESPACE"
kubectl apply -f "$PROJECT_ROOT/k8s/ingress.yaml" -n "$NAMESPACE"

# Point the deployment at this exact tag. The manifest above still carries a
# bootstrap image reference, so this must run after the apply, not before.
# This replaces `rollout restart`: with a real tag the image reference itself
# changes, which is what makes the rollout meaningful and reversible.
echo "Setting frontend image to $IMAGE"
kubectl set image deployment/speakasap-frontend \
  "$(kubectl get deployment/speakasap-frontend -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].name}')=$IMAGE" \
  -n "$NAMESPACE"
# Not `kubectl rollout status`: it returns a stale error instantly once a deployment has
# ever hit progressDeadlineExceeded, so it reports failure on a rollout that is fine.
"$PROJECT_ROOT/../shared/scripts/wait-for-rollout.sh" -n "$NAMESPACE" -t 240 speakasap-frontend

echo "Frontend pods"
kubectl get pods -n "$NAMESPACE" -l app=speakasap-frontend -o wide

smoke_head "frontend root" "$PUBLIC_URL/"
smoke_head "gateway health remains routed" "$PUBLIC_URL/health"
smoke_head "protected gateway API remains routed" "$PUBLIC_URL/api/v1/lessons" false

echo "Tag: ${IMAGE_TAG}"
echo "Roll back with: TAG_OVERRIDE=<previous-tag> $0"
