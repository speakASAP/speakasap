#!/bin/bash

# Course Materials Microservice Start Script
# Starts all course materials microservice containers

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SPEAKASAP_ROOT="$(cd "$PROJECT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

echo "🚀 Starting Course Materials Microservice"
echo "=================================="

if [ ! -f "$SPEAKASAP_ROOT/.env" ]; then
  echo "⚠️  Missing $SPEAKASAP_ROOT/.env — copy speakasap/.env.example there and fill values."
  exit 1
fi

# Start services (variable interpolation from monorepo root .env)
echo ""
echo "Starting services..."
docker compose --env-file "$SPEAKASAP_ROOT/.env" -f docker-compose.blue.yml up -d

echo ""
echo "✅ Course Materials Microservice started"
echo ""
echo "Services:"
docker compose --env-file "$SPEAKASAP_ROOT/.env" -f docker-compose.blue.yml ps

echo ""
echo "To view logs: docker compose --env-file \"$SPEAKASAP_ROOT/.env\" -f docker-compose.blue.yml logs -f"
echo "To check status: ./scripts/status.sh"
