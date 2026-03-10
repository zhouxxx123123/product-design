/**
 * 中科琉光调研工具 - 枚举类型定义
 * Zhongke Liuguang Research Tool - Enum Type Definitions
 *
 * 这些枚举与PostgreSQL数据库中的ENUM类型完全对应。
 * These enums correspond exactly to PostgreSQL ENUM types.
 */

/**
 * 用户角色
 * User roles in the system
 */
export enum UserRole {
  /** 管理员 - 中科琉光员工，拥有完整权限 */
  ADMIN = 'ADMIN',
  /** 销售 - 渠道公司销售代表，可执行访谈 */
  SALES = 'SALES',
  /** 专家 - 中科琉光顾问，可查看所有会话并撰写解决方案 */
  EXPERT = 'EXPERT',
}

/**
 * 访谈会话状态
 * Interview session lifecycle states
 */
export enum SessionStatus {
  /** 草稿 - 提纲已生成，访谈未开始 */
  DRAFT = 'DRAFT',
  /** 进行中 - 访谈正在活跃进行 */
  IN_PROGRESS = 'IN_PROGRESS',
  /** 已完成 - 访谈结束，等待AI处理 */
  COMPLETED = 'COMPLETED',
  /** 已处理 - 所有AI层已生成（摘要、洞察） */
  PROCESSED = 'PROCESSED',
  /** 已归档 - 软归档，默认列表中隐藏 */
  ARCHIVED = 'ARCHIVED',
}

/**
 * 优先级级别
 * Priority levels for insights and features
 */
export enum PriorityLevel {
  /** P0 - 必须/关键痛点 */
  P0 = 'P0',
  /** P1 - 重要 */
  P1 = 'P1',
  /** P2 - 锦上添花 */
  P2 = 'P2',
}

/**
 * 录音状态
 * Recording file processing states
 */
export enum RecordingStatus {
  /** 上传中 - 客户端正在流式上传 */
  UPLOADING = 'UPLOADING',
  /** 等待ASR - 上传完成，等待腾讯云ASR任务 */
  PENDING_ASR = 'PENDING_ASR',
  /** 转写中 - ASR任务正在运行 */
  TRANSCRIBING = 'TRANSCRIBING',
  /** 完成 - 最终转写文本可用 */
  DONE = 'DONE',
  /** 失败 - ASR失败，可能重试 */
  FAILED = 'FAILED',
}

/**
 * AI建议类型
 * Types of AI-generated suggestions during interviews
 */
export enum SuggestionType {
  /** 追问 - 实时访谈中AI生成的追问问题 */
  FOLLOW_UP = 'FOLLOW_UP',
  /** 澄清 - 提示澄清模糊回答 */
  CLARIFICATION = 'CLARIFICATION',
  /** 深挖 - 提示进一步探索某个话题 */
  DEEP_DIVE = 'DEEP_DIVE',
}

/**
 * 洞察层级
 * Three-layer information model for insights
 */
export enum InsightLayer {
  /** 层级1 - 原始：带时间戳的转写片段 */
  LAYER_1_RAW = 'LAYER_1_RAW',
  /** 层级2 - 结构化：按部门的结构化痛点 */
  LAYER_2_STRUCTURED = 'LAYER_2_STRUCTURED',
  /** 层级3 - 执行层：顶层洞察/元需求/解决方案方向 */
  LAYER_3_EXECUTIVE = 'LAYER_3_EXECUTIVE',
}

/**
 * 问题来源
 * Source of interview questions
 */
export enum QuestionSource {
  /** 来自模板 */
  TEMPLATE = 'TEMPLATE',
  /** AI生成建议 */
  AI_SUGGESTION = 'AI_SUGGESTION',
  /** 手动输入 */
  MANUAL = 'MANUAL',
  /** 追问 */
  FOLLOW_UP = 'FOLLOW_UP',
}

/**
 * 审计日志动作类型
 * Audit log action types
 */
export enum AuditAction {
  // 会话相关
  SESSION_CREATED = 'SESSION_CREATED',
  SESSION_STATUS_CHANGED = 'SESSION_STATUS_CHANGED',
  SESSION_UPDATED = 'SESSION_UPDATED',
  SESSION_DELETED = 'SESSION_DELETED',

  // 用户相关
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_ROLE_CHANGED = 'USER_ROLE_CHANGED',

  // 租户相关
  TENANT_CREATED = 'TENANT_CREATED',
  TENANT_UPDATED = 'TENANT_UPDATED',

  // 案例库相关
  CASE_CREATED = 'CASE_CREATED',
  CASE_UPDATED = 'CASE_UPDATED',
  CASE_PUBLISHED = 'CASE_PUBLISHED',

  // AI相关
  AI_SUGGESTION_GENERATED = 'AI_SUGGESTION_GENERATED',
  AI_SUGGESTION_ACCEPTED = 'AI_SUGGESTION_ACCEPTED',
  AI_SUGGESTION_DISMISSED = 'AI_SUGGESTION_DISMISSED',
  INSIGHT_VALIDATED = 'INSIGHT_VALIDATED',

  // 转写相关
  TRANSCRIPTION_RECEIVED = 'TRANSCRIPTION_RECEIVED',
  ASR_STARTED = 'ASR_STARTED',
  ASR_COMPLETED = 'ASR_COMPLETED',
  ASR_FAILED = 'ASR_FAILED',
}

/**
 * 实体类型
 * Entity types for audit logging and references
 */
export enum EntityType {
  TENANT = 'tenants',
  USER = 'users',
  CLIENT_PROFILE = 'client_profiles',
  INTERVIEW_SESSION = 'interview_sessions',
  INTERVIEW_DEPARTMENT = 'interview_departments',
  INTERVIEW_QUESTION = 'interview_questions',
  INTERVIEW_ANSWER = 'interview_answers',
  RECORDING = 'recordings',
  TRANSCRIPTION = 'transcriptions',
  AI_SUGGESTION = 'ai_suggestions',
  INSIGHT = 'insights',
  CASE = 'cases',
  CASE_FEATURE = 'case_features',
  CASE_MATCH = 'case_matches',
  OUTLINE_TEMPLATE = 'outline_templates',
  AUDIT_LOG = 'audit_logs',
}
