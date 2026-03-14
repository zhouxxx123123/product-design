#!/usr/bin/env bash
# Health check script for OpenClaw Suite
set -euo pipefail

BACKEND_URL="${BACKEND_URL:-http://localhost:3000}"
AI_URL="${AI_URL:-http://localhost:8000}"

echo "🔍 Checking OpenClaw Suite health..."

# Backend health
if curl -sf "${BACKEND_URL}/api/health" > /dev/null 2>&1; then
  echo "✅ Backend (NestJS): healthy"
else
  echo "❌ Backend (NestJS): unhealthy at ${BACKEND_URL}/api/health"
  exit 1
fi

# AI service health
if curl -sf "${AI_URL}/health" > /dev/null 2>&1; then
  echo "✅ AI Service (FastAPI): healthy"
else
  echo "❌ AI Service (FastAPI): unhealthy at ${AI_URL}/health"
  exit 1
fi

echo "✅ All services healthy"