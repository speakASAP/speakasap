#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'

SERVICE_NAME="speakasap"
NAMESPACE="${NAMESPACE:-statex-apps}"

# shellcheck disable=SC1091
source "$(dirname "$PROJECT_ROOT")/shared/scripts/load-deploy-phase-timing.sh" "$PROJECT_ROOT" 2>/dev/null \
  || source "$HOME/Documents/Github/shared/scripts/load-deploy-phase-timing.sh" "$PROJECT_ROOT" \
  || { echo "Error: deploy timing library not found" >&2; exit 1; }
deploy_timing_init "$SERVICE_NAME"
K8S_DIR="$PROJECT_ROOT/k8s"
SERVICES_DIR="$K8S_DIR/services"

SPEAKASAP_SERVICES=(
  speakasap-content
  speakasap-notification
  speakasap-user
  speakasap-course
  speakasap-education
  speakasap-assessment
  speakasap-certification
  speakasap-payment
  speakasap-salary
  speakasap-financial
  speakasap-api-gateway
  speakasap-frontend
)

preflight_service_health() {
  echo -e "${YELLOW}Preflight: checking Kubernetes and current service health...${NC}"

  if ! kubectl get namespace "$NAMESPACE" >/dev/null 2>&1; then
    echo -e "${RED}Namespace not found: $NAMESPACE${NC}"
    exit 1
  fi

  if ! kubectl get nodes >/dev/null 2>&1; then
    echo -e "${RED}kubectl cannot reach cluster${NC}"
    exit 1
  fi

  BAD_PODS=$(kubectl get pods -n "$NAMESPACE" -l app="$SERVICE_NAME" --no-headers 2>/dev/null | awk '$3 ~ /Error|CrashLoopBackOff|ImagePullBackOff|CreateContainerConfigError|CreateContainerError|ErrImagePull/ {print $1}')
  if [ -n "$BAD_PODS" ]; then
    echo -e "${RED}Service has unhealthy pods before deploy:${NC}"
    kubectl get pods -n "$NAMESPACE" -l app="$SERVICE_NAME" -o wide || true
    for pod in $BAD_PODS; do
      echo -e "${YELLOW}--- describe pod/$pod ---${NC}"
      kubectl describe pod -n "$NAMESPACE" "$pod" || true
      echo -e "${YELLOW}--- logs pod/$pod (tail 80) ---${NC}"
      kubectl logs -n "$NAMESPACE" "$pod" --tail=80 || true
    done
    echo -e "${RED}Fix pod errors first, then redeploy.${NC}"
    exit 1
  fi

  echo -e "${GREEN}Preflight passed${NC}"
}


echo -e "${BLUE}==========================================================${NC}"
echo -e "${BLUE}  ${SERVICE_NAME} - Kubernetes Deployment${NC}"
echo -e "${BLUE}==========================================================${NC}"

if [ ! -d "$K8S_DIR" ]; then
  echo -e "${RED}Missing k8s directory: $K8S_DIR${NC}"
  exit 1
fi

deploy_timing_run_phase "Preflight" preflight_service_health

deploy_timing_phase_start "Apply gateway manifests"
echo -e "${YELLOW}Applying gateway manifests...${NC}"
for manifest in configmap.yaml external-secret.yaml deployment.yaml service.yaml ingress.yaml; do
  if [ -f "$K8S_DIR/$manifest" ]; then
    kubectl apply -f "$K8S_DIR/$manifest" -n "$NAMESPACE"
  fi
done
echo -e "${GREEN}OK Gateway manifests applied${NC}"
deploy_timing_phase_end "Apply gateway manifests"

deploy_timing_phase_start "Apply microservice manifests"
echo -e "${YELLOW}Applying microservice manifests...${NC}"
if [ -d "$SERVICES_DIR" ]; then
  for svc_yaml in "$SERVICES_DIR"/*.yaml; do
    kubectl apply -f "$svc_yaml" -n "$NAMESPACE"
  done
  echo -e "${GREEN}OK Microservice manifests applied${NC}"
else
  echo -e "${YELLOW}No services/ directory found, skipping${NC}"
fi
deploy_timing_phase_end "Apply microservice manifests"

deploy_timing_phase_start "Rollout restart (all services)"
# Serialized on purpose. Restarting every deployment at once creates one surge
# pod per service simultaneously; this node runs at its pod ceiling (110), so
# the surge pods cannot schedule until old pods terminate and the rollouts
# deadlock on each other. That is the failure documented in
# shared/docs/DEPLOY_STANDARD.md — FailedCreatePodSandBox / "name is reserved" /
# "Too many pods". Observed 2026-08-01: a routine speakasap deploy took ~40
# minutes and reported success while the old images were still serving.
#
# One at a time, each gated on real convergence. wait-for-rollout.sh is used
# rather than `kubectl rollout status` because readyReplicas is satisfied by the
# OLD pod mid-rollout, so status returns success before the new pod exists.
WAIT_FOR_ROLLOUT="/home/ssf/Documents/Github/shared/scripts/wait-for-rollout.sh"
ROLLOUT_TIMEOUT="${ROLLOUT_TIMEOUT:-300}"

restart_and_wait() {
  local svc="$1"
  kubectl get deployment "$svc" -n "$NAMESPACE" >/dev/null 2>&1 || return 0
  echo -e "${YELLOW}  ${svc}: restarting...${NC}"
  kubectl rollout restart deployment/"$svc" -n "$NAMESPACE" >/dev/null
  if [ -x "$WAIT_FOR_ROLLOUT" ]; then
    if bash "$WAIT_FOR_ROLLOUT" -n "$NAMESPACE" -t "$ROLLOUT_TIMEOUT" "$svc" >/dev/null 2>&1; then
      echo -e "${GREEN}  ${svc}: converged${NC}"
    else
      echo -e "${RED}  ${svc}: DID NOT CONVERGE within ${ROLLOUT_TIMEOUT}s${NC}"
      return 1
    fi
  else
    echo -e "${RED}  ${WAIT_FOR_ROLLOUT} missing — cannot gate on convergence${NC}"
    return 1
  fi
}

echo -e "${YELLOW}Rolling speakasap deployments one at a time...${NC}"
FAILED_SERVICES=()
restart_and_wait "$SERVICE_NAME" || FAILED_SERVICES+=("$SERVICE_NAME")
for svc in "${SPEAKASAP_SERVICES[@]}"; do
  restart_and_wait "$svc" || FAILED_SERVICES+=("$svc")
done
if [ ${#FAILED_SERVICES[@]} -gt 0 ]; then
  echo -e "${RED}Services that did not converge: ${FAILED_SERVICES[*]}${NC}"
  exit 1
fi
echo -e "${GREEN}OK All speakasap deployments converged${NC}"
deploy_timing_phase_end "Rollout restart (all services)"

deploy_timing_phase_start "Wait for gateway rollout"
echo -e "${YELLOW}Waiting for gateway rollout...${NC}"
deploy_timing_k8s_rollout_wait kubectl "$SERVICE_NAME" "$NAMESPACE"
echo -e "${GREEN}OK Gateway rollout complete${NC}"
deploy_timing_phase_end "Wait for gateway rollout"

deploy_timing_phase_start "Post-deploy status"
echo -e "${YELLOW}Current speakasap pods:${NC}"
kubectl get pods -n "$NAMESPACE" | grep speakasap || true
deploy_timing_phase_end "Post-deploy status"

deploy_timing_finish_success "speakasap"
DEPLOY_TIMING_FINISHED=1
exit 0
