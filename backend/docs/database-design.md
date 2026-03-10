# 数据库设计文档

## 项目概述

**项目名称**: 调研工具 (Research Tool)
**客户**: 中科琉光 (Zhongke Liuguang) Management Consulting
**数据库引擎**: PostgreSQL 15+
**ORM**: TypeORM

---

## 1. ER图说明

### 1.1 核心实体关系

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              多租户架构 (Multi-Tenancy)                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────┐         ┌──────────────────┐         ┌─────────────────────┐   │
│  │   tenants   │◄────────┤  tenant_members  ├────────►│       users         │   │
│  │  (租户)     │   1:N   │  (租户成员关系)   │   N:1   │     (用户)           │   │
│  └─────────────┘         └──────────────────┘         └─────────────────────┘   │
│         │                                                    │                  │
│         │                                                    │                  │
│    ┌────┴────┬────────┬────────┬────────┬────────┐          │                  │
│    │         │        │        │        │        │          │                  │
│    ▼         ▼        ▼        ▼        ▼        ▼          ▼                  │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  ┌──────────┐           │
│ │cases │ │templates│ │client│ │interview│ │recording│ │audit_logs│ │api_keys  │           │
│ │(案例)│ │(模板)  │ │profiles│ │sessions│ │(录音)  │ │(审计日志)│ │(API密钥)│           │
│ └──┬───┘ └──────┘ └──┬───┘ └──┬───┘ └──┬───┘ └──────┘  └──────────┘           │
│    │                  │        │        │                                       │
│    │                  │        │        │                                       │
│    ▼                  │        │        ▼                                       │
│ ┌──────────┐          │        │   ┌─────────────┐                             │
│ │case_     │          │        │   │transcriptions│                             │
│ │features  │          │        │   │  (转录文本)   │                             │
│ │(案例要素)│          │        │   └──────┬──────┘                             │
│ └──────────┘          │        │          │                                     │
│                       │        │          ▼                                     │
│                       │        │   ┌──────────┐                                │
│                       │        │   │ insights │                                │
│                       │        │   │ (洞察)   │                                │
│                       │        │   └──────────┘                                │
│                       │        │                                               │
│                       │        └──────►┌─────────────────────┐                 │
│                       │                │interview_departments│                 │
│                       │                │   (部门配置)         │                 │
│                       │                └──────────┬──────────┘                 │
│                       │                           │                            │
│                       │                           ▼                            │
│                       │                ┌─────────────────────┐                 │
│                       └───────────────►│interview_questions  │                 │
│                                        │   (问题配置)         │                 │
│                                        └─────────────────────┘                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 关系详细说明

| 父表 | 子表 | 关系类型 | 级联行为 | 说明 |
|------|------|----------|----------|------|
| tenants | users | 1:N | ON DELETE SET NULL | 租户拥有多个用户 |
| tenants | tenant_members | 1:N | ON DELETE CASCADE | 租户成员关系 |
| users | tenant_members | 1:N | ON DELETE CASCADE | 用户可属于多个租户 |
| users | interview_sessions | 1:N | ON DELETE SET NULL | 用户创建访谈会话 |
| users | cases | 1:N | ON DELETE SET NULL | 用户创建案例 |
| users | audit_logs | 1:N | ON DELETE CASCADE | 用户产生审计日志 |
| tenants | cases | 1:N | ON DELETE CASCADE | 租户拥有案例库 |
| tenants | client_profiles | 1:N | ON DELETE CASCADE | 租户拥有客户档案 |
| tenants | interview_sessions | 1:N | ON DELETE CASCADE | 租户拥有访谈会话 |
| client_profiles | interview_sessions | 1:N | ON DELETE SET NULL | 客户参与访谈 |
| interview_sessions | recordings | 1:N | ON DELETE CASCADE | 会话拥有录音 |
| interview_sessions | transcriptions | 1:N | ON DELETE CASCADE | 会话拥有转录 |
| interview_sessions | insights | 1:N | ON DELETE CASCADE | 会话产生洞察 |
| interview_sessions | interview_departments | 1:N | ON DELETE CASCADE | 会话配置部门 |
| interview_departments | interview_questions | 1:N | ON DELETE CASCADE | 部门拥有问题 |
| cases | case_features | 1:N | ON DELETE CASCADE | 案例拥有要素 |
| cases | interview_sessions | 1:N | ON DELETE SET NULL | 案例关联会话 |

---

## 2. 核心表设计说明

### 2.1 租户与用户表

#### tenants (租户表)
- **设计目的**: 支持多租户SaaS架构
- **核心字段**:
  - `name`: 租户名称
  - `slug`: URL友好的唯一标识
  - `ai_config`: JSONB存储AI模型配置
  - `settings`: JSONB存储租户级设置
- **索引策略**:
  - 主键: uuid
  - 唯一索引: slug
  - GIN索引: settings (支持JSON查询)

#### users (用户表)
- **设计目的**: 平台用户管理
- **核心字段**:
  - `email`: 登录邮箱，唯一
  - `role`: 用户角色 (admin/consultant/viewer)
  - `tenant_id`: 默认所属租户
- **安全特性**:
  - 密码字段预留但未使用(采用SSO)
  - 支持软删除(deleted_at)

### 2.2 访谈核心表

#### interview_sessions (访谈会话表)
- **设计目的**: 记录一次完整的访谈过程
- **三层信息模型**:
  1. `raw_transcript`: 原始转录文本(保留完整性)
  2. `structured_summary`: 结构化摘要JSONB
  3. `executive_summary`: 高管摘要JSONB
- **关键状态**:
  - `status`: scheduled(预约) → in_progress(进行中) → completed(已完成) → archived(已归档)
- **索引策略**:
  - 复合索引: (tenant_id, interview_date DESC) - 常用查询
  - B-tree索引: client_id, interviewer_id
  - GIN索引: executive_summary (高管摘要JSON查询)

#### recordings (录音表)
- **设计目的**: 存储访谈录音元数据
- **核心字段**:
  - `storage_path`: 对象存储路径(腾讯云COS)
  - `duration_seconds`: 录音时长
  - `file_size_bytes`: 文件大小
  - `status`: pending → processing → completed/failed
- **索引策略**:
  - 复合索引: (session_id, created_at) - 获取会话录音列表

#### transcriptions (转录表)
- **设计目的**: ASR语音识别结果存储
- **核心字段**:
  - `content`: 完整转录文本
  - `segments`: JSONB存储时间戳分段
  - `speaker_labels`: JSONB说话人标识
  - `confidence_score`: ASR置信度
- **索引策略**:
  - GIN全文索引: content (使用pg_trgm或中文分词)

#### insights (洞察表)
- **设计目的**: AI生成的访谈洞察
- **核心字段**:
  - `category`: 洞察分类 (pain_point/need/opportunity/risk/suggestion)
  - `content`: 洞察内容
  - `evidence`: 支撑证据JSONB
  - `confidence_score`: AI置信度
- **索引策略**:
  - 复合索引: (session_id, category) - 按分类查询

### 2.3 案例库表

#### cases (案例表)
- **设计目的**: 结构化案例存储，支持向量搜索
- **核心字段**:
  - `title`: 案例标题
  - `industry`: 行业分类
  - `case_type`: 案例类型 (project/research/insight)
  - `content`: 案例正文
  - `embedding`: vector(1536) - 用于语义搜索
- **索引策略**:
  - ivfflat向量索引: embedding (用于相似度查询)
  - B-tree索引: industry, case_type, is_public

#### case_features (案例要素表)
- **设计目的**: 案例的关键要素提取，支持要素级搜索
- **核心字段**:
  - `case_id`: 所属案例
  - `category`: 要素分类
  - `content`: 要素内容
  - `embedding`: vector(1536) - 要素级向量
- **索引策略**:
  - ivfflat向量索引: embedding
  - 复合索引: (case_id, category)

---

## 3. 索引策略总结

### 3.1 索引类型分布

| 索引类型 | 用途 | 表数量 | 说明 |
|----------|------|--------|------|
| B-tree | 等值查询、范围查询、排序 | 全部表 | PostgreSQL默认索引 |
| GIN | JSONB查询、全文搜索 | 6张表 | settings, executive_summary等 |
| ivfflat | 向量相似度搜索 | 2张表 | cases.embedding, case_features.embedding |
| Partial | 条件过滤查询 | 3张表 | audit_logs, users等 |
| Unique | 唯一约束 | 5张表 | tenants.slug, users.email等 |

### 3.2 关键复合索引

```sql
-- 1. 访谈会话常用查询
CREATE INDEX idx_interview_sessions_tenant_date
ON interview_sessions(tenant_id, interview_date DESC);

-- 2. 审计日志时间范围查询
CREATE INDEX idx_audit_logs_tenant_created
ON audit_logs(tenant_id, created_at DESC);

-- 3. 录音会话关联
CREATE INDEX idx_recordings_session_created
ON recordings(session_id, created_at DESC);

-- 4. 洞察分类查询
CREATE INDEX idx_insights_session_category
ON insights(session_id, category);

-- 5. 要素级案例查询
CREATE INDEX idx_case_features_case_category
ON case_features(case_id, category);
```

### 3.3 向量化索引详情

```sql
-- 案例向量索引 (IVFFlat - 适合高维向量，查询速度快)
CREATE INDEX idx_cases_embedding_ivfflat ON cases
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);  -- 根据数据量调整，一般 sqrt(n/1000)

-- 案例要素向量索引
CREATE INDEX idx_case_features_embedding_ivfflat ON case_features
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

**IVFFlat参数说明**:
- `lists`: 聚类中心数量，建议设置为 sqrt(行数/1000)
- `probes`: 查询时搜索的聚类数，默认值1，可动态调整

---

## 4. 查询优化建议

### 4.1 常用查询模式优化

#### 查询租户最近的访谈会话
```sql
-- 使用 idx_interview_sessions_tenant_date 索引
EXPLAIN ANALYZE
SELECT * FROM interview_sessions
WHERE tenant_id = 'xxx'
  AND deleted_at IS NULL
ORDER BY interview_date DESC
LIMIT 20;
```
**预期执行计划**: Index Scan using idx_interview_sessions_tenant_date

#### 查询客户的所有访谈历史
```sql
-- 使用 client_id 索引 + tenant_id 过滤
EXPLAIN ANALYZE
SELECT * FROM interview_sessions
WHERE tenant_id = 'xxx'
  AND client_id = 'yyy'
  AND deleted_at IS NULL
ORDER BY interview_date DESC;
```
**优化建议**: 如查询频繁，添加复合索引 (tenant_id, client_id, interview_date DESC)

#### JSONB字段查询
```sql
-- 查询executive_summary中特定字段
EXPLAIN ANALYZE
SELECT * FROM interview_sessions
WHERE tenant_id = 'xxx'
  AND executive_summary @> '{"key_findings": [{"priority": "high"}]}'
  AND deleted_at IS NULL;
```
**依赖索引**: idx_interview_sessions_executive_summary_gin

### 4.2 避免全表扫描的场景

| 场景 | 风险 | 解决方案 |
|------|------|----------|
| 大表的LIKE '%xxx%' | 全表扫描 | 使用pg_trgm GIN索引或全文搜索 |
| 无tenant_id过滤的查询 | 跨租户数据泄露 | 强制添加tenant_id条件，配合RLS |
| 软删除表缺少deleted_at条件 | 返回已删除数据 | 查询模板强制包含deleted_at IS NULL |
| 大表的OFFSET分页 | 性能随offset增大下降 | 使用游标分页或keyset分页 |

### 4.3 分页优化建议

```sql
-- 推荐: Keyset分页 (游标分页)
SELECT * FROM interview_sessions
WHERE tenant_id = 'xxx'
  AND interview_date < '2026-03-01'
  AND deleted_at IS NULL
ORDER BY interview_date DESC
LIMIT 20;

-- 不推荐: OFFSET分页 (大数据量时性能差)
SELECT * FROM interview_sessions
WHERE tenant_id = 'xxx'
  AND deleted_at IS NULL
ORDER BY interview_date DESC
OFFSET 10000 LIMIT 20;  -- 慢！
```

---

## 5. pgvector使用指南

### 5.1 Embedding生成

#### Python端生成 (AI层)
```python
import openai
from pgvector.psycopg2 import register_vector

async def generate_embedding(text: str) -> list[float]:
    """
    使用Kimi-k2.5生成文本embedding
    注意: 实际使用中科琉光的AI层服务
    """
    response = await openai.Embedding.acreate(
        model="text-embedding-3-small",  # 1536维度
        input=text
    )
    return response.data[0].embedding

# 存储到PostgreSQL
async def save_case_with_embedding(case_id: str, content: str):
    embedding = await generate_embedding(content)

    # 使用psycopg2 + pgvector扩展
    import psycopg2
    conn = psycopg2.connect("dbname=research_tool")
    register_vector(conn)

    cur = conn.cursor()
    cur.execute(
        "UPDATE cases SET embedding = %s WHERE id = %s",
        (embedding, case_id)
    )
    conn.commit()
```

#### TypeORM方式存储
```typescript
// 使用自定义ColumnType (推荐方案见typeorm-entities.md)
// 或使用原始查询
await dataSource.query(
  'UPDATE cases SET embedding = $1::vector WHERE id = $2',
  [JSON.stringify(embedding), caseId]
);
```

### 5.2 向量相似度查询

#### 余弦相似度搜索 (Cosine Similarity)
```sql
-- 查找与查询向量最相似的案例
SELECT
    id,
    title,
    industry,
    content,
    1 - (embedding <=> query_embedding) AS similarity
FROM cases
WHERE tenant_id = 'xxx'
  AND is_public = true
  AND deleted_at IS NULL
ORDER BY embedding <=> query_embedding
LIMIT 10;
```

#### 带距离阈值的搜索
```sql
-- 只返回相似度大于0.8的结果
SELECT
    id,
    title,
    1 - (embedding <=> query_embedding) AS similarity
FROM cases
WHERE tenant_id = 'xxx'
  AND embedding <=> query_embedding < 0.2  -- 距离小于0.2 = 相似度大于0.8
ORDER BY embedding <=> query_embedding
LIMIT 10;
```

#### 使用IVFFlat索引的查询
```sql
-- 设置probes参数提高召回率
SET ivfflat.probes = 10;

SELECT
    id,
    title,
    embedding <=> query_embedding AS distance
FROM cases
WHERE tenant_id = 'xxx'
ORDER BY embedding <=> query_embedding
LIMIT 10;
```

### 5.3 向量运算符说明

| 运算符 | 数学含义 | 使用场景 |
|--------|----------|----------|
| `<->` | L2距离 (欧几里得距离) | 默认距离度量 |
| `<=>` | 余弦距离 | 文本语义相似度 |
| `<#>` | 内积距离 | 某些ML模型输出 |

**转换公式**:
- 余弦相似度 = 1 - 余弦距离
- 当向量已归一化时，cosine_distance ≈ 0.5 * L2_distance^2

### 5.4 批量向量操作

```sql
-- 批量更新案例embedding
UPDATE cases
SET embedding = embeddings.vector
FROM (
    SELECT unnest($1::uuid[]) as id,
           unnest($2::vector[]) as vector
) AS embeddings
WHERE cases.id = embeddings.id;

-- 查找相似案例要素
SELECT
    cf.id,
    cf.content,
    cf.category,
    c.title as case_title,
    1 - (cf.embedding <=> query_vec) AS similarity
FROM case_features cf
JOIN cases c ON cf.case_id = c.id
WHERE c.tenant_id = 'xxx'
  AND c.deleted_at IS NULL
ORDER BY cf.embedding <=> query_vec
LIMIT 20;
```

### 5.5 向量索引调优

```sql
-- 查看向量索引使用情况
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read
FROM pg_stat_user_indexes
WHERE indexname LIKE '%embedding%';

-- 重建向量索引 (数据量变化大时)
REINDEX INDEX idx_cases_embedding_ivfflat;

-- 调整IVFFlat参数
SET ivfflat.probes = 10;  -- 增加搜索精度，降低速度
```

---

## 6. 性能监控与维护

### 6.1 关键监控指标

| 指标 | 告警阈值 | 监控方法 |
|------|----------|----------|
| 表大小 | > 10GB | pg_total_relation_size() |
| 索引膨胀 | > 50% | pgstatindex() |
| 慢查询 | > 500ms | pg_stat_statements |
| 连接数 | > 80% max_connections | pg_stat_activity |
| vacuum滞后 | > 1000 dead tuples | pg_stat_user_tables |

### 6.2 定期维护任务

```sql
-- 1. 手动VACUUM (自动vacuum不够时)
VACUUM ANALYZE cases;
VACUUM ANALYZE case_features;

-- 2. 重建膨胀索引
REINDEX INDEX CONCURRENTLY idx_cases_embedding_ivfflat;

-- 3. 更新统计信息
ANALYZE interview_sessions;
ANALYZE transcriptions;
```

### 6.3 连接池配置建议

```yaml
# PgBouncer配置参考
[databases]
research_tool = host=localhost port=5432 dbname=research_tool

[pgbouncer]
listen_port = 6432
listen_addr = 127.0.0.1
auth_type = md5
pool_mode = transaction  # NestJS推荐
max_client_conn = 10000
default_pool_size = 25
min_pool_size = 10
reserve_pool_size = 5
server_idle_timeout = 600
```

---

## 7. 设计原则总结

### 7.1 安全设计
1. **RLS策略**: 所有业务表启用行级安全
2. **软删除**: 敏感数据使用deleted_at而非硬删除
3. **审计日志**: 关键操作全量记录
4. **租户隔离**: tenant_id贯穿所有查询

### 7.2 性能设计
1. **索引先行**: 关键查询路径预建索引
2. **JSONB适度**: 避免过深的嵌套结构
3. **向量优化**: IVFFlat索引+合理probes值
4. **分页优化**: 使用Keyset分页替代OFFSET

### 7.3 扩展设计
1. **UUID主键**: 支持分布式部署
2. **JSONB配置**: 租户级设置灵活扩展
3. **分层存储**: 原始数据→结构化→摘要
4. **模块化表**: interview_departments/interview_questions支持模板化
