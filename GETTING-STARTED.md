# 中科琉光调研工具 - 项目启动指南

本指南说明如何启动和运行中科琉光调研工具的完整开发环境。

## 快速启动

### 方式一：Docker Compose (推荐)

```bash
# 1. 进入项目目录
cd /Users/zhoukeyu/Desktop/基准线/product-design

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入实际值

# 3. 启动所有服务
make docker-up
# 或
docker-compose up -d

# 4. 查看服务状态
make docker-logs
```

服务启动后将可用：

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端 | http://localhost:5173 | React + Vite |
| 后端 API | http://localhost:3000/api/v1 | NestJS |
| API文档 | http://localhost:3000/api/docs | Swagger |
| AI服务 | http://localhost:8000 | FastAPI |
| AI文档 | http://localhost:8000/docs | FastAPI Docs |
| MinIO控制台 | http://localhost:9001 | 对象存储 |
| Flower监控 | http://localhost:5555 | Celery监控 |
| PostgreSQL | localhost:5432 | 数据库 |
| Redis | localhost:6379 | 缓存/队列 |

### 方式二：本地开发

#### 后端 (NestJS)

```bash
cd backend
npm install
npm run start:dev
```

#### 前端 (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

#### AI服务 (Python + FastAPI)

```bash
cd ai
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## 环境配置

### 必需配置

复制 `.env.example` 到 `.env` 并配置以下关键变量：

1. **数据库**: `DB_USER`, `DB_PASSWORD`, `DB_NAME`
2. **腾讯ASR**: `TENCENT_SECRET_ID`, `TENCENT_SECRET_KEY`
   - 获取: https://cloud.tencent.com/product/asr
3. **Kimi AI**: `MOONSHOT_API_KEY`
   - 获取: https://platform.moonshot.cn/
4. **JWT密钥**: `JWT_SECRET` (至少32位随机字符串)

### 可选配置

- `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` - 对象存储
- `FLOWER_AUTH` - Celery监控认证
- `LOG_LEVEL` - 日志级别

## 常用命令

```bash
# 开发
make dev              # 启动所有开发服务器
make dev-backend      # 仅启动后端
make dev-frontend     # 仅启动前端
make dev-ai           # 仅启动AI服务

# Docker
make docker-up        # 启动容器
make docker-down      # 停止容器
make docker-logs      # 查看日志

# 测试
make test             # 运行所有测试
make test-cov         # 生成覆盖率报告

# 数据库
make migrate          # 运行迁移
make migrate-create   # 创建新迁移

# 代码质量
make lint             # 代码检查
make format           # 格式化代码

# 清理
make clean            # 清理构建产物
```

## 项目结构

```
project-design/
├── backend/            # NestJS API服务
│   ├── src/
│   │   ├── modules/    # 功能模块 (auth, users, sessions...)
│   │   ├── common/     # 守卫、拦截器、过滤器
│   │   └── config/     # 配置服务
│   ├── Dockerfile
│   └── package.json
├── frontend/           # React Web应用
│   ├── src/
│   │   ├── components/ # UI组件
│   │   ├── pages/      # 页面
│   │   ├── hooks/      # 自定义hooks
│   │   └── stores/     # Zustand状态管理
│   ├── Dockerfile
│   └── package.json
├── mobile/             # React Native (预留)
├── ai/                 # Python FastAPI AI服务
│   ├── services/       # ASR、LLM、洞察服务
│   ├── api/v1/         # API端点
│   ├── main.py         # 应用入口
│   ├── requirements.txt
│   └── Dockerfile
├── shared/types/       # 共享TypeScript类型
├── docker-compose.yml  # Docker配置
├── .env.example        # 环境变量模板
└── Makefile           # 常用命令
```

## API 端点

### 后端 API (NestJS)

- `GET /api/v1/health` - 健康检查
- `GET /api/v1/docs` - Swagger文档

### AI 服务 API (FastAPI)

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/v1/asr/recognize/file` | POST | 录音文件识别 |
| `/api/v1/asr/recognize/url` | POST | URL音频识别 |
| `/api/v1/asr/stream` | WS | 实时流式识别 |
| `/api/v1/llm/chat` | POST | LLM对话 |
| `/api/v1/llm/chat/stream` | POST | 流式对话 |
| `/api/v1/outline/generate` | POST | 生成访谈提纲 |
| `/api/v1/outline/optimize` | POST | 优化提纲 |
| `/api/v1/insight/extract` | POST | 提取洞察 |
| `/api/v1/insight/summarize` | POST | 生成摘要 |
| `/health` | GET | 健康检查 |

## 技术栈

| 服务 | 技术 |
|------|------|
| 后端 API | NestJS + TypeORM + PostgreSQL |
| 前端 Web | React + Vite + Tailwind CSS |
| 前端 Mobile | React Native (Android) |
| AI 服务 | Python + FastAPI + Celery |
| 语音识别 | 腾讯云 ASR |
| AI 模型 | Moonshot Kimi-k2.5 |
| 对象存储 | MinIO |
| 消息队列 | Redis + Celery |
| 数据库 | PostgreSQL + pgvector |

## 故障排除

### 端口冲突

如果端口被占用，修改 `.env` 中的端口配置：

```env
BACKEND_PORT=3001
FRONTEND_PORT=5174
AI_PORT=8001
```

### 数据库连接失败

```bash
# 检查PostgreSQL是否运行
docker-compose ps postgres

# 查看日志
docker-compose logs postgres

# 重置数据库 (会丢失数据)
make db-reset
```

### AI服务依赖问题

```bash
cd ai
pip install --upgrade -r requirements.txt
```

### 前端热更新不生效

```bash
# 清除缓存并重启
cd frontend
rm -rf node_modules dist
npm install
npm run dev
```

## 更多信息

- 产品设计文档: [README.md](./README.md)
- Agent指南: [AGENTS-GUIDE.md](./AGENTS-GUIDE.md)
- 功能清单: [功能清单_调研工具_v1.0.md](./功能清单_调研工具_v1.0.md)
