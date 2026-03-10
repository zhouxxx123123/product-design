# Agent 完全使用手册

> 本项目当前可用 **22 个 Agent**，覆盖编程开发、数据库、测试、安全、性能、CI/CD、产品策略等全场景。
> 本文档帮助你快速理解每个 Agent 的能力边界、触发时机和最佳协作方式。

---

## 目录

- [0. 总览速查表](#0-总览速查表)
- [一、编程专家 Agent（dev-kit）](#一编程专家-agentdev-kit)
  - [nestjs-expert](#1-nestjs-expert)
  - [react-expert](#2-react-expert)
  - [python-expert](#3-python-expert)
  - [typescript-pro](#4-typescript-pro)
- [一B、数据库 Agent（dev-kit）](#一b数据库-agentdev-kit)
  - [postgres-expert](#5-postgres-expert)
  - [typeorm-expert](#6-typeorm-expert)
- [一C、质量保障 Agent（dev-kit）](#一c质量保障-agentdev-kit)
  - [jest-expert](#7-jest-expert)
  - [code-reviewer](#8-code-reviewer)
  - [bug-fixer](#9-bug-fixer)
- [一D、工程效能 Agent（dev-kit）](#一d工程效能-agentdev-kit)
  - [security-auditor](#10-security-auditor)
  - [performance-optimizer](#11-performance-optimizer)
  - [devops-engineer](#12-devops-engineer)
- [二、全局 Product/Strategy Agent](#二全局-productstrategy-agent)
  - [strategy-consultant](#13--strategy-consultant)
  - [engineer](#14--engineer)
  - [user-researcher](#15--user-researcher)
  - [executive](#16--executive)
- [三、项目专属 Agent（consulting-agents）](#三项目专属-agentconsulting-agents)
  - [strategy-consultant（项目版）](#17--strategy-consultant项目版)
  - [executive-summarizer](#18--executive-summarizer)
  - [data-analyst](#19--data-analyst)
  - [devils-advocate](#20--devils-advocate)
  - [client-stakeholder](#21--client-stakeholder)
  - [industry-expert](#22--industry-expert)
- [四、Agent 协作模式](#四agent-协作模式)
- [五、触发关键词速查](#五触发关键词速查)

---

## 0. 总览速查表

| # | Agent 名称 | 来源 | 一句话职责 | 典型触发词 |
|---|-----------|------|-----------|-----------|
| 1 | `nestjs-expert` | dev-kit | NestJS 后端架构与 API 实现 | 模块、Controller、Service、Guard、DTO、Swagger |
| 2 | `react-expert` | dev-kit | React 组件与状态管理 | 组件、Hook、状态、Context、性能优化、前端 |
| 3 | `python-expert` | dev-kit | Python 代码质量与 AI 处理层 | Python、脚本、AI处理、异步、pytest |
| 4 | `typescript-pro` | dev-kit | TypeScript 高级类型系统 | 类型定义、泛型、类型安全、tRPC、tsconfig |
| 5 | `postgres-expert` | dev-kit | PostgreSQL 设计、查询、性能调优 | SQL、索引、EXPLAIN、分区、迁移、数据库设计 |
| 6 | `typeorm-expert` | dev-kit | TypeORM 实体、迁移、QueryBuilder | 实体、migration、关联关系、QueryBuilder |
| 7 | `jest-expert` | dev-kit | 全栈测试（Jest/RTL/pytest） | 写测试、单测、e2e、测试覆盖率、mock |
| 8 | `code-reviewer` | dev-kit | 代码复查（正确性/安全/性能） | review、代码审查、提交前检查 |
| 9 | `bug-fixer` | dev-kit | 系统性调试与根因分析 | bug、报错、崩溃、测试失败、异常 |
| 10 | `security-auditor` | dev-kit | 安全审计（OWASP/数据隐私） | 安全、漏洞、认证、权限、数据保护、GDPR |
| 11 | `performance-optimizer` | dev-kit | API/DB/React 性能优化 | 慢查询、性能、优化、缓存、N+1 |
| 12 | `devops-engineer` | dev-kit | Docker、CI/CD、GitHub Actions | 部署、Docker、流水线、环境配置、容器 |
| 13 | `(◆_◆) strategy-consultant` | 全局 | 战略框架分析与商业建议 | 战略、竞争分析、市场、商业模式、框架 |
| 14 | `(@_@) engineer` | 全局 | 技术可行性评审与架构建议 | 技术评审、可行性、架构、工作量 |
| 15 | `(^◡^) user-researcher` | 全局 | 用户研究与洞察提炼 | 用户访谈、痛点、Persona、需求分析 |
| 16 | `(ಠ_ಠ) executive` | 全局 | 向高管汇报与利益相关方沟通 | 执行摘要、汇报、商业论证、stakeholder |
| 17 | `(◆_◆) strategy-consultant` | 项目专属 | 同上，额外可调度子 Agent | 同上，用于多 Agent 辩论场景 |
| 18 | `(📝) executive-summarizer` | 项目专属 | 将长文档精炼为 1 页执行摘要 | 总结、摘要、提炼、浓缩、1页 |
| 19 | `(📊) data-analyst` | 项目专属 | 量化数据分析与 KPI 设计 | 数据、指标、KPI、分析、市场规模 |
| 20 | `(⚡) devils-advocate` | 项目专属 | 建设性批评与方案压测 | 质疑、风险、挑战、反驳、压测、盲点 |
| 21 | `(👔) client-stakeholder` | 项目专属 | 模拟客户高管视角与异议 | 客户视角、CEO想法、模拟、异议预演 |
| 22 | `(🏦) industry-expert` | 项目专属 | 行业垂直知识与监管背景 | 行业背景、监管、竞争格局、医疗、制造 |

---

## 一B、数据库 Agent（dev-kit）

---

### 5. postgres-expert

**定位**：PostgreSQL 数据库的全能专家——从 Schema 设计到慢查询调优。

#### 核心能力

| 能力域 | 具体内容 |
|--------|---------|
| **Schema 设计** | 范式化/反范式权衡、分区策略、表注释规范 |
| **索引** | B-tree/GIN/GiST/BRIN 选型、复合索引、部分索引、并发创建 |
| **查询优化** | EXPLAIN ANALYZE 解读、执行计划分析、统计信息更新 |
| **PG 特性** | JSONB、数组类型、全文搜索、pg_trgm、row-level security |
| **迁移** | 零停机迁移模式（分步添加列）、rollback 策略 |
| **事务** | 隔离级别选择、死锁预防、advisory locks |
| **安全** | RLS、角色权限最小化、列加密（pgcrypto） |
| **备份** | PITR、pg_dump 策略、恢复演练 |

#### 安全规则（必须遵守）

**以下操作需要明确确认才会执行：**
- `DROP TABLE` / `TRUNCATE` / `DROP DATABASE`
- 无 WHERE 子句的 `DELETE FROM`
- 大表上的锁定 `ALTER TABLE`
- 任何含 `CASCADE` 的破坏性操作

#### 与 typeorm-expert 协作

```
postgres-expert（设计索引策略 + 分析慢查询）
    ↕
typeorm-expert（用 @Index() 装饰器 + QueryBuilder 实现）
```

---

### 6. typeorm-expert

**定位**：NestJS + TypeORM 的 ORM 层专家，处理实体设计、迁移管理和复杂查询。

#### 核心能力

| 能力域 | 具体内容 |
|--------|---------|
| **实体设计** | 装饰器配置、关联关系、UUID 主键、软删除 |
| **迁移管理** | 生成、审查、运行、回滚的完整工作流 |
| **QueryBuilder** | 复杂 JOIN、子查询、分页、条件拼接 |
| **事务** | QueryRunner 多步事务、嵌套事务 |
| **生命周期** | @BeforeInsert/@AfterUpdate 等 Subscriber |
| **连接池** | pool size 调优、connection timeout 配置 |

#### 迁移黄金规则

```bash
# 生成后必须先 review SQL，再运行
npx typeorm migration:generate src/migrations/Name -d src/data-source.ts
# → 检查生成的 SQL
npx typeorm migration:run -d src/data-source.ts
```

- **永远不用** `synchronize: true` 在生产环境
- 每个 migration 必须有可工作的 `down()` 方法
- 大表变更用分步零停机模式（先加可空列 → 回填 → 加约束）

---

## 一C、质量保障 Agent（dev-kit）

---

### 7. jest-expert

**定位**：全栈测试专家，覆盖 NestJS（Jest）、React（RTL）、Python（pytest）三个层。

#### 测试分层策略

```
单元测试（Unit）   → 每个 Service/函数独立测试，mock 依赖
集成测试（Integration） → 模块间交互，真实 DB（事务回滚）
e2e 测试（E2E）   → HTTP 请求到响应的完整链路
组件测试（RTL）   → React 组件的用户行为模拟
```

#### 关键原则

- 测试用户行为，不测实现细节（不测私有方法）
- 每个测试只验证一个概念
- 数据库测试用事务包裹，测试结束后回滚
- 不用 `setTimeout` / `sleep`，用 `waitFor` / `async/await`
- 覆盖率 ≥ 80%（业务逻辑层），但覆盖率不是目标

#### 何时调用

✅ 实现任何功能后 → 写对应测试
✅ 测试失败 → 分析失败原因
✅ 需要 mock 策略 → NestJS TestingModule 搭建
✅ React 组件交互测试

---

### 8. code-reviewer

**定位**：提交前的最后一道关卡，系统性审查代码的正确性、安全性、性能和可维护性。

#### 审查框架（固定顺序）

```
1. 理解意图（这段代码想做什么）
2. 正确性（是否按预期工作）
3. 安全性（OWASP Top 10 快速扫描）
4. 性能（N+1、缺失索引、同步阻塞）
5. 可维护性（命名、职责单一、魔法数字）
6. 测试（边界情况有没有测到）
7. 规范（符合 CLAUDE.md 约定吗）
```

#### 严重程度分级

| 标记 | 含义 | 要求 |
|------|------|------|
| 🔴 Must Fix | 正确性/安全 bug | 部署前必须修复 |
| 🟡 Should Fix | 性能/维护性问题 | 本次 PR 内修复 |
| 🔵 Consider | 优化建议 | 可以下个迭代 |
| 💡 Suggestion | 可选改进 | 仅供参考 |

#### 使用方式

每次功能开发完成，运行前让 code-reviewer 审查一遍，比在生产发现问题便宜 100 倍。

---

### 9. bug-fixer

**定位**：系统性调试专家。不猜测，只诊断。根因分析优先，修复其次。

#### 诊断流程（固定 5 步）

```
1. REPRODUCE → 能稳定复现吗？什么条件触发？
2. ISOLATE   → 哪一层出问题？二分法定位
3. UNDERSTAND → 为什么会这样？读懂错误信息
4. FIX       → 最小化修改，不顺手重构
5. VERIFY    → 跑测试，检查边界情况
```

#### 常见 Bug 速查

| 症状 | 最可能原因 |
|------|-----------|
| `Cannot read property of undefined` | null 检查缺失 / 异步未 await |
| 无限重渲染 | useEffect 依赖数组里有对象字面量 |
| TypeORM 查询返回空 | 关联名错误 / 漏了 leftJoinAndSelect |
| JWT 一直无效 | 时钟偏差 / secret 不一致 / header 格式错 |
| Python 返回 coroutine 对象 | 调用处漏了 `await` |
| 死锁 | 两个事务以不同顺序获取锁 |

---

## 一D、工程效能 Agent（dev-kit）

---

### 10. security-auditor

**定位**：B2B SaaS 安全专家，专注数据隐私、认证授权、API 安全。

#### 本项目特殊安全考量

你的产品处理：
- **客户访谈录音**（高度敏感的音频 + 转写文本）
- **B2B 商业情报**（客户公司痛点、业务数据）
- **多租户数据**（不同渠道商之间必须数据隔离）

#### 审计优先级（从高到低）

```
1. 多租户数据隔离（最高风险：A公司看到B公司数据）
2. 录音/转写数据的加密存储
3. JWT 实现正确性（算法、过期、revocation）
4. 所有路由的 Guard 覆盖
5. LLM Prompt 注入（用户数据嵌入 prompt 的风险）
6. PII 数据不进日志
7. Rate limiting
8. CORS 配置
```

#### 何时调用

- 实现任何认证/权限相关功能后
- 处理文件上传前
- 接入 LLM API 前（prompt 注入风险）
- 生产部署前的全量安全审计

---

### 11. performance-optimizer

**定位**：性能瓶颈定位与优化，覆盖 API、数据库、React 三个层。

#### 黄金原则

**先测量，再优化。** 任何优化都要有 before/after 数据。

#### 性能目标基准

| 指标 | 目标 | 告警阈值 |
|------|------|---------|
| API 响应 p95 | < 200ms | > 500ms |
| 数据库查询 p95 | < 50ms | > 200ms |
| React FCP | < 1.5s | > 3s |

#### 最常见的性能问题

1. **N+1 查询**：循环里查数据库 → 改用 JOIN 或批量查询
2. **缺失索引**：大表全表扫描 → EXPLAIN ANALYZE 确认后加索引
3. **事件循环阻塞**：Node.js 主线程做 CPU 密集计算 → 移到 worker
4. **React 不必要的重渲染**：对象/函数在渲染时新建 → useMemo/useCallback
5. **未使用缓存**：频繁查询不变的数据 → Redis 缓存

#### 何时调用

- API 响应慢（> 500ms）
- 数据库查询慢（EXPLAIN 显示 Seq Scan）
- React 页面卡顿（DevTools Profiler 显示长渲染）
- 压测前的性能分析

---

### 12. devops-engineer

**定位**：容器化和 CI/CD 流水线专家，让代码安全、自动地跑到生产环境。

#### 核心产出

| 产出物 | 说明 |
|--------|------|
| **Dockerfile** | 多阶段构建，生产镜像最小化 |
| **docker-compose.yml** | 本地完整开发环境（包含 PostgreSQL） |
| **GitHub Actions** | test → build → migrate → deploy 全流水线 |
| **环境配置模板** | `.env.example`，secrets 管理规范 |
| **健康检查** | NestJS `/health` 端点 + Docker healthcheck |
| **部署 Runbook** | 上线步骤 + 回滚步骤 |

#### 数据库迁移在 CI/CD 中的安全流程

```
新代码部署前 → 先跑 migration → 再切流量
（migration 必须向后兼容，新旧代码都能运行）
```

#### 何时调用

- 搭建项目时配置本地 Docker 环境
- 设置 GitHub Actions 自动化测试
- 配置生产部署流水线
- 环境变量/Secret 管理方案

---

## 一、编程专家 Agent（dev-kit）

> **来源**：`claude-dev-kit/.claude/agents/`（软链接到本项目 `.claude/agents/`）
> **技术栈**：TypeScript + Python / NestJS + React

---

### 1. nestjs-expert

**定位**：NestJS 后端架构的全职专家，负责从模块设计到 API 交付的全流程。

#### 核心能力

| 能力域 | 具体内容 |
|--------|---------|
| **依赖注入** | DI 容器、IoC 模式、Provider 注册、Scope 管理（DEFAULT/REQUEST/TRANSIENT） |
| **模块化架构** | Feature Module 拆分、SharedModule、DynamicModule、模块边界设计 |
| **中间件** | 全局/路由级 Middleware，日志、认证、请求追踪 |
| **异常处理** | 全局 ExceptionFilter，统一错误响应格式，HTTP 异常映射 |
| **数据验证** | Pipe + class-validator，DTO 定义，ValidationPipe 全局注册 |
| **权限控制** | AuthGuard、RolesGuard、RBAC 设计，JWT/Session 集成 |
| **横切关注点** | Interceptor 实现缓存、日志、响应转换、超时控制 |
| **自定义装饰器** | 参数装饰器、方法装饰器、类装饰器封装复用逻辑 |
| **测试** | Jest 单元测试、e2e 测试，TestingModule 搭建 |
| **API 文档** | Swagger/OpenAPI 自动生成，@ApiTags/@ApiProperty 注解 |

#### 工作方式

```
接到需求 → 按 Feature Module 拆分
每个 Module 包含：
  ├── *.module.ts      # 模块声明，imports/providers/controllers
  ├── *.controller.ts  # 只处理 HTTP，调用 Service
  ├── *.service.ts     # 业务逻辑
  ├── dto/             # 请求/响应数据结构 + 验证规则
  └── entities/        # 数据库实体（TypeORM/Prisma）
```

#### 输出物

- 完整 Feature Module 代码（controller + service + dto + module）
- 全局 Guard/Filter/Interceptor/Pipe 配置
- Jest 测试文件
- Swagger 文档注解
- Quality Checklist（见下）

#### Quality Checklist（每次输出前自检）

- [ ] 所有模块职责清晰，无跨界调用
- [ ] 所有入参经过 Pipe + DTO 验证
- [ ] 全局 ExceptionFilter 已覆盖
- [ ] 敏感路由已加 Guard
- [ ] 日志/性能监控 Interceptor 已挂载
- [ ] 关键路径有 Jest 测试
- [ ] Swagger 注解完整

#### 何时调用

✅ **应该调用**：
- 创建新的 API 模块（CRUD、业务逻辑）
- 设计认证/鉴权方案
- 实现数据验证规则
- 搭建全局异常处理
- 配置 Swagger 文档

❌ **不应调用**：
- 纯前端组件（交给 react-expert）
- Python AI 处理逻辑（交给 python-expert）
- TypeScript 类型定义设计（先交给 typescript-pro）

#### 与 typescript-pro 的协作

```
typescript-pro 先定义 DTO 类型接口
    ↓
nestjs-expert 基于类型实现 DTO class + 验证装饰器
    ↓
两者共享类型定义，前后端一致
```

---

### 2. react-expert

**定位**：React 前端的组件设计、状态管理和性能优化专家。

#### 核心能力

| 能力域 | 具体内容 |
|--------|---------|
| **组件设计** | 函数组件、Props 设计、组件拆分原则、原子设计（Atoms→Molecules→Organisms→Pages） |
| **状态管理** | useState、useReducer、Context API、Zustand（复杂全局状态） |
| **副作用处理** | useEffect 正确使用、清理函数、依赖数组管理 |
| **性能优化** | React.memo、useMemo、useCallback、懒加载（Suspense/lazy） |
| **自定义 Hook** | 封装复用逻辑，use 前缀命名，关注点分离 |
| **错误边界** | ErrorBoundary 组件，防止白屏 |
| **无障碍** | ARIA 属性、键盘导航、语义化 HTML |
| **测试** | React Testing Library、组件单元测试、用户行为模拟 |

#### 工作方式

```
接到 UI 需求 → 分析组件层级
组件文件结构：
  ComponentName/
  ├── index.tsx          # 组件本体
  ├── ComponentName.test.tsx  # 测试
  ├── types.ts           # Props 类型（优先从 shared/ 导入）
  └── hooks/             # 该组件专属 Hook（如果复杂）
```

**组件拆分原则**：
- 一个组件只做一件事（单一职责）
- 超过 150 行考虑拆分
- 重复逻辑抽成 Custom Hook
- 纯展示组件与数据逻辑分离

#### 输出物

- 函数组件代码（TypeScript）
- Custom Hook（业务逻辑分离）
- React Testing Library 测试
- 性能优化建议报告

#### 何时调用

✅ **应该调用**：
- 创建 UI 组件（表单、列表、引导界面等）
- 优化渲染性能（不必要的 re-render）
- 设计 Custom Hook 封装 API 调用逻辑
- 状态管理方案选型
- 无障碍问题修复

❌ **不应调用**：
- API 路由实现（交给 nestjs-expert）
- TypeScript 高级类型设计（交给 typescript-pro）

#### 与 typescript-pro 的协作

```
typescript-pro 定义 Props 类型、API 响应类型
    ↓
react-expert 直接导入类型，保证前后端类型一致
    ↓
无需手写重复类型，全栈类型安全
```

---

### 3. python-expert

**定位**：Python 代码质量专家，负责 AI 处理层、数据脚本、后端工具的实现。

#### 核心能力

| 能力域 | 具体内容 |
|--------|---------|
| **代码规范** | PEP 8、black 格式化、isort 导入排序、pylint/flake8 |
| **类型系统** | Type hints 全覆盖、mypy 静态检查、TypedDict、Protocol |
| **异步编程** | asyncio、async/await、异步上下文管理器、并发控制 |
| **高级特性** | 装饰器（功能增强/缓存/重试）、生成器、上下文管理器、元类 |
| **错误处理** | 自定义异常层级、结构化错误信息、优雅降级 |
| **测试** | pytest、fixtures、parametrize、mock、coverage 报告 |
| **性能** | 性能分析（cProfile）、内存优化、生成器替代列表 |
| **安全** | SQL 注入防护、输入验证、密钥管理 |

#### 工作方式

```
Python 模块结构（AI 处理层）：
  ai/
  ├── __init__.py
  ├── services/          # 业务逻辑（调用 LLM、处理转写等）
  │   ├── transcription.py
  │   ├── outline_generator.py
  │   └── case_matcher.py
  ├── models/            # 数据模型（Pydantic）
  ├── utils/             # 工具函数
  └── tests/             # pytest 测试
```

**mypy 检查流程**：
```bash
mypy ai/ --strict          # 严格模式类型检查
pytest ai/tests/ -v        # 运行测试
coverage report            # 查看覆盖率
```

#### 在本项目的职责划分

| 功能 | 由谁实现 |
|------|---------|
| 录音转文字调用 API | python-expert |
| LLM 提纲生成逻辑 | python-expert |
| 案例向量匹配算法 | python-expert |
| HTTP 接口暴露给 NestJS | python-expert（FastAPI）或 nestjs-expert（直接调用） |
| 业务路由/权限控制 | nestjs-expert |
| 前端展示 | react-expert |

#### 何时调用

✅ **应该调用**：
- AI/LLM 集成（调用讯飞、OpenAI、Deepseek 等）
- 录音转文字处理管道
- 数据处理脚本
- 算法实现（案例匹配相似度计算）
- Python 代码 review（PEP8/类型/测试）

❌ **不应调用**：
- NestJS 模块设计（交给 nestjs-expert）
- React 组件（交给 react-expert）

---

### 4. typescript-pro

**定位**：TypeScript 类型系统的深度专家，不单独写业务，专注类型设计与全栈类型安全。

> **重要**：这是一个"类型架构师"角色，通常在其他 Agent 开始实现之前先介入，定义好类型契约。

#### 核心能力

| 能力域 | 具体内容 |
|--------|---------|
| **基础严格化** | strict 模式、noImplicitAny、strictNullChecks、exactOptionalPropertyTypes |
| **条件类型** | `T extends U ? X : Y`，灵活 API 类型推导 |
| **映射类型** | Partial、Required、Pick、Omit，自定义映射 |
| **模板字面量** | 字符串类型组合，事件名、路由名类型安全 |
| **判别联合** | 状态机类型，穷举检查 |
| **品牌类型** | Branded Types 防止类型混用（如 UserId vs SessionId） |
| **infer 推导** | 从复杂类型中提取子类型 |
| **全栈类型共享** | tRPC 端到端类型、共享类型包（`shared/types`） |
| **tsconfig 优化** | project references、incremental 编译、path mapping |
| **类型测试** | `expect-type`、`tsd` 验证类型正确性 |

#### 工作方式（Type-Driven Development）

```
1. 先定义领域模型类型（Domain Types）
2. 定义 API 契约类型（Request/Response DTOs）
3. 定义前端 Props 类型
4. 生成共享类型包（shared/types/）
5. 后端/前端 Agent 基于类型实现
```

**类型文件组织**：
```
shared/
└── types/
    ├── domain.ts        # 核心业务实体类型
    ├── api.ts           # API 请求/响应类型
    ├── events.ts        # 事件类型
    └── index.ts         # 统一导出
```

#### 何时调用

✅ **优先调用**（在其他 Agent 开始实现前）：
- 设计新功能的数据模型
- 定义前后端 API 契约
- 配置 tsconfig / 项目结构
- 发现类型错误需要深度分析
- 需要用 tRPC 保证端到端类型安全

❌ **不需要调用**：
- 写业务逻辑代码（让 nestjs-expert/react-expert 做）
- Python 代码（交给 python-expert）

#### 协作链（最佳实践）

```
typescript-pro（类型设计）
  ↓ 输出 shared/types/
nestjs-expert（后端实现，导入类型）
  + react-expert（前端实现，导入相同类型）
  → 前后端类型自动一致，编译期发现不匹配
```

---

## 二、全局 Product/Strategy Agent

> **来源**：`~/.claude/agents/`（所有项目共享）
> **用途**：产品决策、战略分析、用户研究、高管沟通

---

### 5. (◆_◆) strategy-consultant

**定位**：麦肯锡/BCG 风格的战略顾问，用框架结构化复杂商业问题。

#### 核心框架工具箱

| 框架 | 用途 |
|------|------|
| **波特五力** | 分析行业吸引力和竞争强度 |
| **BCG 矩阵** | 产品/业务组合优先级排序 |
| **价值链分析** | 找出竞争优势来源 |
| **麦肯锡 7S** | 组织变革对齐分析 |
| **Jobs-to-be-Done** | 挖掘用户真实需求 |
| **市场细分** | 目标市场定位 |

#### 分析输出结构

```
1. 问题陈述（What are we solving for?）
2. 关键假设（What do we believe?）
3. 框架应用（How are we structuring the analysis?）
4. 关键发现（What did we discover?）
5. 战略选项（What could we do?）
6. 推荐方案（What should we do?）
7. 实施考量（How do we make it happen?）
8. 风险与缓解（What could go wrong?）
```

#### 在本项目的用法

- 分析调研工具的商业模式（低门槛入口 → 付费咨询转化）
- 竞品分析（市面上已有的销售辅助工具）
- 定价策略设计
- 渠道商推广策略

---

### 6. (@_@) engineer

**定位**：10年+经验的技术评审专家，从工程视角评估可行性和风险。

#### 核心能力

- 技术可行性：能不能做？有哪些约束？
- 复杂度估算：多难？需要多少工作量？
- 潜在挑战：工程团队会踩哪些坑？
- 性能/可扩展性：能支撑规模化吗？
- 安全隐患：哪里会有漏洞？

#### 评审输出结构

```
1. 技术可行性（能否实现）
2. 实现复杂度（难度 + 工作量估算）
3. 关键挑战（技术难点）
4. 性能与扩展性
5. 建议（推荐方案）
6. 开放问题（需要澄清的点）
```

#### 在本项目的用法

- 评审录音转文字方案（讯飞 vs 阿里云 vs Whisper 的技术选型）
- 评审多智能体辩论框架的架构设计
- AI 提纲生成的延迟/成本分析
- 数据安全方案审查

---

### 7. (^◡^) user-researcher

**定位**：8年+ UX 研究专家，从用户行为和心理角度提炼洞察。

#### 核心分析方法

- **痛点识别**：频率 × 严重程度矩阵
- **Jobs-to-be-Done**：用户真正想完成的任务
- **行为 vs 态度**：用户说的 vs 实际做的
- **Persona 精化**：细分用户画像

#### 分析输出结构

```
1. 执行摘要（Top 3 洞察）
2. 关键痛点（排序，附用户原话）
3. 用户行为模式
4. Persona 与细分
5. Jobs-to-be-Done
6. 产品启示
7. 研究缺口
8. 建议后续研究
```

#### 在本项目的用法

- 分析 87 名销售人员的痛点（不会提问、不会讲案例、不会回答客户问题）
- 提炼不同角色的 JTBD（销售 vs 专家顾问）
- 设计用户测试方案（MVP 阶段）
- 分析引导式界面的可用性

---

### 8. (ಠ_ಠ) executive

**定位**：VP/C-level 风格的战略沟通专家，帮你把工作"向上翻译"。

#### 核心能力

- 执行摘要写作（3 bullets 最大化信息密度）
- 向上汇报框架（从"做了什么"到"业务影响是什么"）
- 利益相关方对齐策略
- 预判高管问题和顾虑

#### 沟通输出结构

```
1. 执行摘要（3 bullets max：做了什么/为什么/影响）
2. 业务影响（指标、结果、价值）
3. 战略背景（如何与公司目标连接）
4. 风险与缓解
5. 资源需求
6. 需要的决策（要什么，截止时间）
7. 下一步
```

#### 在本项目的用法

- 给中科琉光管理层写调研工具立项报告
- 将技术进展转化为业务语言向老板汇报
- 设计产品发布的高管沟通方案
- 准备融资/BD 场景的产品介绍材料

---

## 三、项目专属 Agent（consulting-agents）

> **来源**：`consulting-agents/.claude/agents/`
> **特点**：可在多智能体辩论框架（`cli.py`）中调度，互相协作

---

### 9. (◆_◆) strategy-consultant（项目版）

与全局版内容相同，**核心差异**：
- 拥有 `Agent` 工具权限，可以主动调度其他子 Agent
- 适合在 `python cli.py start-debate` 的多智能体辩论中作为主辩手
- 可以协调 data-analyst 做量化分析，再协调 devils-advocate 做压测

---

### 10. (📝) executive-summarizer

**定位**：把 50 页报告变成 1 页精华的"浓缩机器"。

#### 核心原则

- **BLUF（Bottom Line Up Front）**：结论先行，细节在后
- **So What 测试**：每句话必须能回答"这对我意味着什么？"
- **主动语态**："我们建议" 而非 "建议被提出"
- **可扫描**：子弹点、标题、留白

#### 输出格式

```
1. 底线结论（1-2句，核心信息）
2. 背景（为什么重要，2-3句）
3. 关键发现（3-5个要点）
4. 建议（3-5条优先级排序的行动）
5. 关键数字（3-5个最重要的指标）
6. 下一步（责任人 + 时间节点）
```

#### 受众适配

| 受众 | 长度 | 风格 |
|------|------|------|
| CEO | 半页 | 战略性、决断性 |
| 董事会 | 1页 | 治理、风险、长期价值 |
| 客户 | 1页 | 专业、可执行 |
| 内部领导层 | 1页 | 直接、运营导向 |

#### 在本项目的用法

- 将销售调研报告浓缩成专家工作台的"第三层：关键洞察"
- 每次 AI 分析输出后生成 1 页汇报材料
- 产品演示前生成 pitch 摘要

---

### 11. (📊) data-analyst

**定位**：量化分析专家，从数字中提炼可执行的业务洞察。

#### 核心分析能力

| 领域 | 具体能力 |
|------|---------|
| **市场分析** | TAM/SAM/SOM 计算、市场规模估算 |
| **用户分析** | 分层分析、留存/转化漏斗 |
| **财务分析** | 单位经济模型、ROI 测算 |
| **KPI 设计** | 指标体系设计、Dashboard 规划 |
| **竞品数据** | 基准对比、市场份额分析 |
| **运营指标** | 效率指标、容量规划 |

#### 分析输出结构

```
1. 数据概览（来源/范围/质量评估）
2. 核心指标摘要（关键数字和趋势）
3. 深度分析（细分/驱动因素/相关性）
4. 规律识别（趋势/异常/转折点）
5. 根因分析（为什么出现这些规律）
6. 业务含义（对决策的影响）
7. 行动建议（数据驱动的推荐）
8. 数据质量说明（局限性）
```

#### 在本项目的用法

- 设计丢单率/调研质量的衡量指标体系
- 分析 MVP 测试阶段的用户行为数据
- 建立调研工具的 ROI 测算模型（给渠道商看）
- 竞品功能对比的量化评估

---

### 12. (⚡) devils-advocate

**定位**：建设性的"挑刺者"，专门找方案的弱点，帮你在客户面前之前先自我挑战。

#### 核心战术

| 战术 | 说明 |
|------|------|
| **假设挑战** | "我们在假设什么？如果假设不成立呢？" |
| **风险识别** | "最坏情况是什么？概率有多大？" |
| **异议预演** | 模拟 CEO/CFO/老板可能提出的反对意见 |
| **实施现实检查** | "组织真的能执行这个计划吗？" |
| **认知偏差检测** | 确认偏误、过度自信、沉没成本谬误 |
| **替代方案生成** | "还有哪些我们没考虑到的选项？" |

#### 使用方式（固定流程）

```
第1步：你提出完整方案（不要省略细节）
第2步：devils-advocate 系统性拆解
第3步：你逐条回应，解决有效质疑
第4步：强化方案的薄弱环节
第5步：循环直到方案"unkillable"（无懈可击）
```

#### 压测框架

```
1. 假设审计（哪些假设可能不成立）
2. 风险评估（概率 × 影响）
3. 客户异议预演（他们会反对什么）
4. 执行可行性（资源、能力、时间线）
5. 替代方案（有没有更好的路）
6. 证据审查（数据真的支持这个结论吗）
7. 偏差检测（我们是不是陷入了某种思维定式）
8. 压力测试场景（极端情况下怎么样）
```

#### 在本项目的用法

- 压测"销售对着屏幕念问题"的引导式界面设计
- 挑战 12 周 MVP 计划的可行性
- 预演渠道商老板对"再买个工具"的阻力
- 审查 AI 提纲生成的准确性假设

---

### 13. (👔) client-stakeholder

**定位**：高管视角模拟器，让你在真实演示前先经历一遍"客户审讯"。

#### 可扮演的角色

| 角色 | 关注点 | 典型问题 |
|------|--------|---------|
| **CEO** | 战略、增长、竞争优势 | "这怎么让我们比对手强？ROI 是多少？" |
| **CFO** | 财务回报、风险、现金流 | "NPV 是多少？什么时候回本？" |
| **COO** | 执行、流程、资源依赖 | "谁负责？时间线现实吗？与现有流程冲突吗？" |
| **CHRO** | 人员影响、文化、变革管理 | "员工会用吗？需要培训吗？" |
| **CIO/CTO** | 技术可行性、安全、集成 | "与现有系统兼容吗？数据安全怎么保证？" |
| **CMO** | 品牌、客户体验、市场认知 | "客户会怎么看我们？这影响品牌吗？" |
| **法务** | 合规、风险、监管 | "这有法律风险吗？需要什么审批？" |
| **董事会** | 治理、长期价值、ESG | "这符合股东利益吗？" |

#### 在本项目的用法

- 模拟渠道商老板（CEO视角）对调研工具采购决策的心理
- 模拟企业客户 CIO 对数据安全的顾虑
- 演练产品 demo 的 Q&A 环节
- 预判渠道商推广给终端客户时遇到的阻力

---

### 14. (🏦) industry-expert

**定位**：行业垂直知识库，提供监管背景、竞争格局和行业基准。

#### 覆盖行业

| 行业 | 细分领域 |
|------|---------|
| **金融** | 银行、保险、资管、Fintech |
| **医疗/生命科学** | 医院、制药、医疗器械、医保 |
| **零售消费** | 全渠道零售、CPG、电商 |
| **科技/电信** | SaaS、硬件、平台、网络安全 |
| **制造/工业** | 汽车、航空、化工、能源 |

#### 分析输出结构

```
1. 行业概览（规模/增速/结构）
2. 关键玩家（竞争格局/市场份额）
3. 监管环境（关键法规/合规要求/近期变化）
4. 行业基准（典型利润率/效率指标/KPI）
5. 当前趋势（数字化转型/M&A/颠覆力量）
6. 成功要素（什么决定竞争优势）
7. 对客户的启示（这些背景怎么影响具体情况）
```

#### 在本项目的用法

- 提供医疗器械行业的数字化转型背景（重要客户是恩典医疗器械）
- 分析 B2B SaaS 在中国制造业客户中的典型采购决策周期
- 了解不同行业对"销售工具"的接受度差异
- 提供竞品在各行业的渗透情况

---

## 四、Agent 协作模式

### 模式 1：产品功能开发链

适用于：新功能从设计到交付的全流程

```
typescript-pro
  ↓ 定义所有类型（Domain Types / API契约 / Props类型）
  输出：shared/types/*.ts

nestjs-expert                    react-expert
  ↓ 实现后端 API                   ↓ 实现前端组件
  ↓ 导入 shared/types              ↓ 导入 shared/types
  输出：Feature Module             输出：React 组件 + Hooks

python-expert（如果有 AI 处理）
  ↓ 实现 AI 逻辑
  ↓ 暴露 HTTP 接口给 NestJS
  输出：Python 模块 + pytest 测试
```

**示例：开发"智能提纲生成器"功能**
1. `typescript-pro` 定义 `OutlineRequest`、`OutlineResponse` 类型
2. `python-expert` 实现 LLM 调用 + 提纲生成逻辑
3. `nestjs-expert` 实现 `/outline` API 路由，调用 Python 服务
4. `react-expert` 实现提纲展示 + 编辑界面

---

### 模式 2：方案压测链

适用于：重要决策前的多角度审查

```
strategy-consultant
  ↓ 输出完整方案（战略分析 + 推荐）

devils-advocate
  ↓ 系统拆解方案的假设和风险

engineer
  ↓ 评估技术可行性和实现难度

client-stakeholder（选择相关角色）
  ↓ 模拟客户高管的反应和异议

→ 综合所有反馈，迭代方案
```

**示例：评估是否要做小程序版本**
1. `strategy-consultant` 分析小程序 vs Web 的战略得失
2. `devils-advocate` 挑战"销售现场会用手机"这个假设
3. `engineer` 评估小程序开发的技术复杂度和维护成本
4. `client-stakeholder`（模拟 COO）审视运营落地挑战

---

### 模式 3：调研分析链

适用于：将原始调研数据转化为可执行洞察

```
user-researcher
  ↓ 分析访谈记录，提炼痛点和 JTBD

data-analyst
  ↓ 量化痛点频率/严重程度，建立指标

executive-summarizer
  ↓ 浓缩成 1 页管理层报告

executive
  ↓ 优化向上汇报的框架和措辞

→ 输出：可直接向领导汇报的产品立项报告
```

---

## 五、触发关键词速查

当你不确定该用哪个 Agent 时，根据关键词快速定位：

| 你说的话包含… | 调用 Agent |
|-------------|-----------|
| "写一个 NestJS 模块"、"实现 API"、"Guard"、"DTO"、"Swagger" | `nestjs-expert` |
| "写 React 组件"、"做个 Hook"、"状态管理"、"前端页面" | `react-expert` |
| "Python 脚本"、"调用 AI 接口"、"录音转文字处理" | `python-expert` |
| "定义类型"、"TypeScript 泛型"、"端到端类型安全"、"tsconfig" | `typescript-pro` |
| "数据库设计"、"SQL 优化"、"索引"、"EXPLAIN"、"PostgreSQL" | `postgres-expert` |
| "TypeORM 实体"、"写 migration"、"QueryBuilder"、"关联关系" | `typeorm-expert` |
| "写测试"、"单测"、"e2e"、"测试覆盖率"、"mock"、"测试失败" | `jest-expert` |
| "review 代码"、"提交前检查"、"代码审查" | `code-reviewer` |
| "有 bug"、"报错了"、"崩溃"、"为什么不工作" | `bug-fixer` |
| "安全问题"、"有没有漏洞"、"数据保护"、"权限检查"、"GDPR" | `security-auditor` |
| "接口慢"、"慢查询"、"性能优化"、"缓存"、"N+1" | `performance-optimizer` |
| "部署"、"Docker"、"CI/CD"、"GitHub Actions"、"环境配置" | `devops-engineer` |
| "战略分析"、"商业模式"、"竞品分析"、"市场机会"、"麦肯锡框架" | `strategy-consultant` |
| "技术可行性"、"架构评审"、"工作量估算"、"技术风险" | `engineer` |
| "用户痛点"、"访谈分析"、"用户需求"、"Persona" | `user-researcher` |
| "向老板汇报"、"执行摘要"、"说服高管"、"业务论证" | `executive` |
| "浓缩报告"、"1 页总结"、"提炼关键点" | `executive-summarizer` |
| "数据分析"、"设计 KPI"、"市场规模"、"指标体系" | `data-analyst` |
| "挑战一下"、"找找漏洞"、"风险在哪"、"压测方案" | `devils-advocate` |
| "客户会怎么想"、"模拟 CEO"、"预判异议"、"演练 Q&A" | `client-stakeholder` |
| "行业背景"、"监管要求"、"行业基准"、"医疗器械市场" | `industry-expert` |

---

*最后更新：2026年3月 | 文档位置：`product-design/AGENTS-GUIDE.md`*
