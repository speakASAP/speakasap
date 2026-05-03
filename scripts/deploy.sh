#!/bin/bash
# SpeakASAP Application Deployment Script
# Deploys the speakasap application to production using the
# nginx-microservice blue/green deployment system.
#
# The script automatically detects the nginx-microservice location and
# calls the deploy-smart.sh script to perform the deployment.

set -e

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load NODE_ENV from .env file to determine environment
NODE_ENV=""
if [ -f "$PROJECT_ROOT/.env" ]; then
    set -a
    # shellcheck source=/dev/null
    source "$PROJECT_ROOT/.env" 2>/dev/null || true
    set +a
    NODE_ENV="${NODE_ENV:-}"
fi

# Pull from remote in production; preserve local changes (stash uncommitted if any, then reapply).
# Only sync if NODE_ENV is set to "production"
if [ -d ".git" ]; then
    if [ "$NODE_ENV" = "production" ]; then
        echo -e "${BLUE}Production environment detected (NODE_ENV=production)${NC}"
        echo -e "${BLUE}Pulling from remote (local changes preserved)...${NC}"
        git fetch origin
        BRANCH=$(git rev-parse --abbrev-ref HEAD)
        STASHED=0
        if [ -n "$(git status --porcelain)" ]; then
            git stash push -u -m "deploy.sh: stash before pull"
            STASHED=1
        fi
        if ! git pull origin "$BRANCH"; then
            echo -e "${RED}❌ git pull failed.${NC}"
            if [ "$STASHED" = "1" ]; then
                echo -e "${YELLOW}Re-applying stashed local changes...${NC}"
                if ! git stash pop; then
                    echo -e "${RED}❌ stash pop failed after pull error. Inspect: git status; git stash list${NC}"
                fi
            fi
            exit 1
        fi
        if [ "$STASHED" = "1" ]; then
            if ! git stash pop; then
                echo -e "${RED}❌ stash pop after pull produced conflicts. Resolve files, then remove stash if empty: git stash list${NC}"
                exit 1
            fi
        fi
        echo -e "${GREEN}✓ Repository updated from origin/$BRANCH (local changes preserved)${NC}"
        echo ""
    else
        echo -e "${YELLOW}Development environment detected (NODE_ENV=${NODE_ENV:-not set})${NC}"
        echo -e "${YELLOW}Skipping git sync - local changes will be preserved${NC}"
        echo ""
    fi
fi

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        SpeakASAP Application - Production Deployment          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Nginx registry service name (deploy-smart.sh). Separate from per-container SERVICE_NAME in compose.
DEPLOY_SERVICE_NAME="${DEPLOY_SERVICE_NAME:-speakasap}"

# Detect nginx-microservice path: env override first, then standard locations
NGINX_MICROSERVICE_PATH="${NGINX_MICROSERVICE_PATH:-}"

if [ -n "$NGINX_MICROSERVICE_PATH" ] && [ ! -d "$NGINX_MICROSERVICE_PATH" ]; then
    echo -e "${RED}❌ Error: NGINX_MICROSERVICE_PATH is set but not a directory: $NGINX_MICROSERVICE_PATH${NC}"
    exit 1
fi

if [ -z "$NGINX_MICROSERVICE_PATH" ]; then
# Check common production paths
if [ -d "~/Documents/Github/nginx-microservice" ]; then
    NGINX_MICROSERVICE_PATH="~/Documents/Github/nginx-microservice"
elif [ -d "/home/alfares/nginx-microservice" ]; then
    NGINX_MICROSERVICE_PATH="/home/alfares/nginx-microservice"
elif [ -d "/home/belunga/nginx-microservice" ]; then
    NGINX_MICROSERVICE_PATH="/home/belunga/nginx-microservice"
elif [ -d "$HOME/nginx-microservice" ]; then
    NGINX_MICROSERVICE_PATH="$HOME/nginx-microservice"
elif [ -d "$(dirname "$PROJECT_ROOT")/nginx-microservice" ]; then
    NGINX_MICROSERVICE_PATH="$(dirname "$PROJECT_ROOT")/nginx-microservice"
elif [ -d "$PROJECT_ROOT/../nginx-microservice" ]; then
    NGINX_MICROSERVICE_PATH="$(cd "$PROJECT_ROOT/../nginx-microservice" && pwd)"
fi
fi

# Validate nginx-microservice path
if [ -z "$NGINX_MICROSERVICE_PATH" ] || [ ! -d "$NGINX_MICROSERVICE_PATH" ]; then
    echo -e "${RED}❌ Error: nginx-microservice not found${NC}"
    echo ""
    echo "Please ensure nginx-microservice is installed in one of these locations:"
    echo "  - ~/Documents/Github/nginx-microservice"
    echo "  - /home/alfares/nginx-microservice"
    echo "  - /home/belunga/nginx-microservice"
    echo "  - $HOME/nginx-microservice"
    echo "  - $(dirname "$PROJECT_ROOT")/nginx-microservice (sibling directory)"
    echo ""
    echo "Or set NGINX_MICROSERVICE_PATH environment variable:"
    echo "  export NGINX_MICROSERVICE_PATH=/path/to/nginx-microservice"
    exit 1
fi

# Check if deploy-smart.sh exists
DEPLOY_SCRIPT="$NGINX_MICROSERVICE_PATH/scripts/blue-green/deploy-smart.sh"
if [ ! -f "$DEPLOY_SCRIPT" ]; then
    echo -e "${RED}❌ Error: deploy-smart.sh not found at $DEPLOY_SCRIPT${NC}"
    exit 1
fi

# Check if deploy-smart.sh is executable
if [ ! -x "$DEPLOY_SCRIPT" ]; then
    echo -e "${YELLOW}⚠️  Making deploy-smart.sh executable...${NC}"
    chmod +x "$DEPLOY_SCRIPT"
fi

echo -e "${GREEN}✅ Found nginx-microservice at: $NGINX_MICROSERVICE_PATH${NC}"
echo -e "${GREEN}✅ Deploying service (registry): $DEPLOY_SERVICE_NAME${NC}"
echo ""

# Preflight: ensure required SSL certs exist before deploy switches nginx traffic.
# This prevents unrelated deployments from failing on global nginx reload due to one missing cert.
REGISTRY_FILE="$NGINX_MICROSERVICE_PATH/service-registry/$DEPLOY_SERVICE_NAME.json"
echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] SSL preflight: validating certificate files${NC}"
if [ ! -f "$REGISTRY_FILE" ]; then
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  Registry file not found: $REGISTRY_FILE${NC}"
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  Continuing with env-based domain checks only${NC}"
fi

CERT_PREFLIGHT_FAILED=0
DOMAINS_TO_CHECK=""
if [ -f "$REGISTRY_FILE" ] && command -v jq >/dev/null 2>&1; then
    DOMAINS_TO_CHECK="$(jq -r '.domains | keys[]?' "$REGISTRY_FILE" 2>/dev/null || true)"
fi
for env_domain in "${DOMAIN:-}" "${CERTIFICATION_SERVICE_DOMAIN:-}" "${ASSESSMENT_SERVICE_DOMAIN:-}"; do
    if [ -n "$env_domain" ] && ! printf '%s\n' "$DOMAINS_TO_CHECK" | awk -v d="$env_domain" '$0==d{f=1} END{exit(f?0:1)}'; then
        DOMAINS_TO_CHECK="${DOMAINS_TO_CHECK}
$env_domain"
    fi
done
DOMAINS_TO_CHECK="$(printf '%s\n' "$DOMAINS_TO_CHECK" | awk 'NF' | awk '!seen[$0]++')"

if [ -z "$DOMAINS_TO_CHECK" ]; then
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  No domains found for SSL preflight${NC}"
else
    while IFS= read -r domain; do
        [ -z "$domain" ] && continue
        fullchain_path="$NGINX_MICROSERVICE_PATH/certificates/$domain/fullchain.pem"
        privkey_path="$NGINX_MICROSERVICE_PATH/certificates/$domain/privkey.pem"
        if [ -f "$fullchain_path" ] && [ -f "$privkey_path" ]; then
            echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Cert exists: $domain${NC}"
            continue
        fi

        echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  Missing cert files for $domain${NC}"
        echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  Attempting cert request via certbot before deploy${NC}"

        certbot_cmd=(docker compose -f "$NGINX_MICROSERVICE_PATH/docker-compose.yml" run --rm certbot /scripts/request-cert.sh "$domain")
        if [ -n "${CERTBOT_EMAIL:-}" ]; then
            certbot_cmd+=("$CERTBOT_EMAIL")
        fi

        if "${certbot_cmd[@]}"; then
            if [ -f "$fullchain_path" ] && [ -f "$privkey_path" ]; then
                echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Cert ready after request: $domain${NC}"
            else
                echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ❌ Cert request finished but files still missing: $domain${NC}"
                CERT_PREFLIGHT_FAILED=1
            fi
        else
            echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ❌ Cert request failed for: $domain${NC}"
            CERT_PREFLIGHT_FAILED=1
        fi
    done <<< "$DOMAINS_TO_CHECK"
fi

if [ "$CERT_PREFLIGHT_FAILED" -ne 0 ]; then
    echo ""
    echo -e "${RED}╔══════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║          ❌ SSL preflight failed - deployment aborted               ║${NC}"
    echo -e "${RED}╚══════════════════════════════════════════════════════════════════════╝${NC}"
    echo "Missing or invalid certificates would block nginx reload globally."
    echo "Fix DNS/certificates for listed domains, then rerun ./scripts/deploy.sh."
    exit 1
fi
echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] ✅ SSL preflight passed${NC}"
echo ""

# Validate docker-compose files exist before deployment
echo -e "${BLUE}Validating docker-compose files...${NC}"
if [ ! -f "$PROJECT_ROOT/docker-compose.blue.yml" ]; then
    echo -e "${RED}❌ Error: docker-compose.blue.yml not found in $PROJECT_ROOT${NC}"
    exit 1
fi
if [ ! -f "$PROJECT_ROOT/docker-compose.green.yml" ]; then
    echo -e "${RED}❌ Error: docker-compose.green.yml not found in $PROJECT_ROOT${NC}"
    exit 1
fi

# Validate docker-compose files are parseable
if ! docker compose -f "$PROJECT_ROOT/docker-compose.blue.yml" config --quiet 2>/dev/null; then
    echo -e "${RED}❌ Error: docker-compose.blue.yml is invalid${NC}"
    exit 1
fi
if ! docker compose -f "$PROJECT_ROOT/docker-compose.green.yml" config --quiet 2>/dev/null; then
    echo -e "${RED}❌ Error: docker-compose.green.yml is invalid${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker-compose files are valid${NC}"
echo ""

# Timing and phase summary
get_timestamp_seconds() { date +%s.%N; }
PHASE_TIMING_FILE=$(mktemp /tmp/deploy-phases-XXXXXX)
trap "rm -f $PHASE_TIMING_FILE" EXIT
start_phase() { local n="$1" t=$(get_timestamp_seconds); echo "$n|START|$t" >> "$PHASE_TIMING_FILE"; echo -e "${YELLOW}⏱️  PHASE START: $n${NC}" >&2; }
end_phase() { local n="$1" t=$(get_timestamp_seconds); echo "$n|END|$t" >> "$PHASE_TIMING_FILE"; local sl=$(grep "^${n}|START|" "$PHASE_TIMING_FILE" | tail -1); if [ -n "$sl" ]; then local st=$(echo "$sl" | cut -d'|' -f3); local d=$(awk "BEGIN {printf \"%.2f\", $t - $st}"); echo -e "${GREEN}⏱️  PHASE END: $n (duration: ${d}s)${NC}" >&2; fi; }
print_phase_summary() {
    if [ ! -f "$PHASE_TIMING_FILE" ] || [ ! -s "$PHASE_TIMING_FILE" ]; then echo ""; echo -e "${YELLOW}⚠️  No phase timing data available${NC}"; echo ""; return; fi
    echo ""; echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"; echo -e "${BLUE}📊 DEPLOYMENT PHASE TIMING SUMMARY${NC}"; echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
    local cur="" st="" tot=0; while IFS='|' read -r p e ts; do
        if [ "$e" = "START" ]; then cur="$p"; st="$ts"
        elif [ "$e" = "END" ] && [ -n "$st" ] && [ -n "$cur" ]; then local d=$(awk "BEGIN {printf \"%.2f\", $ts - $st}"); tot=$(awk "BEGIN {printf \"%.2f\", $tot + $d}"); printf "  ${GREEN}%-45s${NC} ${YELLOW}%10.2fs${NC}\n" "$cur:" "$d"; cur=""; st=""; fi
    done < "$PHASE_TIMING_FILE"
    if [ "$(echo "$tot > 0" | bc 2>/dev/null || echo "0")" = "1" ]; then echo -e "${BLUE}────────────────────────────────────────────────────────────${NC}"; printf "  ${GREEN}%-45s${NC} ${YELLOW}%10.2fs${NC}\n" "Total (all phases):" "$tot"; fi
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"; echo ""
}

# Change to nginx-microservice directory and run deployment
start_phase "Pre-deployment Setup"
echo -e "${YELLOW}Starting blue/green deployment...${NC}"
echo ""
cd "$NGINX_MICROSERVICE_PATH"
end_phase "Pre-deployment Setup"
START_TIME=$(get_timestamp_seconds)
"$DEPLOY_SCRIPT" "$DEPLOY_SERVICE_NAME" 2>&1 | {
    build_started=0; start_containers_started=0; health_check_started=0
    while IFS= read -r line; do echo "$line"
        if echo "$line" | grep -qE "Phase 0:.*Infrastructure"; then start_phase "Phase 0: Infrastructure Check"
        elif echo "$line" | grep -qE "Phase 0 completed|✅ Phase 0 completed"; then end_phase "Phase 0: Infrastructure Check"
        elif echo "$line" | grep -qE "Phase 1:.*Preparing|Phase 1:.*Prepare"; then start_phase "Phase 1: Prepare Green Deployment"
        elif echo "$line" | grep -qE "Phase 1 completed|✅ Phase 1 completed"; then end_phase "Phase 1: Prepare Green Deployment"
        elif echo "$line" | grep -qE "Phase 2:.*Switching|Phase 2:.*Switch"; then start_phase "Phase 2: Switch Traffic to Green"
        elif echo "$line" | grep -qE "Phase 2 completed|✅ Phase 2 completed"; then end_phase "Phase 2: Switch Traffic to Green"
        elif echo "$line" | grep -qE "Phase 3:.*Monitoring|Phase 3:.*Monitor"; then start_phase "Phase 3: Monitor Health"
        elif echo "$line" | grep -qE "Phase 3 completed|✅ Phase 3 completed"; then end_phase "Phase 3: Monitor Health"
        elif echo "$line" | grep -qE "Phase 4:.*Verifying|Phase 4:.*Verify"; then start_phase "Phase 4: Verify HTTPS"
        elif echo "$line" | grep -qE "Phase 4 completed|✅ Phase 4 completed"; then end_phase "Phase 4: Verify HTTPS"
        elif echo "$line" | grep -qE "Phase 5:.*Cleaning|Phase 5:.*Cleanup"; then start_phase "Phase 5: Cleanup"
        elif echo "$line" | grep -qE "Phase 5 completed|✅ Phase 5 completed"; then end_phase "Phase 5: Cleanup"
        elif echo "$line" | grep -qE "Building containers|Image.*Building" && [ "$build_started" -eq 0 ]; then start_phase "Build Containers"; build_started=1
        elif echo "$line" | grep -qE "All services built|✅ All services built" && [ "$build_started" -eq 1 ]; then end_phase "Build Containers"; build_started=2
        elif echo "$line" | grep -qE "Starting containers|Container.*Starting" && [ "$start_containers_started" -eq 0 ]; then start_phase "Start Containers"; start_containers_started=1
        elif echo "$line" | grep -qE "Container.*Started|Waiting.*services to start" && [ "$start_containers_started" -eq 1 ]; then end_phase "Start Containers"; start_containers_started=2
        elif echo "$line" | grep -qE "Checking.*health|Health check" && [ "$health_check_started" -eq 0 ]; then start_phase "Health Checks"; health_check_started=1
        elif echo "$line" | grep -qE "health check passed|✅.*health" && [ "$health_check_started" -eq 1 ]; then end_phase "Health Checks"; health_check_started=2
        fi
    done
}
DEPLOY_EXIT_CODE=${PIPESTATUS[0]}
END_TIME=$(get_timestamp_seconds)
TOTAL_DURATION=$(awk "BEGIN {printf \"%.2f\", $END_TIME - $START_TIME}")

if [ $DEPLOY_EXIT_CODE -eq 0 ]; then
    TOTAL_DURATION_FORMATTED=$(awk "BEGIN {printf \"%.2f\", $TOTAL_DURATION}")
    print_phase_summary 2>&1
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║          ✅ Speakasap deployment completed successfully!             ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════════╝${NC}"
    echo -e "${GREEN} Total deployment time: ${TOTAL_DURATION_FORMATTED}s${NC}"
    echo ""
    echo "The speakasap application has been deployed using blue/green deployment."
    echo "Check the status with:"
    echo "  cd $NGINX_MICROSERVICE_PATH"
    echo "  ./scripts/status-all-services.sh"
    exit 0
else
    TOTAL_DURATION_FORMATTED=$(awk "BEGIN {printf \"%.2f\", $TOTAL_DURATION}")
    echo ""; 
    echo -e "${RED}════════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}   ❌ Speakasap deployment failed! Failed after: ${TOTAL_DURATION_FORMATTED}s${NC}"
    echo -e "${RED}════════════════════════════════════════════════════════════${NC}"
    print_phase_summary
    echo ""; 
    echo -e "${RED}╔══════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                  ❌ Speakasap deployment failed!                     ║${NC}"
    echo -e "${RED}╚══════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Please check the error messages above and:"
    echo "  1. Verify nginx-microservice is properly configured"
    echo "  2. Check service registry file exists: $NGINX_MICROSERVICE_PATH/service-registry/$DEPLOY_SERVICE_NAME.json"
    echo "  3. Review deployment logs"
    echo "  4. Check service health: cd $NGINX_MICROSERVICE_PATH && ./scripts/blue-green/health-check.sh $DEPLOY_SERVICE_NAME"
    exit 1
fi
