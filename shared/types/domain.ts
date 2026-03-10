/**
 * Core domain types for the B2B sales research tool.
 *
 * Conventions:
 * - Branded ID types prevent accidental cross-entity ID assignment.
 * - All `Date` fields are native Date objects (use ISO strings in API layer).
 * - Discriminated unions carry a `kind` discriminant.
 */

// ---------------------------------------------------------------------------
// Branded ID primitives
// ---------------------------------------------------------------------------

declare const __brand: unique symbol;

/** Utility for creating nominal/branded types. */
type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type TenantId  = Brand<string, 'TenantId'>;
export type UserId    = Brand<string, 'UserId'>;
export type SessionId = Brand<string, 'SessionId'>;
export type RecordingId      = Brand<string, 'RecordingId'>;
export type TranscriptionId  = Brand<string, 'TranscriptionId'>;
export type DepartmentId     = Brand<string, 'DepartmentId'>;
export type QuestionId       = Brand<string, 'QuestionId'>;
export type AnswerId         = Brand<string, 'AnswerId'>;
export type TemplateId       = Brand<string, 'TemplateId'>;
export type SectionId        = Brand<string, 'SectionId'>;
export type CaseId           = Brand<string, 'CaseId'>;
export type CaseFeatureId    = Brand<string, 'CaseFeatureId'>;
export type CaseMatchId      = Brand<string, 'CaseMatchId'>;
export type InsightId        = Brand<string, 'InsightId'>;
export type AiSuggestionId   = Brand<string, 'AiSuggestionId'>;
export type ClientProfileId  = Brand<string, 'ClientProfileId'>;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Roles within a tenant. EXPERT is an external domain specialist. */
export enum UserRole {
  ADMIN  = 'ADMIN',
  SALES  = 'SALES',
  EXPERT = 'EXPERT',
}

/**
 * Interview session lifecycle.
 *
 * ```
 * DRAFT → IN_PROGRESS → COMPLETED → ARCHIVED
 * ```
 */
export enum SessionStatus {
  DRAFT       = 'DRAFT',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED   = 'COMPLETED',
  ARCHIVED    = 'ARCHIVED',
}

/** Case feature priority. P0 = must-have, P1 = important, P2 = nice-to-have. */
export enum Priority {
  P0 = 'P0',
  P1 = 'P1',
  P2 = 'P2',
}

/** Which of the three insight layers this insight belongs to. */
export enum InsightLayerLevel {
  LAYER_1 = 1,
  LAYER_2 = 2,
  LAYER_3 = 3,
}

// ---------------------------------------------------------------------------
// Multi-tenancy
// ---------------------------------------------------------------------------

/**
 * A channel company (渠道商) that onboards and manages its own users.
 * Zhongke Liuguang is the super-tenant that can view all tenants' data.
 */
export interface Tenant {
  id: TenantId;
  name: string;
  /** Marks the platform owner (Zhongke Liuguang). */
  isSuperTenant: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: UserId;
  tenantId: TenantId;
  email: string;
  displayName: string;
  role: UserRole;
  /** Soft-delete flag. */
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Client Profile
// ---------------------------------------------------------------------------

/**
 * Captured information about the prospective client being interviewed.
 * Attached to a session and used for case-library matching.
 */
export interface ClientProfile {
  id: ClientProfileId;
  sessionId: SessionId;
  companyName: string;
  industry: string;
  /** Approximate headcount. */
  companySize?: number;
  /** Primary contact name at the client. */
  contactName?: string;
  contactTitle?: string;
  /** Free-form tags describing the client context (e.g. "state-owned", "manufacturing"). */
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Interview Session
// ---------------------------------------------------------------------------

export interface InterviewSession {
  id: SessionId;
  tenantId: TenantId;
  /** Sales rep who owns this session. */
  ownerId: UserId;
  title: string;
  status: SessionStatus;
  clientProfile?: ClientProfile;
  /** Which outline template was used, if any. */
  templateId?: TemplateId;
  departments: InterviewDepartment[];
  recordings: Recording[];
  insights: Insight[];
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A functional department within the client organisation
 * that is interviewed as part of a session.
 */
export interface InterviewDepartment {
  id: DepartmentId;
  sessionId: SessionId;
  name: string;
  /** e.g. "Finance", "Operations", "IT". */
  departmentType: string;
  questions: InterviewQuestion[];
  /** Pain points extracted for this department (layer-2 insight). */
  painPoints: string[];
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface InterviewQuestion {
  id: QuestionId;
  departmentId: DepartmentId;
  sessionId: SessionId;
  text: string;
  /** Whether this question was AI-generated as a follow-up suggestion. */
  isAiGenerated: boolean;
  /** Source suggestion ID when isAiGenerated is true. */
  aiSuggestionId?: AiSuggestionId;
  answers: InterviewAnswer[];
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface InterviewAnswer {
  id: AnswerId;
  questionId: QuestionId;
  sessionId: SessionId;
  /** Plain-text answer content (may be derived from transcription). */
  content: string;
  /** Audio timestamp range within the recording (seconds). */
  timestampStart?: number;
  timestampEnd?: number;
  recordingId?: RecordingId;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Recording & Transcription
// ---------------------------------------------------------------------------

export type RecordingStatus =
  | 'PENDING'
  | 'RECORDING'
  | 'PROCESSING'
  | 'READY'
  | 'FAILED';

export interface Recording {
  id: RecordingId;
  sessionId: SessionId;
  /** Storage path or URL to the audio file. */
  storageUrl: string;
  status: RecordingStatus;
  /** Duration in seconds, available once processing is complete. */
  durationSeconds?: number;
  mimeType: string;
  transcription?: Transcription;
  startedAt: Date;
  endedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Full transcription produced by Tencent ASR for a recording.
 * Individual real-time chunks arrive as WebSocket events (see events.ts).
 */
export interface Transcription {
  id: TranscriptionId;
  recordingId: RecordingId;
  sessionId: SessionId;
  /** Complete merged transcript text. */
  fullText: string;
  /** Word-level or sentence-level segments with timestamps. */
  segments: TranscriptionSegment[];
  language: string;
  /** ASR confidence score, 0–1. */
  confidence?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TranscriptionSegment {
  /** Sequential segment index. */
  index: number;
  text: string;
  /** Start offset from recording start, in milliseconds. */
  startMs: number;
  /** End offset from recording start, in milliseconds. */
  endMs: number;
  /** Speaker label when diarisation is available. */
  speaker?: string;
  confidence?: number;
}

// ---------------------------------------------------------------------------
// Outline Template
// ---------------------------------------------------------------------------

/**
 * A reusable interview outline template, scoped to a tenant.
 * Admins and experts define templates; sales reps apply them to sessions.
 */
export interface OutlineTemplate {
  id: TemplateId;
  tenantId: TenantId;
  name: string;
  description?: string;
  sections: OutlineSection[];
  isDefault: boolean;
  createdBy: UserId;
  createdAt: Date;
  updatedAt: Date;
}

export interface OutlineSection {
  id: SectionId;
  templateId: TemplateId;
  /** Maps to a department type (e.g. "Finance"). */
  departmentType: string;
  title: string;
  description?: string;
  questions: OutlineQuestion[];
  displayOrder: number;
}

export interface OutlineQuestion {
  id: QuestionId;
  sectionId: SectionId;
  text: string;
  /** Hint shown to the interviewer but not read aloud. */
  hint?: string;
  /** Whether to always include this question vs. show as optional. */
  isRequired: boolean;
  displayOrder: number;
}

// ---------------------------------------------------------------------------
// Case Library
// ---------------------------------------------------------------------------

/**
 * A historical client engagement used as a reference for similarity matching.
 */
export interface Case {
  id: CaseId;
  tenantId: TenantId;
  /** Short descriptive title for this engagement. */
  title: string;
  clientName: string;
  industry: string;
  companySize?: number;
  /** High-level outcome or solution summary. */
  summary: string;
  features: CaseFeature[];
  tags: string[];
  createdBy: UserId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A single feature item within a case, organised by a 4-level taxonomy.
 *
 * Taxonomy: domain → subsystem → feature_point → description
 */
export interface CaseFeature {
  id: CaseFeatureId;
  caseId: CaseId;
  /** Top-level business domain (e.g. "Supply Chain"). */
  domain: string;
  /** Functional subsystem within the domain (e.g. "Inventory Management"). */
  subsystem: string;
  /** Specific feature point (e.g. "Real-time Stock Alert"). */
  featurePoint: string;
  /** Detailed description of what the feature does. */
  description: string;
  priority: Priority;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Result of matching a session's client profile against a historical case.
 * Stored so salespeople can review and act on recommendations.
 */
export interface CaseMatch {
  id: CaseMatchId;
  sessionId: SessionId;
  caseId: CaseId;
  /** Cosine or ML-derived similarity score, 0–1. */
  similarityScore: number;
  /** Human-readable rationale for the match. */
  matchRationale: string;
  /** Ordered list of features considered most relevant. */
  relevantFeatureIds: CaseFeatureId[];
  computedAt: Date;
}

// ---------------------------------------------------------------------------
// Insights (3-layer model)
// ---------------------------------------------------------------------------

/**
 * Layer-1 insight: raw transcript anchored to an audio timestamp.
 * Produced directly from ASR output with minimal processing.
 */
export interface InsightLayer1 {
  kind: 'LAYER_1';
  id: InsightId;
  sessionId: SessionId;
  /** Verbatim quote or transcript excerpt. */
  rawText: string;
  /** Recording timestamp range (seconds) this insight is anchored to. */
  timestampStart: number;
  timestampEnd: number;
  recordingId: RecordingId;
  /** Department context, if inferrable. */
  departmentId?: DepartmentId;
  createdAt: Date;
}

/**
 * Layer-2 insight: structured pain point extracted per department.
 * Produced by AI analysis of layer-1 data.
 */
export interface InsightLayer2 {
  kind: 'LAYER_2';
  id: InsightId;
  sessionId: SessionId;
  departmentId: DepartmentId;
  /** Concise pain-point statement. */
  painPoint: string;
  /** Business impact description. */
  impact?: string;
  /** Source layer-1 insight IDs that support this finding. */
  sourceInsightIds: InsightId[];
  priority: Priority;
  createdAt: Date;
}

/**
 * Layer-3 insight: executive summary distilling top insights,
 * meta-needs, and a proposed solution direction.
 */
export interface InsightLayer3 {
  kind: 'LAYER_3';
  id: InsightId;
  sessionId: SessionId;
  /** Ranked list of the most critical findings. */
  topInsights: string[];
  /** Underlying strategic or organisational needs inferred from pain points. */
  metaNeeds: string[];
  /** High-level solution direction or recommendation. */
  solutionDirection: string;
  /** Source layer-2 insight IDs that feed this summary. */
  sourceInsightIds: InsightId[];
  createdAt: Date;
}

/** Discriminated union covering all insight layers. */
export type Insight = InsightLayer1 | InsightLayer2 | InsightLayer3;

// ---------------------------------------------------------------------------
// AI Suggestion
// ---------------------------------------------------------------------------

/**
 * A follow-up question or prompt generated by the AI (Kimi-k2.5)
 * during a live interview, based on the current transcript context.
 */
export interface AiSuggestion {
  id: AiSuggestionId;
  sessionId: SessionId;
  /** The department context in which the suggestion was generated. */
  departmentId?: DepartmentId;
  /** The preceding question that triggered this suggestion, if any. */
  triggerQuestionId?: QuestionId;
  /** Suggested follow-up question text. */
  suggestedQuestion: string;
  /** AI reasoning / rationale for this suggestion. */
  rationale?: string;
  /** Whether the interviewer accepted and used this suggestion. */
  wasAccepted: boolean;
  createdAt: Date;
}
