# Seven Frontend/API Deployment Approval Packet

Date: 2026-06-13
Status: draft approval packet; no deployment or route change has run in this chunk.

## Request

After schema readiness, seven data apply, and media copy/routing gates are complete, approve a scoped deployment of only the services required for the seven-course public frontend/API:

- `speakasap-content` for `/api/v1/seven` public content reads.
- `speakasap-api-gateway` for `/api/v1/seven` upstream routing and anonymous `GET` access.
- `speakasap-frontend` for `/<languageCode>/seven` and `/<languageCode>/seven/<order>` pages.

This approval must not restart all SpeakASAP services via the broad root `scripts/deploy.sh`; that script applies/restarts every service and is too broad for this migration slice unless separately approved.

## Preconditions

Before deployment approval:

- `CONTENT_BASE_SCHEMA_APPROVAL.md` is completed and post-schema no-write reconciliation is clean.
- `SEVEN_DATA_MIGRATION_APPROVAL.md` is completed and post-apply no-write reconciliation shows planned rows exist.
- `SEVEN_MEDIA_MIGRATION_APPROVAL.md` is completed or every unresolved media ref has a documented fallback decision.
- `cd content-service && npm run prisma:validate && npm run build` passes.
- `cd api-gateway && npm run build` passes.
- `cd frontend && npm run build` passes.
- Current deployment images/digests are recorded for rollback.

## Current Baseline Smoke

Current deployed state is not yet ready for seven:

- `/tmp/speakasap-seven-deployment-smoke-current-v1.json` recorded `writes=false`, overall `ok=false`.
- Statuses: `health=200`, `courseApi=401`, `lessonsApi=401`, `lessonApi=401`, `coursePage=404`, `lessonPage=404`, `pdfHead=404`, `audioHead=404`.
- This is expected before deploying the seven gateway/frontend changes and before data/media are available.

## Proposed Scoped Deployment Shape

Use the gated deployment operator after explicit approval and after schema/data/media execution reports exist:

```bash
cd /home/ssf/Documents/Github/speakasap
SEVEN_DEPLOY_APPROVAL_TEXT='Approved to deploy only the seven-course content-service, api-gateway, and frontend changes to Kubernetes after schema/data/media gates are complete, then run the seven deployment smoke and browser typography QA. Do not restart unrelated SpeakASAP services and do not run data/media rollback or legacy route retirement.' \
SCHEMA_EXECUTION_REPORT=/tmp/speakasap-seven-schema-apply-execution-v1.json \
DATA_EXECUTION_REPORT=/tmp/speakasap-seven-content-apply-execution-v1.json \
MEDIA_EXECUTION_REPORT=/tmp/speakasap-seven-media-copy-execution-v1.json \
  scripts/deploy-seven-approved.sh --execute
```

The operator refuses to run without `--execute`, exact `SEVEN_DEPLOY_APPROVAL_TEXT`, and `ok=true` schema/data/media execution reports. It captures predeploy deployment JSON, builds/pushes only the scoped images, applies only the scoped service manifests plus ingress, restarts only the scoped deployments, runs the deployment smoke, and writes `/tmp/speakasap-seven-deploy-execution-v1.json`.

Use service-specific image builds/pushes and rollout restarts for only these deployments:

```bash
cd /home/ssf/Documents/Github/speakasap

# Build and push scoped images; capture digests after push.
docker build -f content-service/Dockerfile -t localhost:5000/speakasap-content:latest content-service
docker push localhost:5000/speakasap-content:latest

docker build -f api-gateway/Dockerfile -t localhost:5000/speakasap-api-gateway:latest api-gateway
docker push localhost:5000/speakasap-api-gateway:latest

IMAGE=localhost:5000/speakasap-frontend:latest PUBLIC_URL=https://speakasap.alfares.cz ./scripts/deploy-frontend.sh

# Apply only scoped manifests if config changes are needed.
kubectl apply -f k8s/services/content-service.yaml -n statex-apps
kubectl apply -f k8s/services/api-gateway.yaml -n statex-apps
kubectl apply -f k8s/services/frontend.yaml -n statex-apps
kubectl apply -f k8s/ingress.yaml -n statex-apps

kubectl rollout restart deployment/speakasap-content -n statex-apps
kubectl rollout restart deployment/speakasap-api-gateway -n statex-apps
kubectl rollout status deployment/speakasap-content -n statex-apps --timeout=180s
kubectl rollout status deployment/speakasap-api-gateway -n statex-apps --timeout=180s
kubectl rollout status deployment/speakasap-frontend -n statex-apps --timeout=180s
```

The exact commands should be refreshed at approval time based on the final image/build process and any media routing decision.

## Required Post-Deploy Smoke

Run the no-write smoke checker:

```bash
cd /home/ssf/Documents/Github/speakasap
scripts/check-seven-deployment-smoke.py --base-url https://speakasap.alfares.cz --assets-base-url https://assets.alfares.cz --language-code en --lesson-order 1 --json-report /tmp/speakasap-seven-deploy-smoke-v1.json
```

Expected post-deploy result:

- `healthOk=true`.
- `courseApiOk=true`, `lessonsApiOk=true`, `lessonApiOk=true`.
- `coursePageOk=true`, `lessonPageOk=true`.
- `pdfOk=true` and `audioOk=true` for the selected smoke language/order, or an explicit documented media fallback decision.
- Browser/rendered QA is required after this script for typography and interaction parity on desktop/mobile. Run `node scripts/check-seven-postdeploy-visual-qa.js --base-url https://speakasap.alfares.cz --language-code en --lesson-order 1 --json-report /tmp/speakasap-seven-postdeploy-visual-qa-v1.json --screenshot-dir /tmp/speakasap-seven-visual-qa-v1` and attach the JSON plus screenshots to the completion evidence.

## Rollback Boundary

Rollback must use the pre-deploy image digests/manifests captured immediately before rollout:

- Set `speakasap-content`, `speakasap-api-gateway`, and/or `speakasap-frontend` back to previous image digests.
- Reapply previous ingress/media routing manifest if changed.
- Do not rollback database rows or media objects as part of deployment rollback unless separately approved with data/media rollback evidence.

## Required Approval Wording

Use explicit wording like:

> Approved to deploy only the seven-course content-service, api-gateway, and frontend changes to Kubernetes after schema/data/media gates are complete, then run the seven deployment smoke and browser typography QA. Do not restart unrelated SpeakASAP services and do not run data/media rollback or legacy route retirement.

Without that explicit approval, do not deploy or change routing.
