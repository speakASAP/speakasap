#!/bin/bash

# Course Materials Microservice Stop Script
# Stops all course materials microservice containers

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SPEAKASAP_ROOT="$(cd "$PROJECT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

echo "🛑 Stopping Course Materials Microservice"
echo "=================================="

ENV_FLAG=()
if [ -f "$SPEAKASAP_ROOT/.env" ]; then
  ENV_FLAG=(--env-file "$SPEAKASAP_ROOT/.env")
fi

docker compose "${ENV_FLAG[@]}" -f docker-compose.blue.yml down
docker compose "${ENV_FLAG[@]}" -f docker-compose.green.yml down 2>/dev/null || true

echo ""
echo "✅ Course Materials Microservice stopped"
