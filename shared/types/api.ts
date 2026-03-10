/**
 * API layer DTOs for the B2B sales research tool.
 *
 * Conventions:
 * - All dates are ISO 8601 strings (YYYY-MM-DDTHH:mm:ss.sssZ).
 * - ID fields are plain `string`; the branded types from domain.ts are
 *   stripped at the API boundary for JSON compatibility.
 * - Request types carry only the fields the client must supply.
 * - Response types are flat and safe to serialise — no circular refs.
 */

import type { Priority, SessionStatus, UserRole } from './domain';

// ---------------------------------------------------------------------------
// Generic wrappers
// ---------------------------------------------------------------------------

/** Standard paginated response envelope. */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Standard API error shape returned by all 4xx/5xx responses. */
export interface ApiError {
  /** Machine-readable error code (e.g. "SESSION_NOT_FOUND"). */
  code: string;
  /** Human-readable message safe to display in a UI. */
  message: string;
  /** HTTP status code mirrored in the body for convenience. */
  statusCode: number;
  /** Field-level validation errors keyed by field path. */
  fieldErrors?: Record<string, string[]>;
  /** ISO timestamp of when the error occurred. */
  timestamp: string;
  /** Request trace ID for log correlation. */
  traceId?: string;
}

// ---------------------------------------------------------------------------
// Tenant & Auth
// ---------------------------------------------------------------------------

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
  user: UserResponse;
}

export interface UserResponse {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface CreateUserRequest {
  email: string;
  displayName: string;
  role: UserRole;
  /** Plain-text password; must meet backend complexity rules. */
  password: string;
}

export interface UpdateUserRequest {
  displayName?: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface TenantResponse {
  id: string;
  name: string;
  isSuperTenant: boolean;
  createdAt: string;
}

export interface CreateTenantRequest {
  name: string;
}

// ---------------------------------------------------------------------------
// Client Profile
// ---------------------------------------------------------------------------

export interface CreateClientProfileRequest {
  companyName: string;
  industry: string;
  companySize?: number;
  contactName?: string;
  contactTitle?: string;
  tags?: string[];
}

export interface UpdateClientProfileRequest {
  companyName?: string;
  industry?: string;
  companySize?: number;
  contactName?: string;
  contactTitle?: string;
  tags?: string[];
}

export interface ClientProfileResponse {
  id: string;
  sessionId: string;
  companyName: string;
  industry: string;
  companySize?: number;
  contactName?: string;
  contactTitle?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Interview Session
// ---------------------------------------------------------------------------

export interface CreateSessionRequest {
  title: string;
  /** Pre-populate from an existing outline template. */
  templateId?: string;
  /** Optionally supply client profile inline on creation. */
  clientProfile?: CreateClientProfileRequest;
  scheduledAt?: string;
}

export interface UpdateSessionRequest {
  title?: string;
  scheduledAt?: string;
}

/** Lightweight session summary used in list views. */
export interface SessionSummaryResponse {
  id: string;
  tenantId: string;
  ownerId: string;
  ownerName: string;
  title: string;
  status: SessionStatus;
  clientCompanyName?: string;
  clientIndustry?: string;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** Full session detail including all nested entities. */
export interface SessionResponse extends SessionSummaryResponse {
  clientProfile?: ClientProfileResponse;
  departments: DepartmentResponse[];
  recordings: RecordingResponse[];
}

export interface ListSessionsRequest {
  page?: number;
  pageSize?: number;
  status?: SessionStatus;
  /** Filter to sessions owned by this user ID. */
  ownerId?: string;
  /** Full-text search against title and client company name. */
  search?: string;
  /** ISO date range filters. */
  createdAfter?: string;
  createdBefore?: string;
}

// ---------------------------------------------------------------------------
// Departments & Questions
// ---------------------------------------------------------------------------

export interface CreateDepartmentRequest {
  sessionId: string;
  name: string;
  departmentType: string;
  displayOrder?: number;
}

export interface UpdateDepartmentRequest {
  name?: string;
  departmentType?: string;
  displayOrder?: number;
  painPoints?: string[];
}

export interface DepartmentResponse {
  id: string;
  sessionId: string;
  name: string;
  departmentType: string;
  painPoints: string[];
  questions: QuestionResponse[];
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuestionRequest {
  departmentId: string;
  sessionId: string;
  text: string;
  displayOrder?: number;
}

export interface UpdateQuestionRequest {
  text?: string;
  displayOrder?: number;
}

export interface QuestionResponse {
  id: string;
  departmentId: string;
  sessionId: string;
  text: string;
  isAiGenerated: boolean;
  aiSuggestionId?: string;
  answers: AnswerResponse[];
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAnswerRequest {
  questionId: string;
  sessionId: string;
  content: string;
  timestampStart?: number;
  timestampEnd?: number;
  recordingId?: string;
}

export interface AnswerResponse {
  id: string;
  questionId: string;
  sessionId: string;
  content: string;
  timestampStart?: number;
  timestampEnd?: number;
  recordingId?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Recording
// ---------------------------------------------------------------------------

export interface StartRecordingRequest {
  sessionId: string;
  mimeType: string;
}

export interface StopRecordingRequest {
  recordingId: string;
}

export interface RecordingResponse {
  id: string;
  sessionId: string;
  storageUrl: string;
  status: string;
  durationSeconds?: number;
  mimeType: string;
  transcription?: TranscriptionResponse;
  startedAt: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TranscriptionResponse {
  id: string;
  recordingId: string;
  sessionId: string;
  fullText: string;
  segments: TranscriptionSegmentResponse[];
  language: string;
  confidence?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TranscriptionSegmentResponse {
  index: number;
  text: string;
  startMs: number;
  endMs: number;
  speaker?: string;
  confidence?: number;
}

// ---------------------------------------------------------------------------
// Outline Template
// ---------------------------------------------------------------------------

export interface CreateOutlineRequest {
  name: string;
  description?: string;
  isDefault?: boolean;
  sections: CreateOutlineSectionRequest[];
}

export interface CreateOutlineSectionRequest {
  departmentType: string;
  title: string;
  description?: string;
  displayOrder?: number;
  questions: CreateOutlineQuestionRequest[];
}

export interface CreateOutlineQuestionRequest {
  text: string;
  hint?: string;
  isRequired?: boolean;
  displayOrder?: number;
}

export interface UpdateOutlineRequest {
  name?: string;
  description?: string;
  isDefault?: boolean;
  sections?: CreateOutlineSectionRequest[];
}

export interface OutlineResponse {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  sections: OutlineSectionResponse[];
  isDefault: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface OutlineSectionResponse {
  id: string;
  templateId: string;
  departmentType: string;
  title: string;
  description?: string;
  questions: OutlineQuestionResponse[];
  displayOrder: number;
}

export interface OutlineQuestionResponse {
  id: string;
  sectionId: string;
  text: string;
  hint?: string;
  isRequired: boolean;
  displayOrder: number;
}

// ---------------------------------------------------------------------------
// Case Library
// ---------------------------------------------------------------------------

export interface CreateCaseRequest {
  title: string;
  clientName: string;
  industry: string;
  companySize?: number;
  summary: string;
  tags?: string[];
  features: CreateCaseFeatureRequest[];
}

export interface CreateCaseFeatureRequest {
  domain: string;
  subsystem: string;
  featurePoint: string;
  description: string;
  priority: Priority;
}

export interface UpdateCaseRequest {
  title?: string;
  clientName?: string;
  industry?: string;
  companySize?: number;
  summary?: string;
  tags?: string[];
}

export interface CaseResponse {
  id: string;
  tenantId: string;
  title: string;
  clientName: string;
  industry: string;
  companySize?: number;
  summary: string;
  features: CaseFeatureResponse[];
  tags: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CaseFeatureResponse {
  id: string;
  caseId: string;
  domain: string;
  subsystem: string;
  featurePoint: string;
  description: string;
  priority: Priority;
  createdAt: string;
  updatedAt: string;
}

/**
 * Result of a case-matching computation for a given session.
 * Includes the matched case summary and ranked relevant features.
 */
export interface CaseMatchResponse {
  id: string;
  sessionId: string;
  case: CaseSummaryResponse;
  similarityScore: number;
  matchRationale: string;
  relevantFeatures: CaseFeatureResponse[];
  computedAt: string;
}

/** Lightweight case summary used inside match results and list views. */
export interface CaseSummaryResponse {
  id: string;
  title: string;
  clientName: string;
  industry: string;
  companySize?: number;
  summary: string;
  tags: string[];
}

/** Request to trigger case-matching for a session. */
export interface TriggerCaseMatchRequest {
  sessionId: string;
  /** Max number of case matches to return. Defaults to 5. */
  topK?: number;
}

export interface ListCasesRequest {
  page?: number;
  pageSize?: number;
  industry?: string;
  search?: string;
}

// ---------------------------------------------------------------------------
// Insights
// ---------------------------------------------------------------------------

export interface InsightLayer1Response {
  kind: 'LAYER_1';
  id: string;
  sessionId: string;
  rawText: string;
  timestampStart: number;
  timestampEnd: number;
  recordingId: string;
  departmentId?: string;
  createdAt: string;
}

export interface InsightLayer2Response {
  kind: 'LAYER_2';
  id: string;
  sessionId: string;
  departmentId: string;
  painPoint: string;
  impact?: string;
  sourceInsightIds: string[];
  priority: Priority;
  createdAt: string;
}

export interface InsightLayer3Response {
  kind: 'LAYER_3';
  id: string;
  sessionId: string;
  topInsights: string[];
  metaNeeds: string[];
  solutionDirection: string;
  sourceInsightIds: string[];
  createdAt: string;
}

export type InsightResponse =
  | InsightLayer1Response
  | InsightLayer2Response
  | InsightLayer3Response;

/** Request to (re)generate AI-derived insights for a session. */
export interface GenerateInsightsRequest {
  sessionId: string;
  /** Which layers to (re)generate. Defaults to all layers. */
  layers?: (1 | 2 | 3)[];
}

// ---------------------------------------------------------------------------
// AI Suggestion
// ---------------------------------------------------------------------------

export interface AiSuggestionResponse {
  id: string;
  sessionId: string;
  departmentId?: string;
  triggerQuestionId?: string;
  suggestedQuestion: string;
  rationale?: string;
  wasAccepted: boolean;
  createdAt: string;
}

/** Mark a suggestion as accepted (i.e. the interviewer used it). */
export interface AcceptAiSuggestionRequest {
  suggestionId: string;
  sessionId: string;
}
