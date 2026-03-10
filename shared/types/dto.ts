/**
 * 中科琉光调研工具 - DTO类型定义
 * Zhongke Liuguang Research Tool - DTO Type Definitions
 *
 * 用于API请求和响应的数据传输对象。
 * Data Transfer Objects for API requests and responses.
 */

import {
  UserRole,
  SessionStatus,
  PriorityLevel,
  RecordingStatus,
  SuggestionType,
  InsightLayer,
} from './enums';
import {
  OutlineTemplateContent,
  StructuredSummary,
  ExecutiveSummary,
  UserMetadata,
  ClientProfileMetadata,
  TenantMetadata,
} from './api.types';

// =============================================================================
// 分页相关
// Pagination
// =============================================================================

/**
 * 分页查询参数
 */
export interface PaginationQueryDto {
  /** 页码(从1开始) */
  page: number;
  /** 每页数量 */
  limit: number;
}

/**
 * 分页元数据
 */
export interface PaginationMeta {
  /** 页码 */
  page: number;
  /** 每页数量 */
  limit: number;
  /** 总数量 */
  total: number;
  /** 总页数 */
  totalPages: number;
  /** 是否有下一页 */
  hasNext: boolean;
  /** 是否有上一页 */
  hasPrev: boolean;
}

/**
 * 分页响应包装
 */
export interface PaginatedResponse<T> {
  /** 数据列表 */
  data: T[];
  /** 分页元数据 */
  meta: PaginationMeta;
}

/**
 * 游标分页查询参数
 */
export interface CursorPaginationQueryDto {
  /** 游标(上一页最后一条记录的ID) */
  cursor?: string;
  /** 每页数量 */
  limit: number;
  /** 排序方向 */
  direction?: 'asc' | 'desc';
}

/**
 * 游标分页响应
 */
export interface CursorPaginatedResponse<T> {
  /** 数据列表 */
  data: T[];
  /** 下一页游标 */
  nextCursor?: string;
  /** 是否有更多数据 */
  hasMore: boolean;
}

// =============================================================================
// 排序和过滤
// Sorting and Filtering
// =============================================================================

/**
 * 排序选项
 */
export interface SortOption {
  /** 排序字段 */
  field: string;
  /** 排序方向 */
  order: 'asc' | 'desc';
}

/**
 * 过滤器操作符
 */
export type FilterOperator =
  | 'eq' // equals
  | 'ne' // not equals
  | 'gt' // greater than
  | 'gte' // greater than or equals
  | 'lt' // less than
  | 'lte' // less than or equals
  | 'in' // in array
  | 'nin' // not in array
  | 'like' // contains
  | 'ilike' // contains (case insensitive)
  | 'null' // is null
  | 'nnull'; // is not null

/**
 * 过滤条件
 */
export interface FilterCondition {
  /** 字段名 */
  field: string;
  /** 操作符 */
  operator: FilterOperator;
  /** 值 */
  value?: string | number | boolean | string[] | number[];
}

/**
 * 复杂查询参数
 */
export interface QueryParamsDto {
  /** 分页 */
  pagination?: PaginationQueryDto;
  /** 排序(支持多字段) */
  sort?: SortOption[];
  /** 过滤条件 */
  filters?: FilterCondition[];
  /** 搜索关键词 */
  search?: string;
}

/**
 * 日期范围过滤
 */
export interface DateRangeFilter {
  /** 开始日期 */
  from?: string;
  /** 结束日期 */
  to?: string;
}

// =============================================================================
// 用户相关DTO
// User DTOs
// =============================================================================

/**
 * 创建用户请求
 */
export interface CreateUserDto {
  /** 邮箱 */
  email: string;
  /** 显示名称 */
  displayName: string;
  /** 密码 */
  password: string;
  /** 角色 */
  role: UserRole;
  /** 元数据 */
  metadata?: UserMetadata;
}

/**
 * 更新用户请求
 */
export interface UpdateUserDto {
  /** 显示名称 */
  displayName?: string;
  /** 密码 */
  password?: string;
  /** 角色 */
  role?: UserRole;
  /** 是否激活 */
  isActive?: boolean;
  /** 元数据(合并更新) */
  metadata?: Partial<UserMetadata>;
}

/**
 * 更新当前用户请求
 */
export interface UpdateCurrentUserDto {
  /** 显示名称 */
  displayName?: string;
  /** 当前密码(修改密码时需要) */
  currentPassword?: string;
  /** 新密码 */
  newPassword?: string;
  /** 元数据(合并更新) */
  metadata?: Partial<UserMetadata>;
}

/**
 * 用户列表查询参数
 */
export interface ListUsersQueryDto extends QueryParamsDto {
  /** 按角色过滤 */
  role?: UserRole;
  /** 按激活状态过滤 */
  isActive?: boolean;
  /** 租户ID(管理员可跨租户查询) */
  tenantId?: string;
}

/**
 * 变更用户角色请求
 */
export interface ChangeUserRoleDto {
  /** 新角色 */
  newRole: UserRole;
  /** 变更原因 */
  reason?: string;
}

// =============================================================================
// 租户相关DTO
// Tenant DTOs
// =============================================================================

/**
 * 创建租户请求
 */
export interface CreateTenantDto {
  /** 显示名称 */
  name: string;
  /** 短代码 */
  shortCode: string;
  /** 联系邮箱 */
  contactEmail?: string;
  /** 联系电话 */
  contactPhone?: string;
  /** 元数据 */
  metadata?: TenantMetadata;
}

/**
 * 更新租户请求
 */
export interface UpdateTenantDto {
  /** 显示名称 */
  name?: string;
  /** 联系邮箱 */
  contactEmail?: string;
  /** 联系电话 */
  contactPhone?: string;
  /** 元数据(合并更新) */
  metadata?: Partial<TenantMetadata>;
}

/**
 * 租户列表查询参数
 */
export interface ListTenantsQueryDto extends QueryParamsDto {
  /** 是否超级租户 */
  isSuperTenant?: boolean;
}

// =============================================================================
// 客户档案相关DTO
// Client Profile DTOs
// =============================================================================

/**
 * 创建客户档案请求
 */
export interface CreateClientProfileDto {
  /** 公司名称 */
  companyName: string;
  /** 行业 */
  industry: string;
  /** 公司规模 */
  companySize?: string;
  /** 地区 */
  region?: string;
  /** 联系人姓名 */
  contactName?: string;
  /** 联系人职位 */
  contactTitle?: string;
  /** 联系人电话 */
  contactPhone?: string;
  /** 联系人邮箱 */
  contactEmail?: string;
  /** 当前ERP系统 */
  erpSystem?: string;
  /** 元数据 */
  metadata?: ClientProfileMetadata;
}

/**
 * 更新客户档案请求
 */
export interface UpdateClientProfileDto {
  /** 公司名称 */
  companyName?: string;
  /** 行业 */
  industry?: string;
  /** 公司规模 */
  companySize?: string;
  /** 地区 */
  region?: string;
  /** 联系人姓名 */
  contactName?: string;
  /** 联系人职位 */
  contactTitle?: string;
  /** 联系人电话 */
  contactPhone?: string;
  /** 联系人邮箱 */
  contactEmail?: string;
  /** 当前ERP系统 */
  erpSystem?: string;
  /** 元数据(合并更新) */
  metadata?: Partial<ClientProfileMetadata>;
}

/**
 * 客户档案列表查询参数
 */
export interface ListClientProfilesQueryDto extends QueryParamsDto {
  /** 按行业过滤 */
  industry?: string;
  /** 按地区过滤 */
  region?: string;
}

// =============================================================================
// 提纲模板相关DTO
// Outline Template DTOs
// =============================================================================

/**
 * 创建提纲模板请求
 */
export interface CreateOutlineTemplateDto {
  /** 模板标题 */
  title: string;
  /** 目标行业 */
  industry: string;
  /** 目标部门 */
  department: string;
  /** 内容 */
  content: OutlineTemplateContent;
  /** 是否立即发布 */
  isPublished?: boolean;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 更新提纲模板请求
 */
export interface UpdateOutlineTemplateDto {
  /** 模板标题 */
  title?: string;
  /** 目标行业 */
  industry?: string;
  /** 目标部门 */
  department?: string;
  /** 内容 */
  content?: OutlineTemplateContent;
  /** 是否发布 */
  isPublished?: boolean;
  /** 元数据(合并更新) */
  metadata?: Record<string, unknown>;
}

/**
 * AI生成提纲请求
 */
export interface GenerateOutlineTemplateDto {
  /** 目标行业 */
  industry: string;
  /** 目标部门 */
  department: string;
  /** 客户档案ID(可选，用于个性化) */
  clientProfileId?: string;
  /** 额外上下文 */
  context?: string;
  /** 期望问题数量 */
  expectedQuestionCount?: number;
}

/**
 * 提纲模板列表查询参数
 */
export interface ListOutlineTemplatesQueryDto extends QueryParamsDto {
  /** 按行业过滤 */
  industry?: string;
  /** 按部门过滤 */
  department?: string;
  /** 按发布状态过滤 */
  isPublished?: boolean;
  /** 是否包含共享模板(超级租户的模板) */
  includeShared?: boolean;
}

// =============================================================================
// 调研会话相关DTO
// Interview Session DTOs
// =============================================================================

/**
 * 创建调研会话请求
 */
export interface CreateInterviewSessionDto {
  /** 客户档案ID */
  clientProfileId: string;
  /** 提纲模板ID */
  outlineTemplateId?: string;
  /** 会话标题 */
  title: string;
  /** 计划开始时间 */
  scheduledAt?: string;
  /** 分配的专家ID */
  assignedExpertId?: string;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 更新调研会话请求
 */
export interface UpdateInterviewSessionDto {
  /** 会话标题 */
  title?: string;
  /** 提纲模板ID */
  outlineTemplateId?: string;
  /** 计划开始时间 */
  scheduledAt?: string;
  /** 分配的专家ID */
  assignedExpertId?: string;
  /** 元数据(合并更新) */
  metadata?: Record<string, unknown>;
}

/**
 * 变更会话状态请求
 */
export interface UpdateSessionStatusDto {
  /** 新状态 */
  status: SessionStatus;
  /** 变更原因 */
  reason?: string;
}

/**
 * 开始会话请求
 */
export interface StartSessionDto {
  /** 开始时间(可选，默认为当前时间) */
  startedAt?: string;
  /** 首个部门ID */
  firstDepartmentId?: string;
}

/**
 * 完成会话请求
 */
export interface CompleteSessionDto {
  /** 完成时间(可选，默认为当前时间) */
  completedAt?: string;
  /** 是否立即开始AI处理 */
  triggerProcessing?: boolean;
}

/**
 * 会话列表查询参数
 */
export interface ListInterviewSessionsQueryDto extends QueryParamsDto {
  /** 按客户档案ID过滤 */
  clientProfileId?: string;
  /** 按状态过滤 */
  status?: SessionStatus;
  /** 按状态列表过滤 */
  statuses?: SessionStatus[];
  /** 按创建者过滤 */
  createdBy?: string;
  /** 按分配专家过滤 */
  assignedExpertId?: string;
  /** 计划时间范围 */
  scheduledRange?: DateRangeFilter;
  /** 包含已归档 */
  includeArchived?: boolean;
}

/**
 * 添加部门请求
 */
export interface AddDepartmentDto {
  /** 部门名称 */
  departmentName: string;
  /** 排序顺序(可选，默认为末尾) */
  sortOrder?: number;
  /** 备注 */
  notes?: string;
}

/**
 * 更新部门请求
 */
export interface UpdateDepartmentDto {
  /** 部门名称 */
  departmentName?: string;
  /** 排序顺序 */
  sortOrder?: number;
  /** 备注 */
  notes?: string;
}

/**
 * 添加问题请求
 */
export interface AddQuestionDto {
  /** 问题文本 */
  questionText: string;
  /** 提示文本 */
  hintText?: string;
  /** 排序顺序 */
  sortOrder?: number;
  /** 来源 */
  source?: string;
}

/**
 * 更新问题请求
 */
export interface UpdateQuestionDto {
  /** 问题文本 */
  questionText?: string;
  /** 提示文本 */
  hintText?: string;
  /** 排序顺序 */
  sortOrder?: number;
}

/**
 * 添加回答请求
 */
export interface AddAnswerDto {
  /** 回答文本 */
  answerText: string;
  /** 回答开始时间(毫秒偏移) */
  answerStartMs?: number;
  /** 回答结束时间 */
  answerEndMs?: number;
  /** 关联的录音ID */
  recordingId?: string;
  /** 是否标记 */
  isFlagged?: boolean;
}

/**
 * 更新回答请求
 */
export interface UpdateAnswerDto {
  /** 回答文本 */
  answerText?: string;
  /** 是否标记 */
  isFlagged?: boolean;
}

// =============================================================================
// 录音相关DTO
// Recording DTOs
// =============================================================================

/**
 * 创建录音请求
 */
export interface CreateRecordingDto {
  /** 部门ID(可选) */
  departmentId?: string;
  /** MIME类型 */
  mimeType?: string;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 更新录音状态请求
 */
export interface UpdateRecordingStatusDto {
  /** 新状态 */
  status: RecordingStatus;
  /** ASR任务ID */
  asrTaskId?: string;
  /** 错误信息 */
  errorMessage?: string;
}

/**
 * 录音列表查询参数
 */
export interface ListRecordingsQueryDto extends QueryParamsDto {
  /** 按状态过滤 */
  status?: RecordingStatus;
  /** 按部门过滤 */
  departmentId?: string;
}

/**
 * 上传录音完成回调
 */
export interface RecordingUploadCompleteDto {
  /** 录音ID */
  recordingId: string;
  /** 文件大小 */
  fileSizeBytes: number;
  /** 时长(毫秒) */
  durationMs: number;
  /** 存储URL */
  fileUrl: string;
}

// =============================================================================
// 转写相关DTO
// Transcription DTOs
// =============================================================================

/**
 * 转写列表查询参数
 */
export interface ListTranscriptionsQueryDto extends QueryParamsDto {
  /** 按录音ID过滤 */
  recordingId?: string;
  /** 是否只返回最终结果 */
  isFinal?: boolean;
  /** 时间范围(毫秒) */
  timeRange?: {
    startMs: number;
    endMs: number;
  };
}

// =============================================================================
// AI建议相关DTO
// AI Suggestion DTOs
// =============================================================================

/**
 * 响应AI建议请求
 */
export interface RespondToSuggestionDto {
  /** 是否接受 */
  accept: boolean;
  /** 驳回原因(如拒绝) */
  reason?: string;
}

/**
 * AI建议列表查询参数
 */
export interface ListAISuggestionsQueryDto extends QueryParamsDto {
  /** 按部门过滤 */
  departmentId?: string;
  /** 按类型过滤 */
  suggestionType?: SuggestionType;
  /** 是否已处理(接受或驳回) */
  isResponded?: boolean;
}

// =============================================================================
// 洞察相关DTO
// Insight DTOs
// =============================================================================

/**
 * 创建洞察请求(手动创建)
 */
export interface CreateInsightDto {
  /** 洞察层级 */
  layer: InsightLayer;
  /** 部门ID(如适用) */
  departmentId?: string;
  /** 标题 */
  title: string;
  /** 内容 */
  content: Record<string, unknown>;
  /** 优先级 */
  priority?: PriorityLevel;
  /** 排序顺序 */
  sortOrder?: number;
}

/**
 * 更新洞察请求
 */
export interface UpdateInsightDto {
  /** 内容 */
  content?: Record<string, unknown>;
  /** 优先级 */
  priority?: PriorityLevel;
  /** 排序顺序 */
  sortOrder?: number;
}

/**
 * 验证洞察请求
 */
export interface ValidateInsightDto {
  /** 是否验证通过 */
  validated: boolean;
  /** 验证备注 */
  notes?: string;
}

/**
 * 洞察列表查询参数
 */
export interface ListInsightsQueryDto extends QueryParamsDto {
  /** 按层级过滤 */
  layer?: InsightLayer;
  /** 按部门过滤 */
  departmentId?: string;
  /** 按优先级过滤 */
  priority?: PriorityLevel;
  /** 验证状态 */
  isValidated?: boolean;
}

/**
 * 生成洞察请求
 */
export interface GenerateInsightsDto {
  /** 要生成的层级列表 */
  layers: InsightLayer[];
  /** 是否覆盖现有洞察 */
  overwriteExisting?: boolean;
}

// =============================================================================
// 案例库相关DTO
// Case Library DTOs
// =============================================================================

/**
 * 创建案例请求
 */
export interface CreateCaseDto {
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
  /** 成果摘要 */
  outcomeSummary?: string;
  /** 标签 */
  tags?: string[];
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 更新案例请求
 */
export interface UpdateCaseDto {
  /** 案例标题 */
  title?: string;
  /** 匿名化客户名称 */
  clientAlias?: string;
  /** 行业 */
  industry?: string;
  /** 公司规模 */
  companySize?: string;
  /** 地区 */
  region?: string;
  /** 涉及的ERP系统 */
  erpSystem?: string;
  /** 项目年份 */
  engagementYear?: number;
  /** 成果摘要 */
  outcomeSummary?: string;
  /** 标签 */
  tags?: string[];
  /** 是否发布 */
  isPublished?: boolean;
  /** 元数据(合并更新) */
  metadata?: Record<string, unknown>;
}

/**
 * 案例列表查询参数
 */
export interface ListCasesQueryDto extends QueryParamsDto {
  /** 按行业过滤 */
  industry?: string;
  /** 按地区过滤 */
  region?: string;
  /** 按年份过滤 */
  engagementYear?: number;
  /** 按标签过滤(包含任意) */
  tags?: string[];
  /** 只返回已发布 */
  onlyPublished?: boolean;
}

/**
 * 搜索案例请求
 */
export interface SearchCasesDto {
  /** 搜索关键词 */
  query: string;
  /** 语义搜索阈值(0-1) */
  threshold?: number;
  /** 返回数量 */
  limit?: number;
}

/**
 * 创建案例功能点请求
 */
export interface CreateCaseFeatureDto {
  /** 功能域 */
  domain: string;
  /** 子系统 */
  subsystem: string;
  /** 功能点 */
  featurePoint: string;
  /** 功能描述 */
  description: string;
  /** 优先级 */
  priority?: PriorityLevel;
  /** 来源 */
  source?: string;
  /** 排序顺序 */
  sortOrder?: number;
}

/**
 * 更新案例功能点请求
 */
export interface UpdateCaseFeatureDto {
  /** 功能域 */
  domain?: string;
  /** 子系统 */
  subsystem?: string;
  /** 功能点 */
  featurePoint?: string;
  /** 功能描述 */
  description?: string;
  /** 优先级 */
  priority?: PriorityLevel;
  /** 排序顺序 */
  sortOrder?: number;
}

/**
 * 案例匹配审批请求
 */
export interface ApproveCaseMatchDto {
  /** 是否批准 */
  approved: boolean;
  /** 审批备注 */
  notes?: string;
}

// =============================================================================
// 认证相关DTO
// Auth DTOs
// =============================================================================

/**
 * 登录请求
 */
export interface LoginDto {
  /** 邮箱 */
  email: string;
  /** 密码 */
  password: string;
}

/**
 * 登录响应
 */
export interface LoginResponseDto {
  /** 访问令牌 */
  accessToken: string;
  /** 刷新令牌 */
  refreshToken: string;
  /** 令牌类型 */
  tokenType: string;
  /** 过期时间(秒) */
  expiresIn: number;
  /** 用户信息 */
  user: {
    id: string;
    email: string;
    displayName: string;
    role: UserRole;
    tenantId: string;
    avatarUrl?: string;
  };
}

/**
 * 刷新令牌请求
 */
export interface RefreshTokenDto {
  /** 刷新令牌 */
  refreshToken: string;
}

/**
 * 修改密码请求
 */
export interface ChangePasswordDto {
  /** 当前密码 */
  currentPassword: string;
  /** 新密码 */
  newPassword: string;
}

// =============================================================================
// 通用响应
// Common Responses
// =============================================================================

/**
 * API标准响应
 */
export interface ApiResponse<T> {
  /** 是否成功 */
  success: boolean;
  /** 状态码 */
  code: number;
  /** 消息 */
  message: string;
  /** 数据 */
  data?: T;
  /** 错误详情 */
  errors?: Array<{
    field?: string;
    message: string;
    code?: string;
  }>;
  /** 请求ID(用于追踪) */
  requestId?: string;
  /** 时间戳 */
  timestamp: string;
}

/**
 * 批量操作响应
 */
export interface BulkOperationResponse {
  /** 成功数量 */
  successCount: number;
  /** 失败数量 */
  failureCount: number;
  /** 失败详情 */
  failures?: Array<{
    id: string;
    error: string;
  }>;
}

/**
 * 导入/导出DTO
 */
export interface ImportDataDto {
  /** 数据格式 */
  format: 'json' | 'csv' | 'excel';
  /** 数据内容(base64或URL) */
  data: string;
  /** 是否覆盖现有数据 */
  overwrite?: boolean;
}

/**
 * 导出数据响应
 */
export interface ExportDataResponse {
  /** 下载URL */
  downloadUrl: string;
  /** 文件名 */
  filename: string;
  /** 过期时间 */
  expiresAt: string;
}
