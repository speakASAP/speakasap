# Frontend Deployment Path

Date: 2026-06-13
Goal: 6.1 - frontend deployment path before SpeakASAP cutover.

## Decision

Deploy the Next.js frontend as a separate Kubernetes workload named `speakasap-frontend` on port `4211`. Keep the API gateway as `speakasap-api-gateway` on port `4210`. Route public `https://speakasap.alfares.cz/health` and `https://speakasap.alfares.cz/api` to the gateway, and route `/` to the frontend.

This preserves the API gateway boundary for browser API calls, preserves the existing public gateway health check, and avoids reusing the root `speakasap` image, which currently builds and serves the api-gateway runtime.

## Files

- `frontend/Dockerfile` builds the Next standalone runtime with `NEXT_PUBLIC_API_URL=https://speakasap.alfares.cz`.
- `frontend/next.config.ts` enables `output: "standalone"`.
- `k8s/services/frontend.yaml` defines `Deployment`, `Service`, and `ConfigMap` for `speakasap-frontend`.
- `k8s/ingress.yaml` routes `/health` and `/api` to `speakasap-api-gateway:4210` and `/` to `speakasap-frontend:4211`.
- `scripts/deploy-frontend.sh` builds, pushes, applies manifests, restarts the frontend deployment, and runs root/API smoke checks.
- `scripts/deploy.sh` includes `speakasap-frontend` in the full-platform rollout list.

## Deploy Command

```bash
ssh alfares 'cd /home/ssf/Documents/Github/speakasap && ./scripts/deploy-frontend.sh'
```

## Rollback

Restore the previous ingress backend for `/` to `service/speakasap:3000` or deploy a prior commit, then apply `k8s/ingress.yaml`. If the frontend workload itself fails, roll back only `deployment/speakasap-frontend` with `kubectl rollout undo deployment/speakasap-frontend -n statex-apps`; gateway and service-owned APIs remain unchanged.

## Smoke Evidence

Completed on 2026-06-13 after running:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/speakasap && ./scripts/deploy-frontend.sh'
```

Results:

- `frontend && npm run build` passed before deploy and inside Docker build.
- Docker image `localhost:5000/speakasap-frontend:latest` built and pushed with digest `sha256:97b3d7069530433ee65b165e5f0c33ba31acd79525939a5b4296d9973f3d35e8`.
- `deployment/speakasap-frontend` rolled out successfully in namespace `statex-apps`.
- Final pod state: `speakasap-frontend-788dbfc4b5-9s66h` `1/1 Running`, restarts `0`.
- Ingress routes: `/health -> speakasap-api-gateway:4210`, `/api -> speakasap-api-gateway:4210`, `/ -> speakasap-frontend:4211`.
- `curl -I https://speakasap.alfares.cz/` returned `HTTP/2 200`, `content-type: text/html; charset=utf-8`, `x-powered-by: Next.js`.
- `curl -I https://speakasap.alfares.cz/health` returned `HTTP/2 200`, `content-type: application/json; charset=utf-8`, `x-powered-by: Express`.
- `curl -I https://speakasap.alfares.cz/api/v1/lessons` returned `HTTP/2 401`, confirming protected gateway API routing remains enforced.

Notes:

- Docker `npm ci` reported `3 vulnerabilities (2 moderate, 1 high)` from the current frontend dependency tree; this was not remediated in the deployment-path chunk.
- RAG retrieval was attempted first and failed with curl exit code 6, so this chunk used repository and runtime evidence.
