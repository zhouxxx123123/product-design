# 数据流转图 — OpenClaw Suite

> 生成时间：2026-03-14
> 最后更新：2026-03-14（修复 2 条断裂流转 + 消除所有 Mock 数据 + 修复 AI Proxy 路由 + 修复 SurveyInsightsView 路由参数）
> 审计范围：92 条数据流
> 状态图例：✅ 真实流转 | ⚠️ 存根/桩实现 | ❌ 链路断裂

---

## 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (React)                             │
│  views/ → services/*.ts → http.ts (axios, baseURL=/api/v1)         │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTP  /api/v1/*
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   NestJS Backend  :3000                             │
│  GlobalPrefix: api/v1                                               │
│  Guards: JwtAuthGuard + RolesGuard + TenantContextInterceptor       │
│  modules/  → controllers → services → TypeORM repositories         │
└──────────┬──────────────────────────────────────┬───────────────────┘
           │ TypeORM                               │ HTTP  /api/v1/*
           ▼                                       ▼
┌──────────────────────┐              ┌────────────────────────────────┐
│  PostgreSQL  :5432   │              │   Python FastAPI  :8000        │
│  pgvector extension  │              │   ai/ (LLM · ASR · Outline ·  │
│  24 migrations       │              │        Insight · Copilot)      │
└──────────────────────┘              └────────────────────────────────┘
```

---

## 一、认证 (Authentication)

```
Frontend                  NestJS                    PostgreSQL
───────                   ──────                    ──────────
POST /auth/login    ──▶   AuthController            UserEntity
                          AuthService.login()   ──▶ bcrypt verify
                          → JWT(access 15m +         ✅ REAL
                              refresh 7d)

POST /auth/register ──▶   AuthController            UserEntity
                          AuthService.register()──▶ hash pw + save
                                                     ✅ REAL

POST /auth/refresh  ──▶   AuthController            UserEntity
                          verify refresh token  ──▶ issue new pair
                                                     ✅ REAL

POST /auth/logout   ──▶   AuthController            —
                          (stateless, 204)            ✅ REAL

GET  /auth/me       ──▶   AuthController            UserEntity
                          UsersService.findById       ✅ REAL
```

**流转状态：5/5 ✅ 全部真实**

---

## 二、用户管理 (Users)

```
Frontend                  NestJS                    PostgreSQL
───────                   ──────                    ──────────
GET  /users         ──▶   UsersController           UserEntity
                          findAll(tenantId,          (soft delete,
                            search, page)    ──▶     pagination)
                                                     ✅ REAL

POST /users         ──▶   create()         ──▶     UserEntity  ✅
PATCH /users/:id    ──▶   update()         ──▶     UserEntity  ✅
DELETE /users/:id   ──▶   softDelete()     ──▶     UserEntity  ✅
```

**流转状态：5/5 ✅ 全部真实**

---

## 三、CRM 客户管理 (Clients)

```
Frontend (CRMView)         NestJS                    PostgreSQL
─────────────────          ──────                    ──────────
GET  /clients       ──▶    ClientsController         ClientProfileEntity
 ↳ search, industry,       findAll(QueryBuilder      (company, name,
   status, page             + filters)       ──▶     industry, status,
                                                      tags, contacts)
                                                      ✅ REAL

GET  /clients/:id   ──▶    findById()       ──▶     ClientProfileEntity ✅
POST /clients       ──▶    create()         ──▶     ClientProfileEntity ✅
PATCH /clients/:id  ──▶    update()         ──▶     ClientProfileEntity ✅
DELETE /clients/:id ──▶    softDelete()     ──▶     ClientProfileEntity ✅
```

**流转状态：5/5 ✅ 全部真实**

---

## 四、调研任务 (Sessions)

```
Frontend (SurveySessionsView)   NestJS                    PostgreSQL
─────────────────────────────   ──────                    ──────────
GET  /sessions          ──▶     SessionsController        InterviewSessionEntity
 ↳ status, clientId,            findAll(QueryBuilder)──▶ (title, status,
   templateId, page                                        clientId, tenantId)
                                                           ✅ REAL

GET  /sessions/:id      ──▶     findById()       ──▶     InterviewSessionEntity ✅
POST /sessions          ──▶     create()         ──▶     InterviewSessionEntity ✅
PATCH /sessions/:id     ──▶     update()         ──▶     InterviewSessionEntity ✅
PATCH /sessions/:id/status ──▶  updateStatus()   ──▶     InterviewSessionEntity ✅
DELETE /sessions/:id    ──▶     softDelete()     ──▶     InterviewSessionEntity ✅

GET  /sessions/:id/comments ──▶ getComments()    ──▶     SessionCommentEntity   ✅
POST /sessions/:id/comments ──▶ addComment()     ──▶     SessionCommentEntity   ✅
GET  /sessions/:id/cases    ──▶ getCaseLinks()   ──▶     SessionCaseLinkEntity  ✅
POST /sessions/:id/cases    ──▶ addCaseLink()    ──▶     SessionCaseLinkEntity  ✅
```

**流转状态：10/10 ✅ 全部真实**

---

## 五、调研模板 (Templates)

```
Frontend (SurveyTemplatesView)  NestJS                    PostgreSQL
──────────────────────────────  ──────                    ──────────
GET  /templates         ──▶     TemplatesController       TemplateEntity
 ↳ type, category, search       findAll(QueryBuilder)──▶ (title, type,
                                                           category,
                                                           sections JSONB)
                                                           ✅ REAL

GET  /templates/categories ──▶  findCategories()          TemplateEntity
                                SELECT DISTINCT      ──▶  category + count
                                                           ✅ REAL

GET  /templates/default-   ──▶  getDefaultStructure()     —
     structure                  hardcoded 4 sections ──▶  无DB查询
                                                           ⚠️ STUB

GET  /templates/:id        ──▶  findById()       ──▶     TemplateEntity ✅
POST /templates            ──▶  create()         ──▶     TemplateEntity ✅
PATCH /templates/:id       ──▶  update()         ──▶     TemplateEntity ✅
PATCH /templates/:id/default──▶ setDefault()     ──▶     TemplateEntity ✅
DELETE /templates/:id      ──▶  softDelete()     ──▶     TemplateEntity ✅
POST /templates/:id/       ──▶  duplicate()      ──▶     TemplateEntity ✅
     duplicate
```

**流转状态：8/9 ✅，1/9 ⚠️（default-structure 为硬编码，功能正常但非DB驱动）**

---

## 六、调研工作台 / 转写 (Transcript)

```
Frontend (SurveyWorkspaceView)  NestJS                    PostgreSQL
──────────────────────────────  ──────                    ──────────
GET  /sessions/:id/transcript ──▶ TranscriptController    TranscriptSegmentEntity
                                   findBySession()  ──▶   (speaker, text,
                                   ORDER BY startMs        startMs, endMs)
                                                           ✅ REAL

POST /sessions/:id/transcript ──▶ create()        ──▶    TranscriptSegmentEntity ✅
POST /sessions/:id/transcript/ ──▶ bulkCreate()   ──▶    TranscriptSegmentEntity ✅
     segments
```

**流转状态：3/3 ✅ 全部真实**

---

## 七、调研洞察 (Insights)

```
Frontend (SurveyInsightsView)   NestJS                    PostgreSQL
─────────────────────────────   ──────                    ──────────
GET  /sessions/:id/insights ──▶ InsightsController        SessionInsightEntity
                                listBySession()    ──▶    (layer, content JSONB,
                                ORDER BY layer             editedBy)
                                                           ✅ REAL

POST /sessions/:id/insights ──▶ create()          ──▶    SessionInsightEntity ✅
PATCH /insights/:id         ──▶ update()          ──▶    SessionInsightEntity ✅

DELETE /insights/:id        ──▶ delete()           ──▶    SessionInsightEntity ✅
                                InsightsController             repo.remove()
                                @Delete('insights/:id')        ✅ REAL

POST /sessions/:id/         ──▶ extractFromSession() ──▶   TranscriptSegmentEntity
     insights/extract           InsightsController              ↓
                                @Post('sessions/:id/         AiProxyService
                                      insights/extract')    .extractInsight()
                                                               ↓
                                                            SessionInsightEntity
                                                            (delete old + save new)
                                                            ✅ REAL
```

**流转状态：5/5 ✅ 全部真实**

---

## 八、案例知识库 (Cases)

```
Frontend (CaseLibraryView)      NestJS                    PostgreSQL
──────────────────────────────  ──────                    ──────────
GET  /cases             ──▶     CasesController           CaseEntity
 ↳ industry, tags, page         findAll(QueryBuilder)──▶ (title, industry,
                                                           tags, features,
                                                           embedding vector)
                                                           ✅ REAL

GET  /cases/:id         ──▶     findById()       ──▶     CaseEntity     ✅
POST /cases             ──▶     create()         ──▶     CaseEntity     ✅
PATCH /cases/:id        ──▶     update()         ──▶     CaseEntity     ✅
DELETE /cases/:id       ──▶     softDelete()     ──▶     CaseEntity     ✅
```

**流转状态：5/5 ✅ 全部真实**

---

## 九、专家记忆 (Memories)

```
Frontend (MemoryManagementView) NestJS                    PostgreSQL
──────────────────────────────  ──────                    ──────────
GET  /memories          ──▶     MemoriesController        CopilotMemoryEntity
 ↳ type, page                   findAll()        ──▶      (type, content,
                                                           tenantId)
                                                           ✅ REAL

GET  /memories/export   ──▶     export()         ──▶     JSON download  ✅
DELETE /memories        ──▶     deleteAll()      ──▶     CopilotMemoryEntity ✅
DELETE /memories/:id    ──▶     deleteOne()      ──▶     CopilotMemoryEntity ✅
```

**流转状态：4/4 ✅ 全部真实**

---

## 十、功能权限开关 (Feature Flags)

```
Frontend (FeatureFlagsView)     NestJS                    PostgreSQL
───────────────────────────     ──────                    ──────────
GET  /feature-flags/        ──▶ FeatureFlagsController    FeatureDefinitionEntity
     enriched                   findAllEnriched()  ──▶    (key, name, desc,
                                ↳ 合并定义表 +              category, iconName)
                                  租户状态表                +
                                                           TenantFeatureEntity
                                                           (key, enabled)
                                                           ✅ REAL

GET  /feature-flags         ──▶ findAll()         ──▶    TenantFeatureEntity ✅
PATCH /feature-flags        ──▶ saveAll()         ──▶    TenantFeatureEntity ✅
                                (upsert batch)
```

**流转状态：3/3 ✅ 全部真实**

---

## 十一、字典/分类体系 (Dictionary)

```
Frontend (AdminDictionaryView)  NestJS                    PostgreSQL
──────────────────────────────  ──────                    ──────────
GET  /dictionary        ──▶     DictionaryController      DictionaryNodeEntity
 ↳ parentId optional            findAll(tree)     ──▶     (name, level,
                                                           parentId, tenantId)
                                                           ✅ REAL

POST /dictionary        ──▶     create()  ──▶            DictionaryNodeEntity ✅
PATCH /dictionary/:id   ──▶     update()  ──▶            DictionaryNodeEntity ✅
DELETE /dictionary/:id  ──▶     softDelete()→cascade──▶  DictionaryNodeEntity ✅
```

**流转状态：4/4 ✅ 全部真实**

---

## 十二、审计日志 (Audit Logs)

```
Frontend (AuditLogsView)        NestJS                    PostgreSQL
────────────────────────        ──────                    ──────────
GET  /audit-logs        ──▶     AuditLogsController       AuditLogEntity
 ↳ userId, action,              findAll(QueryBuilder)──▶  (userId, action,
   entityType, date              + filters + page          entityType,
                                                           metadata JSONB)
                                                           ✅ REAL
```

**流转状态：1/1 ✅ 全部真实**

---

## 十三、租户管理 (Tenants)

```
Frontend (TenantsListView)      NestJS                    PostgreSQL
──────────────────────────      ──────                    ──────────
GET  /tenants           ──▶     TenantsController         TenantEntity ✅
POST /tenants           ──▶     create()         ──▶     TenantEntity ✅
PATCH /tenants/:id      ──▶     update()         ──▶     TenantEntity ✅
DELETE /tenants/:id     ──▶     softDelete()     ──▶     TenantEntity ✅
GET  /tenants/:id/members ──▶   getMembers()     ──▶     TenantMemberEntity ✅
POST /tenants/:id/members ──▶   addMember()      ──▶     TenantMemberEntity ✅
DELETE /tenants/:id/    ──▶     removeMember()   ──▶     TenantMemberEntity ✅
       members/:uid
```

**流转状态：7/7 ✅ 全部真实**

---

## 十四、报告导出 (Reports)

```
Frontend                        NestJS                    PostgreSQL / 文件
────────                        ──────                    ─────────────────
POST /sessions/:id/report/ ──▶  ReportController          ReportJobEntity
     export                     startExport()    ──▶      (status: PROCESSING
                                                           → COMPLETED)
                                                           ✅ REAL

GET  /sessions/:id/report/ ──▶  download()  ──▶          HTML 重建
     download                   exportToHtml()             ✅ REAL

GET  /sessions/:id/export  ──▶  exportReport()            多格式导出
 ↳ format=html/excel/word       ↳ html: 字符串拼接          ✅ REAL
                                ↳ excel: ExcelJS
                                ↳ word: docx library

GET  /report-jobs          ──▶  listJobs()       ──▶     ReportJobEntity ✅
GET  /report-jobs/:jobId   ──▶  getJobStatus()   ──▶     ReportJobEntity ✅
```

**流转状态：5/5 ✅ 全部真实**

---

## 十五、文件存储 (Storage)

```
Frontend                        NestJS                    本地磁盘/S3
────────                        ──────                    ──────────
POST /storage/upload    ──▶     StorageController         StorageFileEntity
 (multipart/form-data)          upload(Multer)    ──▶     ✅ REAL

GET  /storage           ──▶     listFiles()      ──▶     StorageFileEntity ✅
GET  /storage/:fileId   ──▶     getFile()        ──▶     磁盘文件流    ✅
DELETE /storage/:fileId ──▶     softDeleteFile() ──▶     StorageFileEntity ✅
```

**流转状态：4/4 ✅ 全部真实**

---

## 十六、AI 代理层 (AI Proxy)

```
Frontend                  NestJS AiProxy           Python FastAPI
────────                  ─────────────────        ──────────────
POST /ai/llm/chat   ──▶   AiProxyController   ──▶  POST /api/v1/llm/chat
                          chat()                    LlmService.chat()
                          (同步响应)                 → Kimi API      ✅ REAL

POST /ai/llm/chat/  ──▶   chatStream()        ──▶  POST /api/v1/llm/
     stream               pipe SSE                  chat/stream
                                                    → Kimi SSE      ✅ REAL

POST /ai/llm/chat/  ──▶   copilotChatStream() ──▶  POST /api/v1/llm/chat/
     copilot/stream       pipe SSE                  copilot/stream
                          (注入系统提示词)             → STX/ETX       ✅ REAL
                                                      tool_call events

POST /ai/outline/   ──▶   generateOutline()   ──▶  POST /api/v1/outline/
     generate             读取 session.title         generate
                                                    → Kimi 结构化输出 ✅ REAL

POST /ai/outline/   ──▶   optimizeOutline()   ──▶  POST /api/v1/outline/
     optimize                                        optimize        ✅ REAL

POST /ai/insight/   ──▶   extractInsight()    ──▶  POST /api/v1/insight/
     extract              (backend ready)            extract
                          ⚠️ Frontend 未调用           ⚠️ STUB

POST /ai/component/ ──▶   generateComponent() ──▶  POST /api/v1/component/
     generate             存 DB                      generate (if exists)
                                                    ⚠️ 待确认          ⚠️

POST /ai/asr/       ──▶   recognizeAudio()    ──▶  POST /api/v1/asr/
     recognize            转发 FormData               recognize/file
                                                    → 腾讯云 ASR     ✅ REAL
```

**流转状态：6/8 ✅，2/8 ⚠️（insight extract frontend未接入；component generate待确认）**

---

## 十七、实时转写 WebSocket

```
Frontend (SurveyWorkspaceView)
          │
          │ WebSocket  ws://localhost:3000/transcription
          ▼
NestJS TranscriptionWsModule
  TranscriptionGateway
  @WebSocketGateway({ namespace: '/transcription' })
          │
          │ 实时音频帧
          ▼
  腾讯云实时 ASR (streaming)
  → TranscriptSegmentEntity (保存)
          ✅ REAL（Gateway 已实现）
```

---

## 汇总表

| 领域 | 流转条数 | ✅ 真实 | ⚠️ 存根 | ❌ 断裂 |
|------|---------|--------|---------|--------|
| 认证 | 5 | 5 | 0 | 0 |
| 用户管理 | 5 | 5 | 0 | 0 |
| CRM 客户 | 5 | 5 | 0 | 0 |
| 调研任务 | 10 | 10 | 0 | 0 |
| 调研模板 | 9 | 8 | 1 | 0 |
| 转写记录 | 3 | 3 | 0 | 0 |
| 调研洞察 | 5 | 5 | 0 | 0 |
| 案例知识库 | 5 | 5 | 0 | 0 |
| 专家记忆 | 4 | 4 | 0 | 0 |
| 功能权限 | 3 | 3 | 0 | 0 |
| 字典体系 | 4 | 4 | 0 | 0 |
| 审计日志 | 1 | 1 | 0 | 0 |
| 租户管理 | 7 | 7 | 0 | 0 |
| 报告导出 | 5 | 5 | 0 | 0 |
| 文件存储 | 4 | 4 | 0 | 0 |
| AI 代理 | 8 | 6 | 2 | 0 |
| WebSocket | 1 | 1 | 0 | 0 |
| **合计** | **84** | **81** | **3** | **0** |

**整体流转完整度：81/84 = 96%**

---

## 待修复项（按优先级）

### ✅ 已修复（原断裂项）

| # | 问题 | 修复时间 | 状态 |
|---|------|---------|------|
| 1 | `DELETE /insights/:id` 端点缺失 | 2026-03-14 | ✅ 已修复 |
| 2 | `POST /sessions/:id/insights/extract` 缺失 | 2026-03-14 | ✅ 已修复 |

### 🟡 中优先级 — 存根实现

| # | 问题 | 影响 | 修复方案 |
|---|------|------|---------|
| 3 | `GET /templates/default-structure` 返回硬编码 | 默认章节不可配置 | 将默认结构持久化到 DB 表或配置文件（当前功能可用） |
| 4 | AI insight extract frontend 未调用 | ExpertWorkbenchView 无法一键提取洞察 | SurveyInsightsView/ExpertWorkbenchView 接入 insightsApi.extractFromSession() |

### 🟢 低优先级 — 待确认

| # | 问题 | 影响 |
|---|------|------|
| 5 | `POST /ai/component/generate` Python 端点是否存在 | Copilot 动态组件生成 |
