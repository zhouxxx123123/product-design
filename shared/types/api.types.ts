/**
 * 中科琉光调研工具 - API核心类型定义
 * Zhongke Liuguang Research Tool - Core API Type Definitions
 *
 * 这些接口与数据库Schema严格对应，用于全栈类型安全。
 * These interfaces strictly correspond to the database schema for full-stack type safety.
 */

import {
  UserRole,
  SessionStatus,
  PriorityLevel,
  RecordingStatus,
  SuggestionType,
  InsightLayer,
  QuestionSource,
} from './enums';

// =============================================================================
// JSONB 复合类型
// JSONB Composite Types
// =============================================================================

/**
 * 租户元数据
 * Tenant metadata structure
 */
export interface TenantMetadata {
  /** 组织设置 */
  settings?: Record<string, unknown>;
  /** 品牌配置 */
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
  };
  /** 配额限制 */
  quotas?: {
    maxUsers?: number;
    maxSessionsPerMonth?: number;
  };
  [key: string]: unknown;
}

/**
 * 用户元数据
 * User metadata structure
 */
export interface UserMetadata {
  /** 头像URL */
  avatarUrl?: string;
  /** 用户偏好设置 */
  preferences?: {
    language?: string;
    timezone?: string;
    notifications?: boolean;
  };
  [key: string]: unknown;
}

/**
 * 客户档案元数据
 * Client profile metadata
 */
export interface ClientProfileMetadata {
  /** 自定义字段 */
  customFields?: Record<string, string>;
  /** 标签 */
  tags?: string[];
  [key: string]: unknown;
}

/**
 * 提纲模板内容
 * Outline template content structure
 */
export interface OutlineTemplateContent {
  /** 章节列表 */
  sections: Array<{
    /** 章节标题 */
    title: string;
    /** 问题列表 */
    questions: Array<{
      /** 问题ID */
      id: string;
      /** 问题文本 */
      text: string;
      /** 提示文本 */
      hint?: string;
    }>;
  }>;
}

/**
 * 结构化摘要 - L2层级
 * Structured summary (Layer 2) shape
 */
export interface StructuredSummary {
  /** 按部门分组 */
  departments: Array<{
    /** 部门名称 */
    name: string;
    /** 痛点列表 */
    painPoints: Array<{
      /** 痛点描述 */
      description: string;
      /** 严重程度 */
      severity: 'HIGH' | 'MEDIUM' | 'LOW';
      /** 引用原文 */
      quote: string;
    }>;
  }>;
}

/**
 * 执行摘要 - L3层级
 * Executive summary (Layer 3) shape
 */
export interface ExecutiveSummary {
  /** 顶层洞察列表 */
  topInsights: string[];
  /** 元需求列表 */
  metaNeeds: string[];
  /** 解决方案方向 */
  solutionDirection: string;
  /** 关键建议 */
  keyRecommendations?: string[];
}

/**
 * 单词时间戳
 * Word-level timestamp for transcription
 */
export interface WordTimestamp {
  /** 单词 */
  word: string;
  /** 开始时间(毫秒) */
  startMs: number;
  /** 结束时间(毫秒) */
  endMs: number;
  /** 置信度 */
  confidence: number;
}

/**
 * 匹配功能点详情
 * Matched feature detail for case matching
 */
export interface MatchedFeature {
  /** 功能点名称 */
  featurePoint: string;
  /** 相似度分数 */
  similarityScore: number;
  /** 会话中的痛点 */
  sessionPainPoint: string;
}

/**
 * 洞察内容
 * Insight content structure (varies by layer)
 */
export interface InsightContent {
  [key: string]: unknown;
}

// =============================================================================
// 核心实体接口
// Core Entity Interfaces
// =============================================================================

/**
 * 租户
 * Tenant (organization/channel company)
 */
export interface Tenant {
  /** UUID主键 */
  id: string;
  /** 显示名称，如"中科琉光" */
  name: string;
  /** URL友好的短代码，如"zklyg" */
  shortCode: string;
  /** 是否超级租户(中科琉光本身) */
  isSuperTenant: boolean;
  /** 联系邮箱 */
  contactEmail?: string;
  /** 联系电话 */
  contactPhone?: string;
  /** 元数据JSONB */
  metadata: TenantMetadata;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 软删除时间 */
  deletedAt?: string;
}

/**
 * 用户
 * User (belongs to one tenant)
 */
export interface User {
  /** UUID主键 */
  id: string;
  /** 所属租户ID */
  tenantId: string;
  /** 邮箱(唯一) */
  email: string;
  /** 显示名称 */
  displayName: string;
  /** 角色 */
  role: UserRole;
  /** 是否激活 */
  isActive: boolean;
  /** 最后登录时间 */
  lastLoginAt?: string;
  /** 元数据JSONB(含头像等) */
  metadata: UserMetadata;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 软删除时间 */
  deletedAt?: string;
}

/**
 * 用户角色变更历史
 * User role change history
 */
export interface UserRoleHistory {
  /** UUID主键 */
  id: string;
  /** 用户ID */
  userId: string;
  /** 租户ID */
  tenantId: string;
  /** 旧角色 */
  oldRole?: UserRole;
  /** 新角色 */
  newRole: UserRole;
  /** 变更者ID */
  changedBy?: string;
  /** 变更原因 */
  reason?: string;
  /** 创建时间 */
  createdAt: string;
}

/**
 * 客户档案
 * Client profile (target company being interviewed)
 */
export interface ClientProfile {
  /** UUID主键 */
  id: string;
  /** 所属租户ID */
  tenantId: string;
  /** 公司名称 */
  companyName: string;
  /** 行业 */
  industry: string;
  /** 公司规模(人数区间) */
  companySize?: string;
  /** 地区(省/市) */
  region?: string;
  /** 联系人姓名 */
  contactName?: string;
  /** 联系人职位 */
  contactTitle?: string;
  /** 联系人电话 */
  contactPhone?: string;
  /** 联系人邮箱 */
  contactEmail?: string;
  /** 当前使用的ERP系统 */
  erpSystem?: string;
  /** 元数据JSONB */
  metadata: ClientProfileMetadata;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 软删除时间 */
  deletedAt?: string;
}

/**
 * 提纲模板
 * Outline template (AI-generated or manually curated)
 */
export interface OutlineTemplate {
  /** UUID主键 */
  id: string;
  /** 所属租户ID(超级租户=共享库) */
  tenantId: string;
  /** 模板标题 */
  title: string;
  /** 目标行业 */
  industry: string;
  /** 目标部门，如"采购部"、"财务部" */
  department: string;
  /** 版本号 */
  version: number;
  /** 是否已发布(草稿vs正式) */
  isPublished: boolean;
  /** 内容JSONB */
  content: OutlineTemplateContent;
  /** 是否AI生成 */
  aiGenerated: boolean;
  /** 生成模型 */
  sourceModel?: string;
  /** 元数据JSONB */
  metadata: Record<string, unknown>;
  /** 创建者ID */
  createdBy?: string;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 软删除时间 */
  deletedAt?: string;
}

/**
 * 调研会话
 * Interview session (central table)
 */
export interface InterviewSession {
  /** UUID主键 */
  id: string;
  /** 所属租户ID */
  tenantId: string;
  /** 客户档案ID */
  clientProfileId: string;
  /** 创建者ID(销售代表) */
  createdBy: string;
  /** 分配的专家ID */
  assignedExpertId?: string;
  /** 提纲模板ID */
  outlineTemplateId?: string;
  /** 会话状态 */
  status: SessionStatus;
  /** 标题，如"XX公司2026-03采购部调研" */
  title: string;
  /** 计划开始时间 */
  scheduledAt?: string;
  /** 实际开始时间 */
  startedAt?: string;
  /** 完成时间 */
  completedAt?: string;
  /** 完整转写文本(用于全文搜索) */
  fullTranscript?: string;
  /** 结构化摘要L2(JSONB) */
  structuredSummary?: StructuredSummary;
  /** 执行摘要L3(JSONB) */
  executiveSummary?: ExecutiveSummary;
  /** 元数据JSONB */
  metadata: Record<string, unknown>;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 软删除时间 */
  deletedAt?: string;
}

/**
 * 访谈部门
 * Interview department (one session covers multiple departments)
 */
export interface InterviewDepartment {
  /** UUID主键 */
  id: string;
  /** 会话ID */
  sessionId: string;
  /** 租户ID */
  tenantId: string;
  /** 部门名称，如"采购部" */
  departmentName: string;
  /** 排序顺序 */
  sortOrder: number;
  /** 备注 */
  notes?: string;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/**
 * 访谈问题
 * Interview question
 */
export interface InterviewQuestion {
  /** UUID主键 */
  id: string;
  /** 部门ID */
  departmentId: string;
  /** 会话ID */
  sessionId: string;
  /** 租户ID */
  tenantId: string;
  /** 问题文本 */
  questionText: string;
  /** 提示文本 */
  hintText?: string;
  /** 排序顺序 */
  sortOrder: number;
  /** 来源 */
  source: QuestionSource;
  /** 关联的AI建议ID */
  aiSuggestionId?: string;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/**
 * 访谈回答
 * Interview answer
 */
export interface InterviewAnswer {
  /** UUID主键 */
  id: string;
  /** 问题ID */
  questionId: string;
  /** 会话ID */
  sessionId: string;
  /** 租户ID */
  tenantId: string;
  /** 回答文本 */
  answerText?: string;
  /** 回答开始时间(录音中的毫秒偏移) */
  answerStartMs?: number;
  /** 回答结束时间 */
  answerEndMs?: number;
  /** 关联的录音ID */
  recordingId?: string;
  /** 是否被标记(需要跟进) */
  isFlagged: boolean;
  /** 元数据JSONB */
  metadata: Record<string, unknown>;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/**
 * 录音文件
 * Recording (audio file metadata)
 */
export interface Recording {
  /** UUID主键 */
  id: string;
  /** 会话ID */
  sessionId: string;
  /** 租户ID */
  tenantId: string;
  /** 部门ID(全会话录音可为空) */
  departmentId?: string;
  /** 外部存储URL */
  fileUrl: string;
  /** 文件大小(字节) */
  fileSizeBytes?: number;
  /** 时长(毫秒) */
  durationMs?: number;
  /** MIME类型 */
  mimeType: string;
  /** 处理状态 */
  status: RecordingStatus;
  /** 腾讯云ASR任务ID */
  asrTaskId?: string;
  /** 请求ID(用于调试) */
  asrRequestId?: string;
  /** ASR错误信息 */
  asrErrorMsg?: string;
  /** 上传完成时间 */
  uploadedAt?: string;
  /** ASR开始时间 */
  asrStartedAt?: string;
  /** ASR完成时间 */
  asrFinishedAt?: string;
  /** 元数据JSONB */
  metadata: Record<string, unknown>;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/**
 * 转写片段
 * Transcription segment
 */
export interface Transcription {
  /** UUID主键 */
  id: string;
  /** 录音ID */
  recordingId: string;
  /** 会话ID */
  sessionId: string;
  /** 租户ID */
  tenantId: string;
  /** 片段开始时间(毫秒) */
  startMs: number;
  /** 片段结束时间 */
  endMs: number;
  /** 说话人标签，如"Speaker_0" */
  speakerLabel?: string;
  /** 转写文本 */
  text: string;
  /** 置信度分数(0.0000-1.0000) */
  confidence?: number;
  /** 是否最终确认(非临时结果) */
  isFinal: boolean;
  /** 单词级时间戳 */
  wordTimestamps?: WordTimestamp[];
  /** 创建时间 */
  createdAt: string;
}

/**
 * AI建议
 * AI suggestion (real-time during interview)
 */
export interface AISuggestion {
  /** UUID主键 */
  id: string;
  /** 会话ID */
  sessionId: string;
  /** 部门ID */
  departmentId?: string;
  /** 租户ID */
  tenantId: string;
  /** 建议类型 */
  suggestionType: SuggestionType;
  /** 建议的问题文本 */
  questionText: string;
  /** 建议理由 */
  rationale?: string;
  /** 触发此建议的转写片段ID */
  triggerTranscriptSegmentId?: string;
  /** 触发此建议的回答ID */
  triggerAnswerId?: string;
  /** 是否被接受(NULL=待处理, TRUE=已使用, FALSE=已驳回) */
  isAccepted?: boolean;
  /** 接受时间 */
  acceptedAt?: string;
  /** 驳回时间 */
  dismissedAt?: string;
  /** 来源模型 */
  sourceModel: string;
  /** 提示token数 */
  promptTokens?: number;
  /** 完成token数 */
  completionTokens?: number;
  /** 元数据JSONB */
  metadata: Record<string, unknown>;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/**
 * 洞察
 * Insight (AI-extracted at three layers)
 */
export interface Insight {
  /** UUID主键 */
  id: string;
  /** 会话ID */
  sessionId: string;
  /** 租户ID */
  tenantId: string;
  /** 洞察层级 */
  layer: InsightLayer;
  /** 部门ID(L3可为空) */
  departmentId?: string;
  /** 关联的转写ID(L1) */
  transcriptionId?: string;
  /** 音频片段开始(L1) */
  audioClipStartMs?: number;
  /** 音频片段结束(L1) */
  audioClipEndMs?: number;
  /** 痛点描述(L2) */
  painPointDescription?: string;
  /** 痛点严重程度(L2) */
  painPointSeverity?: 'HIGH' | 'MEDIUM' | 'LOW';
  /** 支持引用(L2) */
  supportingQuote?: string;
  /** 洞察标题(L3) */
  insightTitle?: string;
  /** 元需求(L3) */
  metaNeed?: string;
  /** 解决方案方向(L3) */
  solutionDirection?: string;
  /** 完整AI输出(JSONB) */
  content: InsightContent;
  /** 优先级 */
  priority?: PriorityLevel;
  /** 来源模型 */
  sourceModel: string;
  /** 是否已验证(专家审核) */
  isValidated: boolean;
  /** 验证者ID */
  validatedBy?: string;
  /** 验证时间 */
  validatedAt?: string;
  /** 排序顺序 */
  sortOrder: number;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/**
 * 案例
 * Case (historical engagement from case library)
 */
export interface Case {
  /** UUID主键 */
  id: string;
  /** 所属租户ID(总是超级租户) */
  tenantId: string;
  /** 案例标题 */
  title: string;
  /** 匿名化客户名称 */
  clientAlias?: string;
  /** 行业 */
  industry: string;
  /** 公司规模 */
  companySize?: string;
  /** 地区 */
  region?: string;
  /** 涉及的ERP系统 */
  erpSystem?: string;
  /** 项目年份 */
  engagementYear?: number;
  /** 项目成果摘要 */
  outcomeSummary?: string;
  /** 标签数组 */
  tags: string[];
  /** 是否已发布 */
  isPublished: boolean;
  /** 元数据JSONB */
  metadata: Record<string, unknown>;
  /** 创建者ID */
  createdBy?: string;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 软删除时间 */
  deletedAt?: string;
}

/**
 * 案例功能点
 * Case feature (4-level hierarchy)
 */
export interface CaseFeature {
  /** UUID主键 */
  id: string;
  /** 案例ID */
  caseId: string;
  /** 租户ID */
  tenantId: string;
  /** 功能域，如"供应链管理" */
  domain: string;
  /** 子系统，如"采购管理" */
  subsystem: string;
  /** 功能点，如"供应商评估" */
  featurePoint: string;
  /** 功能描述 */
  description: string;
  /** 优先级 */
  priority: PriorityLevel;
  /** 来源 */
  source?: string;
  /** 排序顺序 */
  sortOrder: number;
  /** 元数据JSONB */
  metadata: Record<string, unknown>;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/**
 * 案例匹配
 * Case match (AI-matched historical cases to session)
 */
export interface CaseMatch {
  /** UUID主键 */
  id: string;
  /** 会话ID */
  sessionId: string;
  /** 案例ID */
  caseId: string;
  /** 租户ID */
  tenantId: string;
  /** 匹配分数(0.0000-1.0000) */
  matchScore?: number;
  /** 匹配原因 */
  matchReason?: string;
  /** 匹配的功能点详情 */
  matchedFeatures: MatchedFeature[];
  /** 是否手动添加(非AI匹配) */
  isManual: boolean;
  /** 是否已审批 */
  isApproved?: boolean;
  /** 审批者ID */
  approvedBy?: string;
  /** 审批时间 */
  approvedAt?: string;
  /** 来源模型 */
  sourceModel?: string;
  /** 元数据JSONB */
  metadata: Record<string, unknown>;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/**
 * 审计日志
 * Audit log (append-only)
 */
export interface AuditLog {
  /** UUID主键 */
  id: string;
  /** 租户ID(系统事件可为空) */
  tenantId?: string;
  /** 用户ID(系统事件可为空) */
  userId?: string;
  /** 动作类型 */
  action: string;
  /** 实体类型 */
  entityType: string;
  /** 实体ID */
  entityId?: string;
  /** 变更前值(快照) */
  oldValue?: Record<string, unknown>;
  /** 变更后值(快照) */
  newValue?: Record<string, unknown>;
  /** IP地址 */
  ipAddress?: string;
  /** 用户代理 */
  userAgent?: string;
  /** 请求ID(关联ID) */
  requestId?: string;
  /** 元数据JSONB */
  metadata: Record<string, unknown>;
  /** 创建时间 */
  createdAt: string;
}
