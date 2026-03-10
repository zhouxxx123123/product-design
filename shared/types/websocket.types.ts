/**
 * 中科琉光调研工具 - WebSocket事件类型定义
 * Zhongke Liuguang Research Tool - WebSocket Event Type Definitions
 *
 * 用于实时协作、ASR流式转写和AI辅助功能。
 * Used for real-time collaboration, streaming ASR, and AI assistance.
 */

import { SuggestionType, RecordingStatus, SessionStatus, InsightLayer } from './enums';
import { WordTimestamp } from './api.types';

// =============================================================================
// 基础WebSocket类型
// Base WebSocket Types
// =============================================================================

/**
 * WebSocket事件类型
 */
export enum WebSocketEventType {
  // 连接相关
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  ERROR = 'error',

  // ASR转写相关
  ASR_TRANSCRIPT = 'asr:transcript',
  ASR_STATUS = 'asr:status',
  ASR_COMPLETE = 'asr:complete',
  ASR_ERROR = 'asr:error',

  // AI建议相关
  AI_SUGGESTION = 'ai:suggestion',
  AI_SUGGESTION_ACCEPTED = 'ai:suggestion:accepted',
  AI_SUGGESTION_DISMISSED = 'ai:suggestion:dismissed',
  AI_INSIGHT = 'ai:insight',

  // 会话状态
  SESSION_STATUS = 'session:status',
  SESSION_STARTED = 'session:started',
  SESSION_COMPLETED = 'session:completed',

  // Copilot对话
  COPILOT_MESSAGE = 'copilot:message',
  COPILOT_TYPING = 'copilot:typing',

  // 录音相关
  RECORDING_STARTED = 'recording:started',
  RECORDING_STOPPED = 'recording:stopped',
  RECORDING_CHUNK = 'recording:chunk',

  // 心跳
  PING = 'ping',
  PONG = 'pong',
}

/**
 * WebSocket消息基础接口
 */
export interface WebSocketMessage {
  /** 事件类型 */
  event: WebSocketEventType;
  /** 消息ID(用于追踪) */
  messageId: string;
  /** 时间戳 */
  timestamp: string;
  /** 会话ID(上下文) */
  sessionId: string;
  /** 租户ID */
  tenantId: string;
  /** 用户ID */
  userId: string;
}

// =============================================================================
// ASR转写事件
// ASR Transcription Events
// =============================================================================

/**
 * ASR转写片段数据
 */
export interface ASRTranscriptSegment {
  /** 转写ID */
  transcriptionId: string;
  /** 录音ID */
  recordingId: string;
  /** 片段开始时间(毫秒) */
  startMs: number;
  /** 片段结束时间 */
  endMs: number;
  /** 说话人标签 */
  speakerLabel?: string;
  /** 转写文本 */
  text: string;
  /** 置信度(0-1) */
  confidence: number;
  /** 是否最终结果(非临时) */
  isFinal: boolean;
  /** 单词级时间戳 */
  wordTimestamps?: WordTimestamp[];
}

/**
 * ASR转写事件
 * 实时流式转写结果
 */
export interface ASRTranscriptEvent extends WebSocketMessage {
  event: WebSocketEventType.ASR_TRANSCRIPT;
  payload: {
    /** 转写片段 */
    segment: ASRTranscriptSegment;
    /** 当前录音累计时长 */
    totalDurationMs: number;
    /** 是否句子结束 */
    isSentenceEnd?: boolean;
  };
}

/**
 * ASR状态变更事件
 */
export interface ASRStatusEvent extends WebSocketMessage {
  event: WebSocketEventType.ASR_STATUS;
  payload: {
    /** 录音ID */
    recordingId: string;
    /** 新状态 */
    status: RecordingStatus;
    /** 状态描述 */
    message?: string;
    /** 进度百分比(0-100) */
    progress?: number;
  };
}

/**
 * ASR完成事件
 */
export interface ASRCompleteEvent extends WebSocketMessage {
  event: WebSocketEventType.ASR_COMPLETE;
  payload: {
    /** 录音ID */
    recordingId: string;
    /** 完整转写文本 */
    fullText: string;
    /** 总时长 */
    durationMs: number;
    /** 片段数量 */
    segmentCount: number;
  };
}

/**
 * ASR错误事件
 */
export interface ASRErrorEvent extends WebSocketMessage {
  event: WebSocketEventType.ASR_ERROR;
  payload: {
    /** 录音ID */
    recordingId: string;
    /** 错误码 */
    errorCode: string;
    /** 错误信息 */
    errorMessage: string;
    /** 是否可重试 */
    retryable: boolean;
  };
}

// =============================================================================
// AI建议事件
// AI Suggestion Events
// =============================================================================

/**
 * AI建议数据
 */
export interface AISuggestionData {
  /** 建议ID */
  suggestionId: string;
  /** 建议类型 */
  type: SuggestionType;
  /** 建议的问题文本 */
  questionText: string;
  /** 建议理由 */
  rationale?: string;
  /** 置信度分数 */
  confidence: number;
  /** 触发的转写文本上下文 */
  triggerContext?: string;
  /** 预期追问方向 */
  expectedOutcome?: string;
}

/**
 * AI建议事件
 * 实时生成的追问/澄清建议
 */
export interface AISuggestionEvent extends WebSocketMessage {
  event: WebSocketEventType.AI_SUGGESTION;
  payload: {
    /** 部门ID */
    departmentId: string;
    /** 当前问题ID */
    currentQuestionId: string;
    /** 建议列表 */
    suggestions: AISuggestionData[];
    /** 生成耗时(毫秒) */
    generationTimeMs: number;
    /** 来源模型 */
    sourceModel: string;
  };
}

/**
 * AI建议被接受事件
 */
export interface AISuggestionAcceptedEvent extends WebSocketMessage {
  event: WebSocketEventType.AI_SUGGESTION_ACCEPTED;
  payload: {
    /** 建议ID */
    suggestionId: string;
    /** 新生成的问题ID */
    questionId: string;
    /** 问题文本 */
    questionText: string;
    /** 部门ID */
    departmentId: string;
  };
}

/**
 * AI建议被驳回事件
 */
export interface AISuggestionDismissedEvent extends WebSocketMessage {
  event: WebSocketEventType.AI_SUGGESTION_DISMISSED;
  payload: {
    /** 建议ID */
    suggestionId: string;
    /** 驳回原因 */
    reason?: string;
  };
}

/**
 * AI洞察事件
 * 层级1/2/3洞察实时推送
 */
export interface AIInsightEvent extends WebSocketMessage {
  event: WebSocketEventType.AI_INSIGHT;
  payload: {
    /** 洞察ID */
    insightId: string;
    /** 洞察层级 */
    layer: InsightLayer;
    /** 部门ID(如适用) */
    departmentId?: string;
    /** 洞察标题 */
    title: string;
    /** 洞察内容 */
    content: string;
    /** 关联的转写片段ID */
    relatedTranscriptionIds?: string[];
    /** 优先级 */
    priority?: 'HIGH' | 'MEDIUM' | 'LOW';
    /** 是否为增量更新 */
    isIncremental: boolean;
  };
}

// =============================================================================
// 会话状态变更事件
// Session Status Events
// =============================================================================

/**
 * 会话状态变更事件
 */
export interface SessionStatusEvent extends WebSocketMessage {
  event: WebSocketEventType.SESSION_STATUS;
  payload: {
    /** 会话ID */
    sessionId: string;
    /** 旧状态 */
    oldStatus: SessionStatus;
    /** 新状态 */
    newStatus: SessionStatus;
    /** 变更原因 */
    reason?: string;
    /** 变更者ID */
    changedBy: string;
    /** 变更时间 */
    changedAt: string;
  };
}

/**
 * 会话开始事件
 */
export interface SessionStartedEvent extends WebSocketMessage {
  event: WebSocketEventType.SESSION_STARTED;
  payload: {
    /** 会话ID */
    sessionId: string;
    /** 开始时间 */
    startedAt: string;
    /** 开始录音ID */
    recordingId: string;
    /** 当前部门 */
    currentDepartmentId: string;
  };
}

/**
 * 会话完成事件
 */
export interface SessionCompletedEvent extends WebSocketMessage {
  event: WebSocketEventType.SESSION_COMPLETED;
  payload: {
    /** 会话ID */
    sessionId: string;
    /** 完成时间 */
    completedAt: string;
    /** 总录音时长 */
    totalDurationMs: number;
    /** 录音文件数量 */
    recordingCount: number;
    /** 预估处理时间(秒) */
    estimatedProcessingTime: number;
  };
}

// =============================================================================
// Copilot对话事件
// Copilot Chat Events
// =============================================================================

/**
 * Copilot消息角色
 */
export enum CopilotRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}

/**
 * Copilot消息内容类型
 */
export enum CopilotContentType {
  TEXT = 'text',
  SUGGESTION = 'suggestion',
  INSIGHT = 'insight',
  ACTION = 'action',
}

/**
 * Copilot消息内容块
 */
export interface CopilotContentBlock {
  /** 内容类型 */
  type: CopilotContentType;
  /** 内容文本 */
  text: string;
  /** 建议数据(如适用) */
  suggestionData?: AISuggestionData;
  /** 洞察数据(如适用) */
  insightData?: {
    layer: InsightLayer;
    title: string;
    content: string;
  };
  /** 动作(如适用) */
  action?: {
    type: string;
    label: string;
    payload: Record<string, unknown>;
  };
}

/**
 * Copilot消息事件
 */
export interface CopilotMessageEvent extends WebSocketMessage {
  event: WebSocketEventType.COPILOT_MESSAGE;
  payload: {
    /** 消息ID */
    messageId: string;
    /** 角色 */
    role: CopilotRole;
    /** 消息内容块 */
    content: CopilotContentBlock[];
    /** 引用的上下文 */
    context?: {
      /** 转写片段ID */
      transcriptionIds?: string[];
      /** 当前部门 */
      departmentId?: string;
      /** 当前问题 */
      questionId?: string;
    };
    /** token使用统计 */
    tokenUsage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  };
}

/**
 * Copilot输入中事件
 */
export interface CopilotTypingEvent extends WebSocketMessage {
  event: WebSocketEventType.COPILOT_TYPING;
  payload: {
    /** 是否正在生成 */
    isTyping: boolean;
    /** 已生成的部分文本 */
    partialText?: string;
  };
}

// =============================================================================
// 录音事件
// Recording Events
// =============================================================================

/**
 * 录音开始事件
 */
export interface RecordingStartedEvent extends WebSocketMessage {
  event: WebSocketEventType.RECORDING_STARTED;
  payload: {
    /** 录音ID */
    recordingId: string;
    /** 部门ID */
    departmentId?: string;
    /** 开始时间 */
    startedAt: string;
    /** 采样率 */
    sampleRate: number;
    /** 声道数 */
    channels: number;
  };
}

/**
 * 录音停止事件
 */
export interface RecordingStoppedEvent extends WebSocketMessage {
  event: WebSocketEventType.RECORDING_STOPPED;
  payload: {
    /** 录音ID */
    recordingId: string;
    /** 停止时间 */
    stoppedAt: string;
    /** 时长(毫秒) */
    durationMs: number;
    /** 文件大小(字节) */
    fileSizeBytes: number;
    /** 是否立即开始ASR */
    startASR: boolean;
  };
}

/**
 * 录音数据块事件(用于实时流式传输)
 */
export interface RecordingChunkEvent extends WebSocketMessage {
  event: WebSocketEventType.RECORDING_CHUNK;
  payload: {
    /** 录音ID */
    recordingId: string;
    /** 数据块序号 */
    sequence: number;
    /** Base64编码的音频数据 */
    audioData: string;
    /** 时间戳偏移(毫秒) */
    timestampMs: number;
  };
}

// =============================================================================
// 心跳事件
// Heartbeat Events
// =============================================================================

/**
 * Ping事件
 */
export interface PingEvent {
  event: WebSocketEventType.PING;
  payload: {
    /** 客户端时间戳 */
    clientTimestamp: string;
  };
}

/**
 * Pong事件
 */
export interface PongEvent extends WebSocketMessage {
  event: WebSocketEventType.PONG;
  payload: {
    /** 服务端时间戳 */
    serverTimestamp: string;
    /** 往返延迟(毫秒) */
    roundTripMs: number;
  };
}

// =============================================================================
// 联合类型
// Union Types
// =============================================================================

/**
 * 所有WebSocket事件类型联合
 */
export type WebSocketEvent =
  | ASRTranscriptEvent
  | ASRStatusEvent
  | ASRCompleteEvent
  | ASRErrorEvent
  | AISuggestionEvent
  | AISuggestionAcceptedEvent
  | AISuggestionDismissedEvent
  | AIInsightEvent
  | SessionStatusEvent
  | SessionStartedEvent
  | SessionCompletedEvent
  | CopilotMessageEvent
  | CopilotTypingEvent
  | RecordingStartedEvent
  | RecordingStoppedEvent
  | RecordingChunkEvent
  | PongEvent;

/**
 * 客户端发送到服务端的事件类型
 */
export type ClientToServerEvent =
  | PingEvent
  | { event: WebSocketEventType.AI_SUGGESTION_ACCEPTED; payload: { suggestionId: string } }
  | { event: WebSocketEventType.AI_SUGGESTION_DISMISSED; payload: { suggestionId: string; reason?: string } }
  | { event: WebSocketEventType.COPILOT_MESSAGE; payload: { text: string; context?: Record<string, unknown> } }
  | RecordingChunkEvent;

/**
 * 服务端发送到客户端的事件类型
 */
export type ServerToClientEvent = Exclude<WebSocketEvent, RecordingChunkEvent>;
