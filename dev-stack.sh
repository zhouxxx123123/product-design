#!/bin/bash

# 项目路径
PROJECT_ROOT="/Users/zhoukeyu/Desktop/基准线/product-design"

echo "🚀 启动完整开发栈..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# 清理之前的进程
echo "${BLUE}清理之前的进程...${NC}"
pkill -f "npm run dev" || true
pkill -f "uvicorn" || true
sleep 1

# 启动 PostgreSQL + Redis（Docker）
echo "${BLUE}启动数据库服务 (Docker Compose)...${NC}"
cd "$PROJECT_ROOT"
docker-compose up -d postgres redis 2>/dev/null || echo "⚠️  Docker services might already be running"

# 等待数据库就绪
sleep 3

# 启动后端 (NestJS)
echo "${GREEN}启动后端 (NestJS @ :4000)...${NC}"
cd "$PROJECT_ROOT/backend"
npm run dev > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# 启动前端 (React @ :3000)
echo "${GREEN}启动前端 (React Vite @ :3000)...${NC}"
cd "$PROJECT_ROOT/frontend"
npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

# 启动 AI 服务 (FastAPI @ :8000)
echo "${GREEN}启动 AI 服务 (FastAPI @ :8000)...${NC}"
cd "$PROJECT_ROOT/ai"
source .venv/bin/activate 2>/dev/null
uvicorn main:app --reload --port 8000 > /tmp/ai.log 2>&1 &
AI_PID=$!
echo "AI Service PID: $AI_PID"

echo ""
echo "${GREEN}✅ 所有服务已启动！${NC}"
echo ""
echo "📍 访问地址："
echo "  Frontend:  ${BLUE}http://localhost:3000${NC}"
echo "  Backend:   ${BLUE}http://localhost:4000${NC}"
echo "  AI API:    ${BLUE}http://localhost:8000/docs${NC}"
echo ""
echo "📝 日志文件："
echo "  /tmp/backend.log"
echo "  /tmp/frontend.log"
echo "  /tmp/ai.log"
echo ""
echo "❌ 停止所有服务，运行："
echo "  kill $BACKEND_PID $FRONTEND_PID $AI_PID"
echo ""

# 实时监控日志
echo "${BLUE}=== 前端日志 ===${NC}"
tail -f /tmp/frontend.log
