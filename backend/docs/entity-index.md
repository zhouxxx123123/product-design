# TypeORM Entity 索引

本文档列出项目中所有TypeORM实体及其文件路径。

## 实体文件列表

| 实体名 | 文件路径 | 说明 |
|--------|----------|------|
| TenantEntity | `/backend/src/entities/tenant.entity.ts` | 租户 |
| UserEntity | `/backend/src/entities/user.entity.ts` | 用户 |
| TenantMemberEntity | `/backend/src/entities/tenant-member.entity.ts` | 租户成员关系 |
| InterviewSessionEntity | `/backend/src/entities/interview-session.entity.ts` | 访谈会话 |
| ClientProfileEntity | `/backend/src/entities/client-profile.entity.ts` | 客户档案 |
| TemplateEntity | `/backend/src/entities/template.entity.ts` | 模板 |
| InterviewDepartmentEntity | `/backend/src/entities/interview-department.entity.ts` | 访谈部门 |
| InterviewQuestionEntity | `/backend/src/entities/interview-question.entity.ts` | 访谈问题 |
| CaseEntity | `/backend/src/entities/case.entity.ts` | 案例 |
| CaseFeatureEntity | `/backend/src/entities/case-feature.entity.ts` | 案例要素 |
| RecordingEntity | `/backend/src/entities/recording.entity.ts` | 录音 |
| TranscriptionEntity | `/backend/src/entities/transcription.entity.ts` | 转录 |
| InsightEntity | `/backend/src/entities/insight.entity.ts` | 洞察 |
| AuditLogEntity | `/backend/src/entities/audit-log.entity.ts` | 审计日志 |

## 配置文件

| 文件 | 路径 | 说明 |
|------|------|------|
| Vector类型映射 | `/backend/src/database/vector-column-type.ts` | pgvector类型转换器 |
| 租户上下文拦截器 | `/backend/src/common/interceptors/tenant-context.interceptor.ts` | RLS上下文设置 |
| 租户守卫 | `/backend/src/common/guards/tenant.guard.ts` | 租户权限验证 |
| 租户感知Repository | `/backend/src/common/repositories/tenant-aware.repository.ts` | 基础Repository |
| 案例Repository | `/backend/src/modules/case/repositories/case.repository.ts` | 向量搜索实现 |
| 案例要素Repository | `/backend/src/modules/case/repositories/case-feature.repository.ts` | 要素级搜索 |

## 文档文件

| 文件 | 路径 | 说明 |
|------|------|------|
| 数据库设计文档 | `/backend/docs/database-design.md` | 完整的数据库设计说明 |
| TypeORM实体规范 | `/backend/docs/typeorm-entities.md` | 实体设计详细规范 |
| RLS策略脚本 | `/backend/docs/rls-policies.sql` | PostgreSQL RLS配置 |
