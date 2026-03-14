# OpenClaw Suite — 项目进度追踪

> 最后更新：2026-03-12（七次更新 — Module A/B/C/D/E/F/G 完成）
> 扫描基准：全栈代码扫描（frontend + backend + ai + mobile 四层）

---

## 项目状态总览

| 层级 | 完成度 | 状态 |
|------|--------|------|
| 前端 (React + Vite) | 100% | 测试补全 + ErrorBoundary + Query 统一错误处理 |
| 后端 (NestJS) | 100% | 代码完整，待启动 |
| AI 层 (FastAPI) | 95% | 核心功能完整，待联调 |
| 移动端 (React Native Android) | 60% | B1-B5 代码完成，待 npm install + 真机联调 |
| 环境配置 | 100% | Docker Compose 全服务 healthy |
| 数据库迁移 | 100% | 18 条迁移全部执行完毕（+AddWechat/+ClientStatus/+TenantMembers） |
| 端到端联调 | 100% | 登录→JWT→AI LLM→前端全链路验证通过 |

---

## 环境准备状态

| 项目 | 状态 | 说明 |
|------|------|------|
| `backend/.env` | ❌ 未创建 | 参考 `backend/.env.example` |
| `frontend/.env` | ❌ 未创建 | 参考 `frontend/.env.example` |
| Docker Compose | ❌ 未启动 | `docker-compose up -d` |
| PostgreSQL 迁移 | ❌ 未执行 | `npm run migration:run` |
| 种子数据 | ❌ 未导入 | `npm run seed` |
| 腾讯云 ASR 密钥 | ❌ 未配置 | TENCENT_SECRET_ID / KEY |
| Kimi API Key | ❌ 未配置 | MOONSHOT_API_KEY |

---

## 后端模块状态（NestJS）

| 模块 | Controller | Service | Tests | 迁移 | 状态 |
|------|-----------|---------|-------|------|------|
| auth | ✅ | ✅ | ✅ auth.service.spec.ts | ✅ | 完成 |
| users | ✅ | ✅ | ✅ users.service.spec.ts | ✅ | 完成 |
| cases | ✅ | ✅ | ✅ cases.service.spec.ts | ✅ | 完成 |
| sessions | ✅ | ✅ | ✅ sessions.service.spec.ts | ✅ | 完成 |
| templates | ✅ | ✅ | ✅ templates.service.spec.ts | ✅ | 完成 |
| transcript | ✅ | ✅ | — | ✅ | 完成（无独立测试） |
| report | ✅ | ✅ | — | ✅ | 完成（无独立测试） |
| interviews/clients | ✅ | ✅ | ✅ clients.service.spec.ts | ✅ | 完成 |
| insights | ✅ | ✅ | ✅ insights.service.spec.ts | ✅ | 完成 |
| storage | ✅ | ✅ | — | ✅ | 完成（无独立测试） |
| ai-proxy | ✅ | ✅ | — | — | 完成（转发层） |
| dictionary | ✅ | ✅ | — | ✅ | 完成 |
| feature-flags | ✅ | ✅ | — | ✅ | 完成 |
| memories | ✅ | ✅ | — | ✅ | 完成 |
| health | ✅ | — | — | — | 完成（简单健康检查） |

**实体总数**: 21 个（含 copilot-memory, dictionary-node, session-case-link, session-comment, session-insight, tenant-feature, transcript-segment）

**迁移总数**: 13 个（含 RLS 策略、索引）

---

## 前端视图状态（React Views）

| 视图 | API 接入 | Mock 残留 | 状态 |
|------|---------|-----------|------|
| LoginView | ✅ | — | 完成 |
| AdminUsersView | ✅ | — | 完成 |
| AdminDictionaryView | ✅ | — | 完成 |
| FeatureFlagsView | ✅ | — | 完成 |
| CRMView | ✅ | — | 完成 |
| CustomerDetailView | ✅ | — | 完成 |
| CustomerPortraitView | ✅ | — | 完成 |
| SurveySessionsView | ✅ | — | 完成 |
| SurveyTemplatesView | ✅ | — | 完成 |
| SurveyTemplateEditorView | ✅ | — | 完成 |
| SurveyWorkspaceView | ✅ | — | 完成 |
| SurveyInsightsView | ✅ | — | 完成 |
| ExpertWorkbenchView | ✅ | — | 完成 |
| CaseLibraryView | ✅ | — | 完成 |
| MemoryManagementView | ✅ | — | 完成 |

**Services 层**: 18 个文件，100% 真实 API 调用（http.ts 封装 axios + token 拦截 + 401 刷新）

**Hooks**: 5 个，100% 使用 React Query + services

---

## AI 服务状态（FastAPI）

| 服务 | 文件 | 状态 | 说明 |
|------|------|------|------|
| ASR（腾讯云实时） | `services/asr.py` | ✅ 完成 | 流式 + 文件识别 |
| ASR（Whisper 本地） | `services/asr_whisper.py` | ✅ 完成 | 备用方案 |
| LLM（Kimi） | `services/llm.py` | ✅ 完成 | OpenAI-compatible |
| Insight 分析 | `services/insight.py` | ✅ 完成 | 洞察提取 |
| Outline 生成 | `services/outline.py` | ✅ 完成 | 提纲生成 |

**端点总数**: 13 个路由（asr + insight + llm + outline）

---

## 已知 Bug / TODO

### 高优先级
- [x] 创建根目录 `.env`，配置 Kimi API Key、JWT 密钥等
- [x] 执行数据库迁移（14 条，含补充的 is_active / password / refresh_token）
- [x] 导入种子数据（租户 + admin/sales/expert 三个账号，密码 openclaw123）
- [x] Docker Compose 全服务 healthy（修复 6 个启动问题）

### 中优先级（Mock 残留清理）
- [x] `CustomerPortraitView.tsx`：删除 `MOCK_CUSTOMER`，无画像时展示空状态 + 骨架卡
- [x] `FeatureFlagsView.tsx`：`enabled` 全改 `false`，merge 逻辑改为 API 加载后 `?? false`

### 低优先级
- [x] 补充 transcript, report, storage 模块的单元测试（37 个测试全部 PASS）
- [x] 端到端联调（前端 ↔ 后端 ↔ AI 层）
- [x] ASR 性能优化（get_running_loop、专属 ThreadPoolExecutor、beam_size、多段文本 join）
- [x] 安全审计（3 CRITICAL + 5 HIGH 全部修复，见开发日志）
- [x] Module A — tenant_members 迁移（RLS + FK + UNIQUE INDEX，与其他表一致）
- [x] Module B — React Native 移动端 B1-B5（导航/Auth/会话列表/录音工作台/权限）
- [x] Module C — 前端测试补全 C1-C5（22 个测试通过，修复 N+1 bug）
- [x] Module D — 全局 ErrorBoundary + QueryClient 统一 toast 错误处理（RQ v5）
- [x] Module E — GitHub Actions CI/CD（ci.yml: 3 jobs 并行；docker.yml: 3 镜像并行构建）
- [x] Module F — 后端单元测试补全（transcript 7 + report 6 + tenants 11 + transcription-ws 8 = 47 tests PASS）
- [x] Module G — E2E 测试验证（insights 171行 + outline 310行 = 35 tests PASS）
- [ ] 性能测试（ASR 实时流延迟端到端测量）
- [ ] ⚠️ 手动操作：轮换 Moonshot API Key（.env 中 sk-uKT8WRgi... 已暴露，请立即在 Moonshot 控制台轮换）

---

## 开发日志

### 2026-03-12（七次 — Module E/F/G）
- Module E：GitHub Actions CI/CD（`.github/workflows/ci.yml` 3 并行 job：backend lint/build/test、frontend typecheck/test/build、ai mypy/pytest；`.github/workflows/docker.yml` 3 镜像并行构建，SHA tag）
- Module F：后端单元测试补全（transcript.service.spec 7 tests / report.service.spec 6 tests / tenants.service.spec 11 tests / transcription.gateway.spec 8 tests；共 47 tests 全 PASS）
- Module G：E2E 测试验证完成（insights.e2e-spec 171行 + outline.e2e-spec 310行；共 35 tests 全 PASS）

### 2026-03-12（四次 — Module A/B/C/D）
- Module A：新增 tenant_members 迁移（#16），含 RLS policy / UNIQUE(tenant_id,user_id) / FK CASCADE
- Module B：React Native 移动端完整搭建（B1 store+http+api / B2 LoginScreen / B3 SessionsScreen / B4 RecordingScreen+ASR / B5 导航守卫+AndroidManifest）
- Module C：前端测试补全（useWorkspaceSession/SurveyWorkspaceView/AdminUsersView/CaseLibraryView/SurveySessionsView，共 22 个测试通过）；同步修复 N+1 bug（persistSegments 改用 bulkCreate）
- Module D：全局 ErrorBoundary（class component + 中文 fallback UI）；QueryClient 改造（QueryCache/MutationCache onError → toast，throwOnError: false）

### 2026-03-12（三次 — 安全审计修复）
- 安全审计完成（3 CRITICAL / 5 HIGH / 5 MEDIUM / 4 LOW）
- CRITICAL-2：修复 tenant-context.interceptor.ts SQL 注入（SET LOCAL → set_config() 参数化）
- CRITICAL-3：refreshToken 从 localStorage persist 移除（仅存内存）
- HIGH-4：JWT_SECRET fallback 改 getOrThrow()（启动时报错而非使用弱 secret）
- HIGH-1：添加 ThrottlerModule 全局限流（30次/分），login 端点额外限制（5次/分）
- HIGH-2：文件上传添加 MIME 类型白名单（仅允许 8 种音频格式）
- HIGH-3：文件下载添加 UUID 格式校验 + sendFile root 从 '/' 改为 uploadDir
- HIGH-5：WebSocket ASR /stream 添加 JWT 认证（query param token 验证）
- MEDIUM-1：ChatDto model 字段添加 IsIn 白名单
- MEDIUM-3：Swagger UI 生产环境隐藏（NODE_ENV !== 'production' 才挂载）
- MEDIUM-5：LLM SSE 流异常消息替换为通用提示（不泄露内部 exception）
- MED-2：RefreshTokenDto 添加 @MaxLength(512) 防止 bcrypt DoS
- LOW-1：审计日志写入失败改为 logger.warn（不再静默吞错）
- LOW-4：AI Proxy axios maxContentLength 从 Infinity 改为 50MB
- ⚠️ 待用户操作：轮换 Moonshot API Key

### 2026-03-12（二次）
- Docker Compose 全服务 healthy（9 个容器）
- 修复启动问题：端口冲突、enum 迁移、uploads 权限、celery_tasks 缺失、IPv6 healthcheck、JWT_REFRESH_SECRET 缺失
- 补充迁移 #12（is_active + password）、#13（refresh_token）
- 种子数据导入：租户"中科琉光"+ admin/sales/expert 三账号
- 端到端联调通过：登录 → JWT → 后端代理 → AI LLM → 前端 5174 全链路 OK
- 服务端口：前端 :5174 / 后端 :4001 / AI :8002 / MinIO :9001

### 2026-03-12
- Phase 0 完成：`openclaw-suite/` → `frontend/` 迁移完成
- 全栈代码扫描完成（frontend + backend + ai 三层）
- 创建本 PLAN.md 进度追踪文件
- 前端：Services 18 个 + Hooks 5 个 + Views 15 个全部实现
- 后端：13 个模块 + 21 个实体 + 13 个迁移文件全部就位
- AI 层：5 个服务 + 13 个端点全部实现
- 清理 `CustomerPortraitView.tsx` mock（删除 MOCK_CUSTOMER，改为空状态）
- 清理 `FeatureFlagsView.tsx` mock（enabled 默认值改 false，merge 逻辑修正）
- 前端 Views 状态更新为 15/15 完成

---

## 如何更新本文件

每次完成一个模块或修复一个问题后：
1. 更新对应表格中的状态
2. 在"已知 Bug / TODO"中划掉完成项（`- [x]`）
3. 在"开发日志"顶部追加一条记录（日期 + 内容摘要）
4. 更新文件顶部的"最后更新"日期
