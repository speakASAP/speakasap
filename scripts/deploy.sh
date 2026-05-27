#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'

SERVICE_NAME="speakasap"
NAMESPACE="${NAMESPACE:-statex-apps}"
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

preflight_service_health

echo -e "${YELLOW}[1/5] Applying gateway manifests...${NC}"
for manifest in configmap.yaml external-secret.yaml deployment.yaml service.yaml ingress.yaml; do
  if [ -f "$K8S_DIR/$manifest" ]; then
    kubectl apply -f "$K8S_DIR/$manifest" -n "$NAMESPACE"
  fi
done
echo -e "${GREEN}OK Gateway manifests applied${NC}"

echo -e "${YELLOW}[2/5] Applying microservice manifests...${NC}"
if [ -d "$SERVICES_DIR" ]; then
  for svc_yaml in "$SERVICES_DIR"/*.yaml; do
    kubectl apply -f "$svc_yaml" -n "$NAMESPACE"
  done
  echo -e "${GREEN}OK Microservice manifests applied${NC}"
else
  echo -e "${YELLOW}No services/ directory found, skipping${NC}"
fi

echo -e "${YELLOW}[3/5] Triggering rollout restart for all speakasap deployments...${NC}"
kubectl rollout restart deployment/"$SERVICE_NAME" -n "$NAMESPACE"
for svc in "${SPEAKASAP_SERVICES[@]}"; do
  if kubectl get deployment "$svc" -n "$NAMESPACE" >/dev/null 2>&1; then
    kubectl rollout restart deployment/"$svc" -n "$NAMESPACE"
  fi
done
echo -e "${GREEN}OK Rollout restarts triggered${NC}"

echo -e "${YELLOW}[4/5] Waiting for gateway rollout...${NC}"
if ! kubectl rollout status deployment/"$SERVICE_NAME" -n "$NAMESPACE" --timeout=120s; then
  echo -e "${YELLOW}Rollout did not complete in time. Diagnosing terminating pods...${NC}"
  kubectl get pods -n "$NAMESPACE" -l app="$SERVICE_NAME" -o wide || true
  TERMINATING_PODS=$(kubectl get pods -n "$NAMESPACE" -l app="$SERVICE_NAME" --no-headers 2>/dev/null | awk '$3=="Terminating"{print $1}')
  if [ -n "$TERMINATING_PODS" ]; then
    echo -e "${YELLOW}Force deleting stuck terminating pods...${NC}"
    for pod in $TERMINATING_PODS; do
      kubectl delete pod -n "$NAMESPACE" "$pod" --grace-period=0 --force || true
    done
  fi
  kubectl rollout status deployment/"$SERVICE_NAME" -n "$NAMESPACE" --timeout=120s
fi
echo -e "${GREEN}OK Gateway rollout complete${NC}"

echo -e "${YELLOW}[5/5] Current speakasap pods:${NC}"
kubectl get pods -n "$NAMESPACE" | grep speakasap

echo -e "${GREEN}==========================================================${NC}"
echo -e "${GREEN}  Deployment successful${NC}"
echo -e "${GREEN}==========================================================${NC}"
