#!/bin/bash
# Content Service Deployment Script
# Deploys the content service using nginx-microservice blue/green system.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTENT_SERVICE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# Docker compose files for this stack live at speakasap repo root (sibling of content-service/).
SPEAKASAP_ROOT="$(cd "$CONTENT_SERVICE_ROOT/.." && pwd)"
PROJECT_ROOT="$SPEAKASAP_ROOT"

cd "$PROJECT_ROOT"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Load NODE_ENV from .env file to determine environment
NODE_ENV=""
if [ -f "$SPEAKASAP_ROOT/.env" ]; then
    set -a
    # shellcheck source=/dev/null
    source "$SPEAKASAP_ROOT/.env" 2>/dev/null || true
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
        git pull origin "$BRANCH"
        if [ "$STASHED" = "1" ]; then
            git stash pop
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
echo -e "${BLUE}║      Content Service - Production Deployment              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

SERVICE_NAME="speakasap"
DISPLAY_NAME="$(echo "${SERVICE_NAME:0:1}" | tr 'a-z' 'A-Z')${SERVICE_NAME:1}"

NGINX_MICROSERVICE_PATH="${NGINX_MICROSERVICE_PATH:-}"

if [ -z "$NGINX_MICROSERVICE_PATH" ]; then
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

DEPLOY_SCRIPT="$NGINX_MICROSERVICE_PATH/scripts/blue-green/deploy-smart.sh"
if [ ! -f "$DEPLOY_SCRIPT" ]; then
    echo -e "${RED}❌ Error: deploy-smart.sh not found at $DEPLOY_SCRIPT${NC}"
    exit 1
fi

if [ ! -x "$DEPLOY_SCRIPT" ]; then
    echo -e "${YELLOW}⚠️  Making deploy-smart.sh executable...${NC}"
    chmod +x "$DEPLOY_SCRIPT"
fi

echo -e "${GREEN}✅ Found nginx-microservice at: $NGINX_MICROSERVICE_PATH${NC}"
echo -e "${GREEN}✅ Deploying service: $SERVICE_NAME${NC}"
echo ""

# shellcheck disable=SC1091
source "$(dirname "$SPEAKASAP_ROOT")/shared/scripts/load-deploy-phase-timing.sh" "$SPEAKASAP_ROOT" 2>/dev/null \
  || source "$HOME/Documents/Github/shared/scripts/load-deploy-phase-timing.sh" "$SPEAKASAP_ROOT" \
  || { echo "Error: deploy timing library not found" >&2; exit 1; }
deploy_timing_init "$DISPLAY_NAME"

deploy_timing_phase_start "Validate docker-compose"
echo -e "${BLUE}Validating docker-compose files...${NC}"
if [ ! -f "$PROJECT_ROOT/docker-compose.blue.yml" ]; then
    echo -e "${RED}Error: docker-compose.blue.yml not found in $PROJECT_ROOT${NC}"
    exit 1
fi
if [ ! -f "$PROJECT_ROOT/docker-compose.green.yml" ]; then
    echo -e "${RED}Error: docker-compose.green.yml not found in $PROJECT_ROOT${NC}"
    exit 1
fi
if ! docker compose -f "$PROJECT_ROOT/docker-compose.blue.yml" config --quiet 2>/dev/null; then
    echo -e "${RED}Error: docker-compose.blue.yml is invalid${NC}"
    exit 1
fi
if ! docker compose -f "$PROJECT_ROOT/docker-compose.green.yml" config --quiet 2>/dev/null; then
    echo -e "${RED}Error: docker-compose.green.yml is invalid${NC}"
    exit 1
fi
echo -e "${GREEN}Docker-compose files are valid${NC}"
deploy_timing_phase_end "Validate docker-compose"
echo ""

deploy_timing_phase_start "Pre-deployment setup"
echo -e "${YELLOW}Starting blue/green deployment...${NC}"
cd "$NGINX_MICROSERVICE_PATH"
deploy_timing_phase_end "Pre-deployment setup"

if deploy_timing_exec_deploy_smart "$DEPLOY_SCRIPT" "$SERVICE_NAME"; then
  deploy_timing_finish_success "$DISPLAY_NAME"
  echo "Check status with:"
  echo "  cd $NGINX_MICROSERVICE_PATH"
  echo "  ./scripts/status-all-services.sh"
  DEPLOY_TIMING_FINISHED=1
  exit 0
fi

deploy_timing_finish_failure "$DISPLAY_NAME" "$?"
exit 1
