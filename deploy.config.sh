# deploy.config.sh — declaration consumed by shared/scripts/deploy.sh.
# See shared/docs/DEPLOY_STANDARDIZATION_REPORT.md section 6/7 for the design.
# scripts/deploy.sh is still the live, authoritative deploy path.
#
# Why this exists: every speakasap deployment ran on a mutable :latest tag, so
# the running version was not identifiable from the tag and there was nothing
# to roll back to. The runner tags each image :$IMAGE_TAG and :latest, then
# `kubectl set image` to the real tag.
#
# READ BEFORE FIRST USE — this changes deploy semantics:
#
# scripts/deploy.sh does NOT build anything. It applies manifests and issues
# `kubectl rollout restart`, so the pods re-pull whatever :latest already
# pointed at. Nothing has rebuilt these images in weeks, and production is
# running code substantially older than this repository (measured 2026-07-20:
# the root speakasap image predates its source by ~3 months, financial by ~29
# days, assessment/course by ~18). The first run through this runner rebuilds
# all twelve from current source and ships that drift at once, across payment,
# financial and user services simultaneously.
#
# Do not treat the first runner deploy as routine. Deploy per service, or get
# the owner's explicit sign-off on the accumulated diff first.

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
  "speakasap-notification|app|speakasap-notification"
  "speakasap-payment|app|speakasap-payment"
  "speakasap-salary|app|speakasap-salary"
  "speakasap-user|app|speakasap-user"
)

# Deliberately absent from both arrays:
#
#   speakasap-frontend — owned by scripts/deploy-frontend.sh, which already
#     computes a git tag and dual-tags :latest. Declaring it here too would
#     give one deployment two build paths. services/frontend.yaml is likewise
#     left out of MANIFESTS below: that manifest pins :latest as its bootstrap
#     image, and applying it here without a matching set-image entry would
#     silently reset the frontend deployment off its traceable tag.
#     deploy-frontend.sh applies that manifest itself.
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
  services/notification-service.yaml
  services/payment-service.yaml
  services/salary-service.yaml
  services/user-service.yaml
)

deploy_preflight() {
  # check-hosted-auth-contract.py resolves its targets relative to the current
  # directory (Path("frontend/lib/auth-session.ts") and friends), so it must run
  # from the repo root. The shared runner does not chdir, and from anywhere else
  # every file reads as missing and the check fails with a contract report that
  # looks like a real regression rather than a path problem.
  ( cd "$PROJECT_ROOT" && python3 scripts/check-hosted-auth-contract.py )
}
