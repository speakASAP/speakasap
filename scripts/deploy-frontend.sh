#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
NAMESPACE="${NAMESPACE:-statex-apps}"
IMAGE="${IMAGE:-localhost:5000/speakasap-frontend:latest}"
PUBLIC_URL="${PUBLIC_URL:-https://speakasap.alfares.cz}"

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

echo "Building $IMAGE from frontend/Dockerfile"
docker build --build-arg NEXT_PUBLIC_API_URL="$PUBLIC_URL" -f "$PROJECT_ROOT/frontend/Dockerfile" -t "$IMAGE" "$PROJECT_ROOT/frontend"

echo "Pushing $IMAGE"
docker push "$IMAGE"

echo "Applying frontend and ingress manifests"
kubectl apply -f "$PROJECT_ROOT/k8s/services/frontend.yaml" -n "$NAMESPACE"
kubectl apply -f "$PROJECT_ROOT/k8s/ingress.yaml" -n "$NAMESPACE"

echo "Restarting frontend deployment"
kubectl rollout restart deployment/speakasap-frontend -n "$NAMESPACE"
kubectl rollout status deployment/speakasap-frontend -n "$NAMESPACE" --timeout=180s

echo "Frontend pods"
kubectl get pods -n "$NAMESPACE" -l app=speakasap-frontend -o wide

smoke_head "frontend root" "$PUBLIC_URL/"
smoke_head "gateway health remains routed" "$PUBLIC_URL/health"
smoke_head "protected gateway API remains routed" "$PUBLIC_URL/api/v1/lessons" false
