#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
NAMESPACE="${NAMESPACE:-statex-apps}"
IMAGE="${IMAGE:-localhost:5000/speakasap-frontend:latest}"
PUBLIC_URL="${PUBLIC_URL:-https://speakasap.alfares.cz}"

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

echo "Smoke: frontend root"
curl -fsS -I "$PUBLIC_URL/" | sed -n "1,12p"

echo "Smoke: gateway health remains routed"
curl -fsS -I "$PUBLIC_URL/health" | sed -n "1,12p"

echo "Smoke: protected gateway API remains routed"
curl -sS -I "$PUBLIC_URL/api/v1/lessons" | sed -n "1,12p"
