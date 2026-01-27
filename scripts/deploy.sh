#!/bin/bash
# Deployment script template for SpeakASAP services.
# Integrates with nginx-microservice blue/green deployment.
# Follows marathon service deployment pattern for consistency.
#
# Usage: ./scripts/deploy.sh [service-name]
# If service-name is not provided, attempts to detect from .env SERVICE_NAME or directory name.

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

# Determine service name
SERVICE_NAME="$1"

if [ -z "$SERVICE_NAME" ]; then
  # Try to detect from .env file
  if [ -f "$PROJECT_ROOT/.env" ]; then
    SERVICE_NAME=$(grep -E "^SERVICE_NAME=" "$PROJECT_ROOT/.env" | cut -d'=' -f2 | tr -d '"' | tr -d "'" | xargs)
  fi
  
  # If still not found, try directory name
  if [ -z "$SERVICE_NAME" ]; then
    SERVICE_NAME=$(basename "$PROJECT_ROOT")
  fi
fi

if [ -z "$SERVICE_NAME" ]; then
  echo -e "${RED}Error: Service name required${NC}"
  echo "Usage: ./scripts/deploy.sh [service-name]"
  echo "Example: ./scripts/deploy.sh speakasap-content-service"
  echo ""
  echo "Or set SERVICE_NAME in .env file"
  exit 1
fi

# Validate docker-compose files exist
if [ ! -f "$PROJECT_ROOT/docker-compose.blue.yml" ]; then
  echo -e "${RED}Error: docker-compose.blue.yml not found in $PROJECT_ROOT${NC}"
  exit 1
fi

if [ ! -f "$PROJECT_ROOT/docker-compose.green.yml" ]; then
  echo -e "${RED}Error: docker-compose.green.yml not found in $PROJECT_ROOT${NC}"
  exit 1
fi

# Validate docker-compose files
echo -e "${BLUE}Validating docker-compose files...${NC}"
if ! docker compose -f "$PROJECT_ROOT/docker-compose.blue.yml" config --quiet 2>/dev/null; then
  echo -e "${RED}Error: docker-compose.blue.yml is invalid${NC}"
  exit 1
fi

if ! docker compose -f "$PROJECT_ROOT/docker-compose.green.yml" config --quiet 2>/dev/null; then
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
