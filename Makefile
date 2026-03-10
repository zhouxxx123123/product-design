# ==========================================
# 中科琉光调研工具 - Makefile
# 常用命令快捷方式
# ==========================================

.PHONY: help install dev build test clean docker-up docker-down migrate

# 默认显示帮助
help:
	@echo "中科琉光调研工具 - 可用命令"
	@echo ""
	@echo "开发环境:"
	@echo "  make install       - 安装所有依赖"
	@echo "  make dev           - 启动开发服务器 (本地)"
	@echo "  make dev-docker    - 使用 Docker 启动开发环境"
	@echo "  make dev-backend   - 仅启动后端开发服务器"
	@echo "  make dev-frontend  - 仅启动前端开发服务器"
	@echo "  make dev-ai        - 仅启动 AI 服务"
	@echo ""
	@echo "构建与部署:"
	@echo "  make build         - 构建所有项目"
	@echo "  make build-backend - 仅构建后端"
	@echo "  make build-frontend- 仅构建前端"
	@echo ""
	@echo "测试:"
	@echo "  make test          - 运行所有测试"
	@echo "  make test-backend  - 仅运行后端测试"
	@echo "  make test-frontend - 仅运行前端测试"
	@echo "  make test-ai       - 仅运行 AI 服务测试"
	@echo "  make test-cov      - 运行测试并生成覆盖率报告"
	@echo ""
	@echo "数据库:"
	@echo "  make migrate       - 运行数据库迁移"
	@echo "  make migrate-create - 创建新迁移"
	@echo "  make migrate-revert - 回滚最后一次迁移"
	@echo "  make db-reset      - 重置数据库 (危险!)"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-up     - 启动所有 Docker 容器"
	@echo "  make docker-down   - 停止所有 Docker 容器"
	@echo "  make docker-build  - 重建 Docker 镜像"
	@echo "  make docker-logs   - 查看 Docker 日志"
	@echo "  make docker-clean  - 清理 Docker 资源"
	@echo ""
	@echo "代码质量:"
	@echo "  make lint          - 运行所有代码检查"
	@echo "  make lint-fix      - 自动修复代码问题"
	@echo "  make format        - 格式化代码"
	@echo ""
	@echo "其他:"
	@echo "  make clean         - 清理构建产物"
	@echo "  make logs          - 查看本地日志"
	@echo "  make init          - 初始化项目"

# ==========================================
# 初始化
# ==========================================
init:
	@echo "初始化项目..."
	@cp .env.example .env
	@echo "已创建 .env 文件，请编辑配置"

# ==========================================
# 安装依赖
# ==========================================
install:
	@echo "安装后端依赖..."
	@cd backend && npm install
	@echo "安装前端依赖..."
	@cd frontend && npm install
	@echo "安装 AI 服务依赖..."
	@cd ai && pip install -r requirements.txt

# ==========================================
# 开发服务器 (本地)
# ==========================================
dev-backend:
	@cd backend && npm run start:dev

dev-frontend:
	@cd frontend && npm run dev

dev-ai:
	@cd ai && uvicorn main:app --reload --host 0.0.0.0 --port 8000

dev:
	@echo "启动所有开发服务器..."
	@make -j3 dev-backend dev-frontend dev-ai

# ==========================================
# Docker 开发环境
# ==========================================
docker-up:
	@docker-compose up -d

docker-down:
	@docker-compose down

docker-build:
	@docker-compose up -d --build

docker-logs:
	@docker-compose logs -f

docker-clean:
	@docker-compose down -v
	@docker system prune -f

dev-docker:
	@echo "使用 Docker 启动开发环境..."
	@docker-compose up -d postgres redis minio
	@sleep 5
	@make migrate
	@docker-compose up -d backend ai
	@echo "服务已启动:"
	@echo "  - 后端: http://localhost:3000"
	@echo "  - AI服务: http://localhost:8000"
	@echo "  - MinIO: http://localhost:9001"

# ==========================================
# 构建
# ==========================================
build-backend:
	@cd backend && npm run build

build-frontend:
	@cd frontend && npm run build

build-ai:
	@cd ai && docker build -t liuguang-ai .

build:
	@make build-backend
	@make build-frontend

# ==========================================
# 测试
# ==========================================
test-backend:
	@cd backend && npm run test:cov

test-frontend:
	@cd frontend && npm run test:cov

test-ai:
	@cd ai && pytest --cov

test:
	@make test-backend
	@make test-frontend
	@make test-ai

test-cov:
	@make test

# ==========================================
# 数据库迁移
# ==========================================
migrate:
	@cd backend && npm run migration:run

migrate-create:
	@cd backend && npm run migration:create

migrate-generate:
	@cd backend && npm run migration:generate

migrate-revert:
	@cd backend && npm run migration:revert

db-reset:
	@echo "警告: 这将删除所有数据!"
	@read -p "确定继续? [y/N] " confirm && [ $$confirm = y ] && cd backend && npm run schema:drop

# ==========================================
# 代码质量
# ==========================================
lint-backend:
	@cd backend && npm run lint

lint-frontend:
	@cd frontend && npm run lint

lint-ai:
	@cd ai && flake8 . && mypy .

lint:
	@make lint-backend
	@make lint-frontend
	@make lint-ai

lint-fix:
	@cd backend && npm run lint -- --fix
	@cd frontend && npm run lint -- --fix
	@cd ai && black . && isort .

format:
	@cd backend && npm run format
	@cd frontend && npm run format
	@cd ai && black . && isort .

# ==========================================
# 清理
# ==========================================
clean:
	@cd backend && rm -rf dist node_modules coverage
	@cd frontend && rm -rf dist node_modules coverage
	@cd ai && rm -rf __pycache__ .pytest_cache .mypy_cache
	@find . -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name "dist" -exec rm -rf {} + 2>/dev/null || true

# ==========================================
# 日志
# ==========================================
logs:
	@tail -f backend/logs/*.log ai/logs/*.log 2>/dev/null || echo "暂无日志文件"
