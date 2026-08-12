# deploy.config.sh — declaration consumed by shared/scripts/deploy.sh.
# See shared/docs/DEPLOY_STANDARDIZATION_REPORT.md section 6/7 for the design.
# `shared/scripts/deploy.sh speakasap` is the live, authoritative deploy path.
# scripts/deploy.sh is retired and now refuses to run — it built nothing.
#
# Why this exists: every speakasap deployment ran on a mutable :latest tag, so
# the running version was not identifiable from the tag and there was nothing
# to roll back to. The runner tags each image :$IMAGE_TAG and :latest, then
# `kubectl set image` to the real tag.
#
# History, and why the accumulated drift is large:
#
# The retired scripts/deploy.sh built nothing. It applied manifests and issued
# `kubectl rollout restart`, so the pods re-pulled whatever :latest already
# pointed at, and nothing rebuilt these images for weeks while it reported
# success. Measured 2026-07-20: the root speakasap image predated its source by
# ~3 months, financial by ~29 days, assessment/course by ~18. Measured again
# 2026-08-03: speakasap-education was 27 commits behind main.
#
# A run through this runner therefore rebuilds all twelve from current source
# and ships that accumulated drift at once, across payment, financial and user
# services simultaneously. Do not treat a first runner deploy after a long gap
# as routine — deploy per service, or get the owner's explicit sign-off on the
# accumulated diff first.

SERVICE_NAME="speakasap"
PORT="3000"

# "image-name|build-context|dockerfile|extra-args"
# Empty dockerfile defaults to <build-context>/Dockerfile.
IMAGES=(
  "speakasap|.||"
  "speakasap-api-gateway|api-gateway||"
  "speakasap-assessment|assessment-service||"
  "speakasap-certification|certification-service||"
  "speakasap-content|content-service||"
  "speakasap-course|course-service||"
  "speakasap-education|education-service||"
  "speakasap-financial|financial-service||"
  "speakasap-frontend|frontend||--build-arg NEXT_PUBLIC_API_URL=https://speakasap.alfares.cz"
  "speakasap-notification|notification-service||"
  "speakasap-payment|payment-service||"
  "speakasap-salary|salary-service||"
  "speakasap-user|user-service||"
)

# "k8s-deployment|container|image-name"
DEPLOYMENTS=(
  "speakasap|app|speakasap"
  "speakasap-api-gateway|app|speakasap-api-gateway"
  "speakasap-assessment|app|speakasap-assessment"
  "speakasap-certification|app|speakasap-certification"
  "speakasap-content|app|speakasap-content"
  "speakasap-course|app|speakasap-course"
  "speakasap-education|app|speakasap-education"
  "speakasap-financial|app|speakasap-financial"
  "speakasap-frontend|app|speakasap-frontend"
  "speakasap-notification|app|speakasap-notification"
  "speakasap-payment|app|speakasap-payment"
  "speakasap-salary|app|speakasap-salary"
  "speakasap-user|app|speakasap-user"
)

# speakasap-frontend was previously excluded here and left to
# scripts/deploy-frontend.sh, on the reasoning that two build paths for one
# deployment is worse than one manual step. In practice the manual step is the
# one that gets skipped: a full runner deploy on 2026-08-12 shipped all twelve
# services at 3a27d0f and left the frontend running 08c0361, because nothing in
# the deploy path mentions it. That is the same class of failure as the retired
# scripts/deploy.sh — a green banner over a service that did not ship.
#
# The runner covers what deploy-frontend.sh does: `extra-args` above carries the
# NEXT_PUBLIC_API_URL build arg, and deploy-lib/build.sh already dual-tags
# :latest, so services/frontend.yaml's :latest bootstrap reference stays current
# and the DEPLOYMENTS entry sets the real tag after the apply. The end-to-end
# smoke checks deploy-frontend.sh ran are in deploy_post_verify below.
#
# scripts/deploy-frontend.sh is kept for frontend-only deploys and rollbacks
# (`TAG_OVERRIDE=<tag> scripts/deploy-frontend.sh`), which the runner cannot do
# per-service. Both paths compute the tag with deploy_compute_default_tag and
# push the same names, so they agree on what is running.
#
# Deliberately absent from both arrays:
#
#   speakasap-assets — runs upstream nginx:1.27-alpine, not an image we build.

# Gateway manifests first, then the per-service ones, matching the order in
# scripts/deploy.sh (which applies k8s/*.yaml before k8s/services/*.yaml).
MANIFESTS=(
  configmap.yaml
  external-secret.yaml
  deployment.yaml
  service.yaml
  ingress.yaml
  services/api-gateway.yaml
  services/assessment-service.yaml
  services/assets-service.yaml
  services/certification-service.yaml
  services/content-service.yaml
  services/course-service.yaml
  services/education-service.yaml
  services/financial-service.yaml
  services/frontend.yaml
  services/notification-service.yaml
  services/payment-service.yaml
  services/salary-service.yaml
  services/user-service.yaml
)

# "deployment|source-dir" for every service owning a Prisma schema. Checked by
# deploy_preflight_migrations, which refuses the deploy when the live database
# is missing a migration present here — the state that shipped an image into a
# database with no drill tables on 2026-08-03.
PRISMA_SERVICES=(
  "speakasap-assessment|assessment-service"
  "speakasap-certification|certification-service"
  "speakasap-content|content-service"
  "speakasap-course|course-service"
  "speakasap-education|education-service"
  "speakasap-financial|financial-service"
  "speakasap-notification|notification-service"
  "speakasap-payment|payment-service"
  "speakasap-salary|salary-service"
  "speakasap-user|user-service"
)

deploy_preflight() {
  # check-hosted-auth-contract.py resolves its targets relative to the current
  # directory (Path("frontend/lib/auth-session.ts") and friends), so it must run
  # from the repo root. The shared runner does not chdir, and from anywhere else
  # every file reads as missing and the check fails with a contract report that
  # looks like a real regression rather than a path problem.
  ( cd "$PROJECT_ROOT" && python3 scripts/check-hosted-auth-contract.py )
}

# End-to-end smoke checks through the public domain, carried over from
# scripts/deploy-frontend.sh. deploy_verify_health only reads containerStatuses
# from the API server, so a frontend that starts but does not serve — or an
# ingress that stopped routing the gateway — would pass it. These go over
# PUBLIC_URL and fail the deploy.
SPEAKASAP_PUBLIC_URL="${PUBLIC_URL:-https://speakasap.alfares.cz}"

speakasap_smoke_head() {
  local label="$1" url="$2" fail_on_error="${3:-true}"
  local attempt output status=0

  echo "Smoke: $label"
  for attempt in 1 2 3 4 5; do
    if [ "$fail_on_error" = "true" ]; then
      if output="$(curl -fsS -I "$url" 2>&1)"; then
        printf '%s\n' "$output" | sed -n "1,12p"
        return 0
      fi
    else
      # Unauthenticated 401/403 is a routed endpoint, which is what this asserts;
      # only a connection-level failure counts as broken.
      if output="$(curl -sS -I "$url" 2>&1)"; then
        printf '%s\n' "$output" | sed -n "1,12p"
        return 0
      fi
    fi
    status=$?
    echo "Smoke attempt $attempt failed for $url: $output" >&2
    sleep 5
  done
  return "$status"
}

deploy_post_verify() {
  speakasap_smoke_head "frontend root" "${SPEAKASAP_PUBLIC_URL}/"
  speakasap_smoke_head "gateway health remains routed" "${SPEAKASAP_PUBLIC_URL}/health"
  speakasap_smoke_head "protected gateway API remains routed" "${SPEAKASAP_PUBLIC_URL}/api/v1/lessons" false
}
