# 业务流程 & 数据流程全面审计报告

**日期**: 2026-03-14
**范围**: 前端 18 个视图 + 13 个 Service + App.tsx + authStore
**方法**: 静态代码审计 + 逐行 onClick/API 调用核查

---

## 核查结论速览

| 指标 | 数量 |
|------|------|
| 审计业务旅程 | 8 条 |
| 审计 API 端点 | 47 个 |
| **发现断点总数** | **34 个** |
| 🔴 P0 关键断点（流程阻断） | **7 个**（本次修复中已全部修复 6 个） |
| 🟠 P1 业务断点（功能残缺） | **8 个** |
| 🟡 P2 数据/状态断点 | **12 个** |
| 🟢 P3 体验/完整度缺口 | **7 个** |

---

## 一、业务流程图

### Journey 1：认证流程

| 步骤 | 用户行为 | 组件 | API 端点 | 状态 |
|------|---------|------|---------|------|
| 1 | 访问系统 | App.tsx → ProtectedRoute | — | ✅ 路由守卫有效 |
| 2 | 账密登录 | LoginView | POST /auth/login | ✅ 调用正确 |
| 3 | Token 写入 store | authStore.setAuth | — | ✅ 含 localStorage 持久化 |
| 4 | 按角色跳转首页 | LoginView navigate | — | ✅ ADMIN→/admin/users, 其他→/crm |
| 5 | 微信登录跳转 | LoginView window.href | GET /auth/wechat | ✅ 发起 OAuth |
| 6 | 回调页读取 token | AuthCallbackView | GET /auth/me | ✅ setAuth 已实现 |
| 7 | 后续请求携带 token | http.ts interceptor | Bearer 注入 | ✅ 自动注入 |
| 8 | 401 自动刷新 | http.ts interceptor | POST /auth/refresh | ✅ 已实现队列刷新 |
| 9 | **登出** | ❌ 无入口 | POST /auth/logout | ❌ **BP-1.1** |

---

### Journey 2：客户档案管理

| 步骤 | 用户行为 | 组件 | API 端点 | 状态 |
|------|---------|------|---------|------|
| 1 | 进入 CRM 列表 | CRMView | GET /clients?search=&industry= | ✅ queryKey 含 searchQuery |
| 2 | 搜索客户 | CRMView input | (触发 useQuery 重查) | ✅ onChange 绑定 |
| 3 | 行业筛选 | CRMView filter modal | (industryFilter state) | ⚠️ **BP-2.1** setter 未连接 |
| 4 | 点击客户行 | CRMView → navigate | GET /crm/:id | ✅ URL 正确更新 |
| 5 | 查看客户详情 | CustomerDetailView | GET /clients/:id | ✅ |
| 6 | 编辑档案 | CustomerDetailView modal | PATCH /clients/:id | ✅ |
| 7 | 切换到调研记录 Tab | CustomerDetailView | GET /sessions?clientId= | ✅ |
| 8 | 切换到关联案例 Tab | CustomerDetailView | GET /cases | ✅ |
| 9 | 查看客户画像 | CustomerPortraitView | GET /clients/:id + LLM | ✅ |
| 10 | 导出客户数据 | CRMView export | clientExportService | ✅ 已实现 CSV/Excel |

---

### Journey 3：调研会话生命周期

| 步骤 | 用户行为 | 组件 | API 端点 | 状态 |
|------|---------|------|---------|------|
| 1 | 新建会话 → 选客户 | SurveySessionsView | GET /clients?limit=50 | ✅ |
| 2 | 选模板 | SurveySessionsView | GET /templates?limit=50 | ✅ |
| 3 | 填写会话信息 | SurveySessionsView | — | ✅ |
| 4 | 提交创建 | SurveySessionsView | POST /sessions (含 templateId) | ✅ |
| 5 | 进入工作台 | SurveyWorkspaceView | GET /sessions/:id + /clients/:id | ✅ |
| 6 | 开始录音 | SurveyWorkspaceView | MediaRecorder (本地) | ✅ |
| 7 | 停止→ASR 识别 | SurveyWorkspaceView | POST /ai/asr/recognize-file | ✅ |
| 8 | 保存转写段 | SurveyWorkspaceView | POST /sessions/:id/transcript/segments | ✅ |
| 9 | 上传文件 | SurveyWorkspaceView | ❌ 仅前端 state | ❌ **BP-3.1** |
| 10 | 生成摘要洞察 | SurveyWorkspaceView | useInsightExtract → AI | ✅ |
| 11 | 进入洞察 | 三点菜单 + 详情弹窗 | navigate /sessions/:id/insights | ✅ |

---

### Journey 4：调研模板管理

| 步骤 | 用户行为 | 组件 | API 端点 | 状态 |
|------|---------|------|---------|------|
| 1 | 查看模板库 | SurveyTemplatesView | GET /templates + /templates/categories | ✅ |
| 2 | 搜索/分类筛选 | SurveyTemplatesView | GET /templates?search=&category= | ✅ queryKey 依赖 |
| 3 | AI 智能生成 | SurveyTemplatesView | POST /ai/llm/chat | ✅ |
| 4 | 新建模板 | SurveyTemplateEditorView | GET /templates/default-structure | ✅ |
| 5 | 修改问题类型 | SurveyTemplateEditorView | — | ❌ **BP-4.1** 无 onClick |
| 6 | 删除问题 | SurveyTemplateEditorView | — | ❌ **BP-4.2** 无 onClick |
| 7 | 保存时长设置 | SurveyTemplateEditorView | — | ❌ **BP-4.3** defaultValue 未入 state |
| 8 | 保存模板 | SurveyTemplateEditorView | POST /templates 或 PATCH /templates/:id | ✅ |
| 9 | 编辑已有模板 | SurveyTemplatesView → Editor | (location.state 传 initialData) | ✅ |
| 10 | 删除/复制/设默认 | SurveyTemplatesView | DELETE/POST duplicate/PATCH setDefault | ✅ |

---

### Journey 5：洞察分析流程

| 步骤 | 用户行为 | 组件 | API 端点 | 状态 |
|------|---------|------|---------|------|
| 1 | 查看洞察列表 | SurveyInsightsView | GET /sessions/:id/insights | ✅ |
| 2 | 按 L1/L2/L3 分层筛选 | SurveyInsightsView | 前端 filter | ✅ |
| 3 | AI 生成洞察 | SurveyInsightsView | POST /sessions/:id/insights/extract | ✅ |
| 4 | 编辑洞察内容 | SurveyInsightsView | PATCH /insights/:id | ✅ |
| 5 | 播放转写音频 | SurveyInsightsView audioRef | ❌ audio 元素无 src | ❌ **BP-5.1** |
| 6 | 相似案例 Tab | SurveyInsightsView | GET /cases (无 sessionId 过滤) | ⚠️ **BP-5.2** |
| 7 | 导出 PDF | SurveyInsightsView | POST export + 立即 download | ⚠️ **BP-5.3** 竞态 |

---

### Journey 6：专家审核流程

| 步骤 | 用户行为 | 组件 | API 端点 | 状态 |
|------|---------|------|---------|------|
| 1 | 查看待审会话列表 | ExpertWorkbenchView | GET /sessions (无状态过滤) | ⚠️ **BP-6.1** |
| 2 | 选中会话 | ExpertWorkbenchView | GET /sessions/:id + insights | ✅ |
| 3 | 查看转写内容 | Tab 切换 | GET /sessions/:id/transcript | ✅ |
| 4 | 查看洞察 | Tab 切换 | 已加载 | ✅ |
| 5 | 关联案例 | prompt() 输入 caseId | POST /sessions/:id/cases | ⚠️ **BP-6.2** prompt UX |
| 6 | 添加批注 | ExpertWorkbenchView | POST /sessions/:id/comments | ✅ |
| 7 | 标记审核完成 | ExpertWorkbenchView | PATCH /sessions/:id/status | ✅ |
| 8 | 卡片洞察数/批注数 | 显示 | 硬编码为 0 | ❌ **BP-6.3** |

---

### Journey 7：案例库管理

| 步骤 | 用户行为 | 组件 | API 端点 | 状态 |
|------|---------|------|---------|------|
| 1 | 查看案例列表 | CaseLibraryView | GET /cases | ✅ |
| 2 | 搜索案例 | CaseLibraryView input | ❌ 无 onChange | ❌ **BP-7.1** |
| 3 | 筛选案例 | 筛选按钮 | ❌ 无 onClick | ❌ **BP-7.2** |
| 4 | 点击卡片展开详情 | CaseLibraryView | GET /cases/:id | ✅ |
| 5 | 创建案例 | CaseLibraryView modal | POST /cases | ✅ |
| 6 | 案例操作菜单 | MoreHorizontal 按钮 | ❌ 无 onClick (stopPropagation 而已) | ❌ **BP-7.3** |

---

### Journey 8：系统管理

| 步骤 | 用户行为 | 组件 | API 端点 | 状态 |
|------|---------|------|---------|------|
| 1 | 用户列表+搜索+分页 | AdminUsersView | GET /users?search=&page= | ✅ |
| 2 | 创建用户 | AdminUsersView modal | POST /users | ✅ |
| 3 | 编辑用户 | AdminUsersView modal | PATCH /users/:id | ✅ |
| 4 | 删除用户 | AdminUsersView | DELETE /users/:id | ✅ |
| 5 | **权限设置** | 三点菜单项 | ❌ 无 onClick | ❌ **BP-8.1** |
| 6 | 导出用户 CSV | AdminUsersView | 前端生成 | ✅ |
| 7 | 字典管理 CRUD | AdminDictionaryView | /dictionaries | ✅ |
| 8 | 功能开关管理 | FeatureFlagsView | GET + POST /feature-flags | ✅ |
| 9 | 审计日志查看 | AuditLogsView | GET /audit-logs | ✅ |
| 10 | 审计日志详情展开 | AuditLogDetailPanel | — | ✅ 组件存在 |
| 11 | 租户管理 | TenantsListView | GET /tenants | ✅ 组件存在 |

---

## 二、数据流程断点清单

### API 调用完整性核查

| 服务模块 | 端点 | 前端调用 | 响应使用 | 状态 |
|---------|------|---------|---------|------|
| Auth | POST /auth/login | ✅ LoginView | user+tokens→setAuth | ✅ |
| Auth | POST /auth/refresh | ✅ http.ts 拦截器 | newToken→setAuth | ✅ |
| Auth | GET /auth/me | ✅ AuthCallbackView | user→setAuth | ✅ |
| Auth | POST /auth/logout | ❌ 无调用 | — | ❌ BP-1.1 |
| Clients | GET /clients | ✅ CRMView | 列表渲染 | ✅ |
| Clients | GET /clients/:id | ✅ CustomerDetailView | 详情渲染 | ✅ |
| Clients | POST /clients | ✅ CRMView modal | 刷新列表 | ✅ |
| Clients | PATCH /clients/:id | ✅ CustomerDetailView | 刷新详情 | ✅ |
| Sessions | GET /sessions | ✅ ExpertWorkbenchView | **无 status 参数** | ⚠️ BP-6.1 |
| Sessions | POST /sessions | ✅ SurveySessionsView | 关闭 modal | ✅ |
| Sessions | PATCH /sessions/:id/status | ✅ ExpertWorkbenchView | 刷新列表 | ✅ |
| Templates | GET /templates | ✅ SurveyTemplatesView | 列表渲染 | ✅ |
| Templates | POST /templates | ✅ SurveyTemplateEditorView | 保存 | ✅ |
| Templates | PATCH /templates/:id | ✅ SurveyTemplateEditorView | 保存 | ✅ |
| Templates | duration 字段 | — | **defaultValue 未入 state** | ❌ BP-4.3 |
| Insights | GET /sessions/:id/insights | ✅ SurveyInsightsView | 分层显示 | ✅ |
| Insights | POST /sessions/:id/insights/extract | ✅ SurveyInsightsView | invalidateQuery | ✅ |
| Insights | PATCH /insights/:id | ✅ SurveyInsightsView | 前端更新 | ✅ |
| Transcript | GET /sessions/:id/transcript | ✅ ExpertWorkbenchView | 转写列表 | ✅ |
| Transcript | POST /sessions/:id/transcript/segments | ✅ SurveyWorkspaceView | — | ✅ |
| Cases | GET /cases | ✅ CaseLibraryView | 列表渲染 | ✅ |
| Cases | GET /cases/:id | ✅ CaseLibraryView (展开) | 详情展开 | ✅ |
| Cases | POST /cases | ✅ CaseLibraryView | 刷新列表 | ✅ |
| Cases | GET /cases (insights tab) | ✅ SurveyInsightsView | **无 sessionId 过滤** | ⚠️ BP-5.2 |
| Report | POST /sessions/:id/report/export | ✅ SurveyInsightsView | **立即调用 download** | ⚠️ BP-5.3 |
| Storage | POST /sessions/:id/files | ❌ 无调用 | uploadedFiles 仅内存 | ❌ BP-3.1 |
| Users | GET /users | ✅ AdminUsersView | 列表+分页 | ✅ |
| Users | POST/PATCH/DELETE /users | ✅ AdminUsersView | CRUD | ✅ |
| Audio | audio.src | ❌ 未设置 | 无法播放 | ❌ BP-5.1 |

---

## 三、断点全量清单（已核实）

### 🔴 P0 — 已在本轮修复（6项）

| ID | 描述 | 文件 | 修复状态 |
|----|------|------|---------|
| P0-1 | 三点菜单无洞察入口 | SurveySessionsView | ✅ 已修复 |
| P0-2 | createSession 不传 templateId | SurveySessionsView | ✅ 已修复 |
| P0-3 | 多选客户只传第一个 | SurveySessionsView | ✅ 已修复（改单选）|
| P0-4 | "编辑模板"按钮无 onClick | SurveyTemplatesView | ✅ 已修复 |
| P0-5 | 刷新丢失 Token 强制重登 | authStore | ✅ 已修复 |
| P0-6 | 微信登录无回调路由 | App.tsx | ✅ 已修复 |

---

### 🟠 P1 — 功能残缺（本次 P1 已修复 3 项，待修 5 项）

| ID | 类型 | 描述 | 文件 | 状态 |
|----|------|------|------|------|
| P1-1 | 业务断点 | 会话详情弹窗无"查看洞察"按钮 | SurveySessionsView | ✅ 已修复 |
| P1-2 | 业务断点 | 案例卡片无法查看详情 | CaseLibraryView | ✅ 已修复（inline展开）|
| P1-5 | 路由断点 | CRM 客户行点击 URL 不更新 | CRMView + App.tsx | ✅ 已修复 |
| **BP-4.1** | 业务断点 | 问题类型按钮无 onClick，用户无法改题型 | SurveyTemplateEditorView:571 | ❌ 待修 |
| **BP-4.2** | 业务断点 | 删除问题按钮（Trash2）无 onClick | SurveyTemplateEditorView:624 | ❌ 待修 |
| **BP-5.1** | 业务断点 | 转写音频 `<audio>` 无 src，无法播放 | SurveyInsightsView:682 | ❌ 待修 |
| **BP-6.1** | 数据断点 | Expert 会话列表无 status 过滤，加载全量数据 | ExpertWorkbenchView:101 | ❌ 待修 |
| **BP-8.1** | 业务断点 | AdminUsers "权限设置"按钮无 onClick | AdminUsersView:364 | ❌ 待修（后端 API 未就绪）|

---

### 🟡 P2 — 数据/状态断点（12 项）

| ID | 类型 | 描述 | 文件 | 影响 |
|----|------|------|------|------|
| **BP-1.1** | 业务断点 | 无登出功能/按钮 | 全局/App.tsx | 用户无法主动退出 |
| **BP-2.1** | 数据断点 | `industryFilter` 有 state 但无 setter，筛选器 modal 无法更新 | CRMView:60 | 行业筛选失效 |
| **BP-3.1** | 数据断点 | 工作台文件上传仅存内存，无后端 API 调用 | SurveyWorkspaceView:338 | 刷新后文件列表丢失 |
| **BP-4.3** | 状态断点 | 模板"预计时长"字段 `defaultValue=45`，无 onChange，保存时丢失 | SurveyTemplateEditorView:680 | duration 永远不保存 |
| **BP-4.4** | 业务断点 | 文件上传/引用链接按钮无 handler（前端仅占位） | SurveyTemplateEditorView:578,586 | 点击无反应 |
| **BP-5.2** | 数据断点 | 洞察页"相似案例"Tab 加载全量 cases，无 sessionId 过滤 | SurveyInsightsView:138 | 展示无关案例 |
| **BP-5.3** | 状态断点 | PDF 导出触发后立即调用 download，未等待后端异步完成 | SurveyInsightsView:185 | 大概率下载失败 |
| **BP-5.4** | 业务断点 | 重复生成洞察不清理旧数据，会产生重复条目 | SurveyInsightsView:204 | 数据污染 |
| **BP-6.2** | 业务断点 | 关联案例使用 `prompt()` 输入 ID，无验证无 UI | ExpertWorkbenchView:154 | 体验极差 |
| **BP-6.3** | 数据断点 | 会话卡片 `insightsCount/commentsCount` 硬编码 0 | ExpertWorkbenchView:111 | 指标显示错误 |
| **BP-7.1** | 业务断点 | 案例库搜索框无 onChange，搜索功能不可用 | CaseLibraryView:108 | 搜索无效 |
| **BP-7.3** | 业务断点 | 案例操作菜单（MoreHorizontal）只 stopPropagation，无菜单弹出 | CaseLibraryView:174 | 无法操作案例 |

---

### 🟢 P3 — 体验/完整度缺口（7 项）

| ID | 描述 | 文件 | 影响 |
|----|------|------|------|
| **BP-3.2** | ASR 识别后 UI 先显示，后端保存失败不回滚 | SurveyWorkspaceView | 数据不一致 |
| **BP-4.5** | AI 建议侧边栏为硬编码静态文案 | SurveyTemplateEditorView:694 | 显示无关建议 |
| **BP-5.5** | 音量滑块无 onChange，不控制音量 | SurveyInsightsView:548 | 音量不可调 |
| **BP-7.2** | 案例库筛选按钮无 onClick | CaseLibraryView:114 | 筛选不可用 |
| **BP-7.4** | 案例库网格/列表切换无实现 | CaseLibraryView:119 | 布局无法切换 |
| **BP-8B.1** | 字典"层级视图"按钮无 onClick | AdminDictionaryView | 视图不可切换 |
| **BP-8C.1** | 功能开关本地改动未保存就导航会丢失 | FeatureFlagsView:93 | 数据丢失风险 |

---

## 四、根因分类

| 根因模式 | 数量 | 代表案例 |
|---------|------|---------|
| **按钮/图标无 onClick** | 11 | BP-4.1/4.2/4.4/7.1/7.3/8.1 |
| **state 创建但无 setter 连接** | 3 | BP-2.1 industryFilter、BP-4.3 duration |
| **API 调用缺少参数（过滤/关联）** | 3 | BP-6.1 status、BP-5.2 sessionId |
| **前端操作无后端同步** | 2 | BP-3.1 文件上传、BP-3.2 ASR 回滚 |
| **异步操作时序错误** | 1 | BP-5.3 PDF 下载竞态 |
| **数据重复/污染** | 1 | BP-5.4 重复生成洞察 |
| **功能缺失（后端未就绪）** | 1 | BP-8.1 权限设置 |

---

## 五、修复优先级建议

### 立即修复（本迭代 P1 级）

```
BP-4.1  问题类型切换 — SurveyTemplateEditorView（核心编辑功能）
BP-4.2  删除问题按钮 — SurveyTemplateEditorView（核心编辑功能）
BP-4.3  duration 保存 — SurveyTemplateEditorView（数据丢失）
BP-5.1  音频播放 src — SurveyInsightsView（转写回放功能）
BP-6.1  会话列表过滤 — ExpertWorkbenchView（性能 + 正确性）
BP-7.1  案例搜索 — CaseLibraryView（核心功能）
BP-1.1  登出功能 — App.tsx（基础安全）
```

### 下个迭代（P2 级）

```
BP-2.1  行业筛选 setter 连接
BP-3.1  文件上传后端 API
BP-5.3  PDF 导出轮询逻辑
BP-5.4  洞察去重/覆盖逻辑
BP-6.2  关联案例 UI 改为案例选择器
BP-7.3  案例操作菜单（编辑/删除/分享）
```

### 规划讨论（P3 级，需产品确认）

```
BP-6.3  insightsCount 需后端 Sessions API 返回聚合字段
BP-8.1  权限设置需后端 RBAC API 就绪
BP-3.2  ASR 失败回滚 UX 策略
BP-8C.1 功能开关离开确认对话框
```

---

*报告生成时间: 2026-03-14 | 覆盖前端代码 ~8,500 行*
