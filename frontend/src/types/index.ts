export type ViewType =
  | 'login'
  | 'admin-users'
  | 'admin-dictionary'
  | 'admin-settings'
  | 'settings'
  | 'crm'
  | 'survey-templates'
  | 'survey-template-editor'
  | 'survey-sessions'
  | 'survey-workspace'
  | 'survey-insights'
  | 'expert-pending'
  | 'expert-review'
  | 'case-library'
  | 'case-entry'
  | 'customer-portrait'
  | 'admin-tenants'
  | 'admin-audit-logs';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: '活跃' | '离线' | '待处理';
  avatar: string;
}

export interface SurveySession {
  id: string;
  title: string;
  customer: string;
  date: string;
  status: '已完成' | '进行中' | '已预约';
  duration: string;
}

export type UserRole = 'ADMIN' | 'SALES' | 'EXPERT';

export interface TemplateQuestion {
  text: string;
  type?: string;
  required?: boolean;
  hint?: string;
}

export interface TemplateSection {
  id?: string;
  title: string;
  questions: TemplateQuestion[];
  notes?: string;
  order?: number;
}

export interface TemplatePayload {
  id?: string;
  title: string;
  sections: TemplateSection[];
  duration?: number;
}

// ── LLM / Chat ──

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  role: MessageRole;
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  sessionId?: string;
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ── Streaming ──

export type StreamStatus = 'idle' | 'streaming' | 'done' | 'error';

export interface StreamChunk {
  delta: string;
  done: boolean;
}

// ── Outline ──

export interface OutlineSection {
  id: string;
  title: string;
  questions: string[];
  notes?: string;
}

export interface OutlineRequest {
  sessionId: string;
  clientBackground?: string;
  researchGoals?: string[];
  existingOutline?: OutlineSection[];
}

export interface OutlineResponse {
  sections: OutlineSection[];
  generatedAt: string;
}

// ── Insights ──

export type InsightType = 'pain_point' | 'opportunity' | 'requirement' | 'behavior' | 'attitude';

export interface InsightItem {
  id: string;
  type: InsightType;
  content: string;
  quote?: string;
  confidence: number;  // 0-1
  tags: string[];
}

export interface InsightExtractRequest {
  sessionId: string;
  transcript: string;
  context?: string;
}

export interface InsightResponse {
  insights: InsightItem[];
  summary: string;
  generatedAt: string;
}

// ── ASR ──

export interface TranscriptSegment {
  id: string;
  speakerLabel: string;
  text: string;
  startMs: number;
  endMs: number;
  confidence?: number;
}

export interface TranscriptionResult {
  sessionId: string;
  segments: TranscriptSegment[];
  fullText: string;
  language: string;
  duration: number;
}

// ── Feature Flag Definitions ──

export enum FeatureFlagCategory {
  SALES = 'sales',
  EXPERT = 'expert',
  AI = 'ai',
  SYSTEM = 'system',
}

export interface FeatureFlagItem {
  id: string;
  key: string;
  name: string;
  description: string;
  category: FeatureFlagCategory;
  iconName: string;
  sortOrder: number;
  enabled: boolean;
  icon: React.ElementType; // Mapped frontend-side from iconName
}

// ── Template Categories ──

export interface TemplateCategoryFilter {
  type: TemplateType | null;
  category: string | null;
  search: string;
}

export enum TemplateType {
  INTERVIEW = 'interview',
  QUESTIONNAIRE = 'questionnaire',
}

// ── Default Template Sections ──

export interface DefaultQuestion {
  id: string;
  text: string;
  type: 'open' | 'scale' | 'choice';
}

export interface DefaultSection {
  id: string;
  title: string;
  description?: string;
  questions: DefaultQuestion[];
}

// ── API response envelope ──

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error?: string;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
