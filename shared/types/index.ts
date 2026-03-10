/**
 * 中科琉光调研工具 - 共享类型定义主入口
 * Zhongke Liuguang Research Tool - Shared Type Definitions Entry Point
 *
 * 全栈共享的类型定义，用于NestJS后端、React Web前端和React Native移动端。
 * Full-stack shared type definitions for NestJS backend, React Web frontend,
 * and React Native mobile app.
 */

// =============================================================================
// 导出枚举
// Export Enums
// =============================================================================

export {
  UserRole,
  SessionStatus,
  PriorityLevel,
  RecordingStatus,
  SuggestionType,
  InsightLayer,
  QuestionSource,
  AuditAction,
  EntityType,
  WebSocketEventType,
  CopilotRole,
  CopilotContentType,
} from './enums';

// =============================================================================
// 导出API核心类型
// Export Core API Types
// =============================================================================

export type {
  // JSONB复合类型
  TenantMetadata,
  UserMetadata,
  ClientProfileMetadata,
  OutlineTemplateContent,
  StructuredSummary,
  ExecutiveSummary,
  WordTimestamp,
  MatchedFeature,
  InsightContent,

  // 核心实体
  Tenant,
  User,
  UserRoleHistory,
  ClientProfile,
  OutlineTemplate,
  InterviewSession,
  InterviewDepartment,
  InterviewQuestion,
  InterviewAnswer,
  Recording,
  Transcription,
  AISuggestion,
  Insight,
  Case,
  CaseFeature,
  CaseMatch,
  AuditLog,
} from './api.types';

// =============================================================================
// 导出WebSocket类型
// Export WebSocket Types
// =============================================================================

export type {
  // 基础类型
  WebSocketMessage,
  WebSocketEvent,
  ClientToServerEvent,
  ServerToClientEvent,

  // ASR事件
  ASRTranscriptSegment,
  ASRTranscriptEvent,
  ASRStatusEvent,
  ASRCompleteEvent,
  ASRErrorEvent,

  // AI建议事件
  AISuggestionData,
  AISuggestionEvent,
  AISuggestionAcceptedEvent,
  AISuggestionDismissedEvent,
  AIInsightEvent,

  // 会话状态事件
  SessionStatusEvent,
  SessionStartedEvent,
  SessionCompletedEvent,

  // Copilot事件
  CopilotContentBlock,
  CopilotMessageEvent,
  CopilotTypingEvent,

  // 录音事件
  RecordingStartedEvent,
  RecordingStoppedEvent,
  RecordingChunkEvent,

  // 心跳事件
  PingEvent,
  PongEvent,
} from './websocket.types';

// =============================================================================
// 导出DTO类型
// Export DTO Types
// =============================================================================

export type {
  // 分页
  PaginationQueryDto,
  PaginationMeta,
  PaginatedResponse,
  CursorPaginationQueryDto,
  CursorPaginatedResponse,

  // 查询参数
  SortOption,
  FilterCondition,
  FilterOperator,
  QueryParamsDto,
  DateRangeFilter,

  // 用户DTO
  CreateUserDto,
  UpdateUserDto,
  UpdateCurrentUserDto,
  ListUsersQueryDto,
  ChangeUserRoleDto,

  // 租户DTO
  CreateTenantDto,
  UpdateTenantDto,
  ListTenantsQueryDto,

  // 客户档案DTO
  CreateClientProfileDto,
  UpdateClientProfileDto,
  ListClientProfilesQueryDto,

  // 提纲模板DTO
  CreateOutlineTemplateDto,
  UpdateOutlineTemplateDto,
  GenerateOutlineTemplateDto,
  ListOutlineTemplatesQueryDto,

  // 调研会话DTO
  CreateInterviewSessionDto,
  UpdateInterviewSessionDto,
  UpdateSessionStatusDto,
  StartSessionDto,
  CompleteSessionDto,
  ListInterviewSessionsQueryDto,
  AddDepartmentDto,
  UpdateDepartmentDto,
  AddQuestionDto,
  UpdateQuestionDto,
  AddAnswerDto,
  UpdateAnswerDto,

  // 录音DTO
  CreateRecordingDto,
  UpdateRecordingStatusDto,
  ListRecordingsQueryDto,
  RecordingUploadCompleteDto,

  // 转写DTO
  ListTranscriptionsQueryDto,

  // AI建议DTO
  RespondToSuggestionDto,
  ListAISuggestionsQueryDto,

  // 洞察DTO
  CreateInsightDto,
  UpdateInsightDto,
  ValidateInsightDto,
  ListInsightsQueryDto,
  GenerateInsightsDto,

  // 案例库DTO
  CreateCaseDto,
  UpdateCaseDto,
  ListCasesQueryDto,
  SearchCasesDto,
  CreateCaseFeatureDto,
  UpdateCaseFeatureDto,
  ApproveCaseMatchDto,

  // 认证DTO
  LoginDto,
  LoginResponseDto,
  RefreshTokenDto,
  ChangePasswordDto,

  // 通用响应
  ApiResponse,
  BulkOperationResponse,
  ImportDataDto,
  ExportDataResponse,
} from './dto';
