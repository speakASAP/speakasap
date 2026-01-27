#!/bin/bash
# Content Service Deployment Script
# Deploys the content-service using nginx-microservice blue/green system.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              SpeakASAP - Production Deployment             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SERVICE_DIR="$PROJECT_ROOT/content-service"
ENV_FILE="$PROJECT_ROOT/.env"

if [ -f "$ENV_FILE" ]; then
  SERVICE_NAME=$(grep -E "^SERVICE_NAME=" "$ENV_FILE" | cut -d'=' -f2 | tr -d '"' | tr -d "'" | xargs)
fi

SERVICE_NAME="${SERVICE_NAME:-content-service}"

if [ ! -d "$SERVICE_DIR" ]; then
  echo -e "${RED}Error: content-service directory not found in $PROJECT_ROOT${NC}"
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo -e "${RED}Error: .env not found in $PROJECT_ROOT${NC}"
  echo "Create .env from .env.example and set CONTENT_SERVICE_PORT and CONTENT_SERVICE_PORT_GREEN."
  exit 1
fi

if ! grep -q '^CONTENT_SERVICE_PORT=' "$ENV_FILE"; then
  echo -e "${RED}Error: CONTENT_SERVICE_PORT is missing in .env${NC}"
  exit 1
fi

if ! grep -q '^CONTENT_SERVICE_PORT_GREEN=' "$ENV_FILE"; then
  echo -e "${RED}Error: CONTENT_SERVICE_PORT_GREEN is missing in .env${NC}"
  exit 1
fi

if [ ! -f "$SERVICE_DIR/docker-compose.blue.yml" ]; then
  echo -e "${RED}Error: docker-compose.blue.yml not found in $SERVICE_DIR${NC}"
  exit 1
fi

if [ ! -f "$SERVICE_DIR/docker-compose.green.yml" ]; then
  echo -e "${RED}Error: docker-compose.green.yml not found in $SERVICE_DIR${NC}"
  exit 1
fi

echo -e "${BLUE}Validating docker-compose files...${NC}"
if ! docker compose -f "$SERVICE_DIR/docker-compose.blue.yml" config --quiet 2>/dev/null; then
  echo -e "${RED}Error: docker-compose.blue.yml is invalid${NC}"
  exit 1
fi

if ! docker compose -f "$SERVICE_DIR/docker-compose.green.yml" config --quiet 2>/dev/null; then
  echo -e "${RED}Error: docker-compose.green.yml is invalid${NC}"
  exit 1
fi

echo -e "${GREEN}Docker-compose files are valid${NC}"

# Find nginx-microservice
NGINX_MICROSERVICE_PATH="${NGINX_MICROSERVICE_PATH:-}"

if [ -z "$NGINX_MICROSERVICE_PATH" ]; then
  if [ -d "/home/statex/nginx-microservice" ]; then
    NGINX_MICROSERVICE_PATH="/home/statex/nginx-microservice"
  elif [ -d "/home/alfares/nginx-microservice" ]; then
    NGINX_MICROSERVICE_PATH="/home/alfares/nginx-microservice"
  elif [ -d "$HOME/nginx-microservice" ]; then
    NGINX_MICROSERVICE_PATH="$HOME/nginx-microservice"
  elif [ -d "$(dirname "$PROJECT_ROOT")/nginx-microservice" ]; then
    NGINX_MICROSERVICE_PATH="$(dirname "$PROJECT_ROOT")/nginx-microservice"
  fi
fi

if [ -z "$NGINX_MICROSERVICE_PATH" ] || [ ! -d "$NGINX_MICROSERVICE_PATH" ]; then
  echo -e "${RED}Error: nginx-microservice not found${NC}"
  echo "Set NGINX_MICROSERVICE_PATH or install nginx-microservice in:"
  echo "  - /home/statex/nginx-microservice"
  echo "  - /home/alfares/nginx-microservice"
  echo "  - $HOME/nginx-microservice"
  echo "  - $(dirname "$PROJECT_ROOT")/nginx-microservice"
  exit 1
fi

DEPLOY_SCRIPT="$NGINX_MICROSERVICE_PATH/scripts/blue-green/deploy-smart.sh"
if [ ! -f "$DEPLOY_SCRIPT" ]; then
  echo -e "${RED}Error: deploy-smart.sh not found at $DEPLOY_SCRIPT${NC}"
  exit 1
fi

if [ ! -x "$DEPLOY_SCRIPT" ]; then
  echo -e "${YELLOW}Making deploy-smart.sh executable...${NC}"
  chmod +x "$DEPLOY_SCRIPT"
fi

echo -e "${GREEN}Found nginx-microservice at: $NGINX_MICROSERVICE_PATH${NC}"
echo -e "${GREEN}Deploying service: $SERVICE_NAME${NC}"
echo ""

echo -e "${YELLOW}Starting blue/green deployment...${NC}"
echo ""

cd "$NGINX_MICROSERVICE_PATH"

if "$DEPLOY_SCRIPT" "$SERVICE_NAME"; then
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║         ✅ Deployment completed successfully!              ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
  exit 0
else
    echo ""
    echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                 ❌ Deployment failed!                      ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
  exit 1
fi
