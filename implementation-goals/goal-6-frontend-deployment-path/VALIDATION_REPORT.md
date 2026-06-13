# Goal 6 Frontend Deployment Path Validation Report

Status: discovered-gap
Date: 2026-06-13

## Scope

Owner requested locating the frontend deployment path before cutover. This was read-only discovery; no deployment or routing change was performed.

## Evidence

- Active Agents marker: None.
- DocsRAG retrieval from deployment/speakasap returned HTTP 200; token values were not printed.
- Source path: /home/ssf/Documents/Github/speakasap/frontend.
- Frontend package: Next.js app with package scripts dev/build/start.
- Public route: ingress speakasap routes speakasap.alfares.cz to service speakasap port 3000.
- Live deployment: deployment/speakasap in namespace statex-apps, image localhost:5000/speakasap:latest, 1/1 ready.
- Root Dockerfile: builds api-gateway from api-gateway/package*.json and api-gateway/src.
- Live pod package.json name: api-gateway.
- Public GET https://speakasap.alfares.cz/ returned Express JSON 404, confirming the root host is not serving the Next frontend.
- No speakasap-frontend deployment/service/ingress, frontend Dockerfile, or deploy-frontend script was found in the SpeakASAP repository.

## Decision

Frontend source is located, but the deployment path is missing. Cutover should not proceed until SpeakASAP has an explicit frontend deployment strategy and smoke evidence.

## Required Follow-up

Implement one of these paths before cutover:

- Dedicated frontend service: add frontend Dockerfile, k8s/services/frontend or k8s/frontend deployment/service, update ingress routing to frontend and API routing to api-gateway.
- Root app replacement: change root Dockerfile/deployment so localhost:5000/speakasap:latest builds and serves frontend, with API routes explicitly proxied to api-gateway.

Either option needs npm build, Docker build/push, Kubernetes rollout, public / smoke, and gateway API smoke before cutover.
