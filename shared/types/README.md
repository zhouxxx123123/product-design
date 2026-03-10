# 中科琉光调研工具 - 共享类型定义

本目录包含全栈共享的TypeScript类型定义，用于NestJS后端、React Web前端和React Native移动端。

## 文件结构

```
shared/types/
├── index.ts           # 主入口文件，导出所有类型
├── enums.ts           # 枚举类型定义
├── api.types.ts       # API核心实体类型
├── websocket.types.ts # WebSocket事件类型
├── dto.ts             # DTO(数据传输对象)类型
└── tsconfig.json      # TypeScript配置
```

## 使用方式

```typescript
// 从主入口导入
import { User, SessionStatus, CreateInterviewSessionDto } from '../shared/types';

// 单独文件导入
import { UserRole, PriorityLevel } from '../shared/types/enums';
import type { InterviewSession } from '../shared/types/api.types';
```

## 设计规范

1. **严格类型**: 启用 `strict: true`，不使用 `any`
2. **接口优先**: 核心实体使用 `interface` 定义
3. **可选字段**: 使用 `?:` 标记可选字段
4. **日期格式**: 日期字段使用 `string` (ISO格式)
5. **JSONB字段**: 使用 `Record<string, unknown>` 或具体类型
6. **JSDoc注释**: 所有字段都有中文和英文注释

## 类型概览

### 枚举 (enums.ts)
- `UserRole` - 用户角色: ADMIN, SALES, EXPERT
- `SessionStatus` - 会话状态: DRAFT, IN_PROGRESS, COMPLETED, PROCESSED, ARCHIVED
- `PriorityLevel` - 优先级: P0, P1, P2
- `RecordingStatus` - 录音状态: UPLOADING, PENDING_ASR, TRANSCRIBING, DONE, FAILED
- `SuggestionType` - AI建议类型: FOLLOW_UP, CLARIFICATION, DEEP_DIVE
- `InsightLayer` - 洞察层级: LAYER_1_RAW, LAYER_2_STRUCTURED, LAYER_3_EXECUTIVE

### 核心实体 (api.types.ts)
- `Tenant` - 租户(组织)
- `User` - 用户
- `ClientProfile` - 客户档案
- `OutlineTemplate` - 提纲模板
- `InterviewSession` - 调研会话
- `InterviewDepartment` - 访谈部门
- `InterviewQuestion` - 访谈问题
- `InterviewAnswer` - 访谈回答
- `Recording` - 录音文件
- `Transcription` - 转写片段
- `AISuggestion` - AI建议
- `Insight` - 洞察
- `Case` - 案例
- `CaseFeature` - 案例功能点
- `CaseMatch` - 案例匹配
- `AuditLog` - 审计日志

### WebSocket事件 (websocket.types.ts)
- `ASRTranscriptEvent` - 实时转写事件
- `AISuggestionEvent` - AI建议事件
- `SessionStatusEvent` - 会话状态变更
- `CopilotMessageEvent` - Copilot对话

### DTO (dto.ts)
- 分页: `PaginationQueryDto`, `PaginatedResponse<T>`
- 用户: `CreateUserDto`, `UpdateUserDto`
- 会话: `CreateInterviewSessionDto`, `UpdateSessionStatusDto`
- 认证: `LoginDto`, `LoginResponseDto`

## 数据库对应

类型定义与PostgreSQL Schema严格对应:
- UUID字段 → `string`
- TIMESTAMPTZ → `string` (ISO格式)
- JSONB → `Record<string, unknown>` 或具体接口
- ENUM → TypeScript enum
- 软删除字段 → `?: string` (可选)
