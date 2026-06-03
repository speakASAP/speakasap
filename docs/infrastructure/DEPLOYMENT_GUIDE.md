# SpeakASAP Deployment Guide

## Production (Kubernetes)

All services run in the `statex-apps` namespace on k3s.

**Secrets flow:** Vault `secret/prod/speakasap` → ESO → K8s Secret `speakasap-secret` → pod `envFrom`.
See `../../../shared/docs/VAULT.md` for Vault operations.

**Deploy a service:**
```bash
# Rebuild image and push to local registry
cd <service-dir>
docker build -t localhost:5000/speakasap-<svc>:latest .
docker push localhost:5000/speakasap-<svc>:latest

# Apply manifests
kubectl apply -f k8s/ -n statex-apps

# Or rolling restart if image tag didn't change
kubectl rollout restart deployment/speakasap-<svc> -n statex-apps
kubectl rollout status deployment/speakasap-<svc> -n statex-apps
```

**Check health:**
```bash
kubectl get pods -n statex-apps -l app=speakasap-<svc>
kubectl logs -n statex-apps deployment/speakasap-<svc> --tail=50
```

**Force secret refresh (Vault → ESO):**
```bash
kubectl annotate externalsecret speakasap-secret force-sync=$(date +%s) -n statex-apps --overwrite
```

## K8s Manifests

`speakasap/k8s/` contains:
- `deployment.yaml` — pod spec, resource limits, health probes
- `service.yaml` — ClusterIP service
- `ingress.yaml` — external routing
- `configmap.yaml` — non-secret env vars
- `external-secret.yaml` — ESO → K8s Secret from Vault

Each service may have its own `k8s/` directory with service-specific manifests.

## Local Dev (Kubernetes)

```bash
# Generate .env from Vault
./shared/scripts/vault-env-gen.sh speakasap prod

# Run a specific service
cd <service-dir>
docker compose up --build
```

## Health Check

All services expose `GET /health` → 200 OK when healthy.

## Full K8s ops reference

→ `../../../shared/docs/KUBERNETES_SETUP_GUIDE.md`
