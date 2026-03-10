/**
 * WebSocket event types for real-time interview coordination.
 *
 * Architecture notes:
 * - Events flow in two directions: CLIENT → SERVER (commands) and
 *   SERVER → CLIENT (notifications). Each direction is typed separately.
 * - Every event carries a `sessionId` so the handler can route it
 *   to the correct session room without additional context.
 * - All timestamps are ISO 8601 strings for JSON transport.
 * - Use the `EventEnvelope<T>` wrapper when transmitting over the wire
 *   to include tracing metadata without polluting payload types.
 */

// ---------------------------------------------------------------------------
// Generic envelope
// ---------------------------------------------------------------------------

/**
 * Wire-level envelope wrapping any event payload.
 * The `event` field is the discriminant used by socket.io / ws handlers.
 */
export interface EventEnvelope<TPayload> {
  /** Event name / discriminant. */
  event: string;
  /** ISO timestamp of when this event was emitted. */
  timestamp: string;
  /** Optional correlation ID for distributed tracing. */
  traceId?: string;
  data: TPayload;
}

// ---------------------------------------------------------------------------
// Event name constants
// ---------------------------------------------------------------------------

/** Canonical event name strings. Import and use to avoid magic strings. */
export const WS_EVENTS = {
  // Client → Server
  JOIN_SESSION:           'session:join',
  LEAVE_SESSION:          'session:leave',
  ACCEPT_SUGGESTION:      'suggestion:accept',
  REJECT_SUGGESTION:      'suggestion:reject',

  // Server → Client
  TRANSCRIPTION_CHUNK:    'transcription:chunk',
  TRANSCRIPTION_FINAL:    'transcription:final',
  AI_SUGGESTION_READY:    'ai:suggestion_ready',
  RECORDING_STATUS:       'recording:status',
  SESSION_STATUS_CHANGED: 'session:status_changed',
  ERROR:                  'error',
} as const;

export type WsEventName = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];

// ---------------------------------------------------------------------------
// Client → Server commands
// ---------------------------------------------------------------------------

/** Emitted by the client to subscribe to a session's real-time events. */
export interface JoinSessionCommand {
  sessionId: string;
  /** Auth token for server-side authorisation inside the socket handshake. */
  token: string;
}

/** Emitted by the client to unsubscribe from a session. */
export interface LeaveSessionCommand {
  sessionId: string;
}

/** Client acknowledges and accepts an AI-generated suggestion. */
export interface AcceptSuggestionCommand {
  sessionId: string;
  suggestionId: string;
}

/** Client explicitly rejects an AI-generated suggestion. */
export interface RejectSuggestionCommand {
  sessionId: string;
  suggestionId: string;
  /** Optional free-text reason to feed back into AI quality loop. */
  reason?: string;
}

// ---------------------------------------------------------------------------
// Server → Client notifications
// ---------------------------------------------------------------------------

/**
 * Emitted by the server as Tencent ASR returns partial results.
 * Clients should render these incrementally and treat them as mutable
 * until a `TranscriptionFinal` event arrives for the same `chunkIndex`.
 */
export interface TranscriptionChunk {
  sessionId: string;
  recordingId: string;
  /** Sequential index of this chunk within the current recording. */
  chunkIndex: number;
  /** Partial transcript text for this chunk (may be revised). */
  text: string;
  /** Offset from recording start, in milliseconds. */
  startMs: number;
  endMs: number;
  /** Speaker diarisation label when available. */
  speaker?: string;
  /** Whether the ASR engine considers this chunk stable (final). */
  isFinal: boolean;
  /** ASR confidence score, 0–1. */
  confidence?: number;
}

/**
 * Emitted once ASR has produced a stable, final segment.
 * Clients should replace any pending chunk for the same `chunkIndex`.
 */
export interface TranscriptionFinal {
  sessionId: string;
  recordingId: string;
  chunkIndex: number;
  text: string;
  startMs: number;
  endMs: number;
  speaker?: string;
  confidence?: number;
}

/**
 * Emitted when the AI (Kimi-k2.5) has generated a follow-up question
 * suggestion based on the live transcript context.
 */
export interface AiSuggestionReady {
  sessionId: string;
  /** Stable ID to use when accepting/rejecting. */
  suggestionId: string;
  departmentId?: string;
  /** The question that triggered this suggestion, if applicable. */
  triggerQuestionId?: string;
  /** The AI-generated follow-up question text. */
  suggestedQuestion: string;
  /** AI rationale (shown to expert users, hidden from clients). */
  rationale?: string;
  /** ISO timestamp when this suggestion was generated. */
  generatedAt: string;
  /**
   * Seconds until this suggestion expires and should be hidden from the UI
   * (prevents stale suggestions from persisting across topic changes).
   */
  expiresInSeconds?: number;
}

/** Status transitions and metadata for an active recording. */
export type RecordingStatusPayload =
  | {
      kind: 'STARTED';
      sessionId: string;
      recordingId: string;
      startedAt: string;
      mimeType: string;
    }
  | {
      kind: 'PAUSED';
      sessionId: string;
      recordingId: string;
      pausedAt: string;
      elapsedSeconds: number;
    }
  | {
      kind: 'RESUMED';
      sessionId: string;
      recordingId: string;
      resumedAt: string;
    }
  | {
      kind: 'STOPPED';
      sessionId: string;
      recordingId: string;
      stoppedAt: string;
      durationSeconds: number;
    }
  | {
      kind: 'PROCESSING';
      sessionId: string;
      recordingId: string;
      /** Estimated processing completion time, if known. */
      estimatedReadyAt?: string;
    }
  | {
      kind: 'READY';
      sessionId: string;
      recordingId: string;
      storageUrl: string;
      durationSeconds: number;
    }
  | {
      kind: 'FAILED';
      sessionId: string;
      recordingId: string;
      errorCode: string;
      errorMessage: string;
    };

/**
 * Emitted whenever a session transitions to a new lifecycle status.
 * Clients should update their local session state accordingly.
 */
export interface SessionStatusChanged {
  sessionId: string;
  previousStatus: string;
  newStatus: string;
  /** User who triggered the status change. */
  changedBy: string;
  changedAt: string;
}

/**
 * Server-side error scoped to a specific session.
 * Distinct from HTTP errors — delivered over the socket for real-time ops.
 */
export interface WsError {
  sessionId?: string;
  /** Machine-readable error code. */
  code: string;
  message: string;
  /** The originating event name, if applicable. */
  originEvent?: string;
}

// ---------------------------------------------------------------------------
// Typed socket event map (compatible with socket.io typed emitters)
// ---------------------------------------------------------------------------

/**
 * Maps event names to their payload types for Server → Client events.
 * Use with socket.io's `ServerToClientEvents` generic slot.
 *
 * @example
 * ```ts
 * const socket: Socket<ServerToClientEvents> = io(url);
 * socket.on('transcription:chunk', (chunk) => { ... });
 * ```
 */
export interface ServerToClientEvents {
  [WS_EVENTS.TRANSCRIPTION_CHUNK]:    (payload: TranscriptionChunk) => void;
  [WS_EVENTS.TRANSCRIPTION_FINAL]:    (payload: TranscriptionFinal) => void;
  [WS_EVENTS.AI_SUGGESTION_READY]:    (payload: AiSuggestionReady) => void;
  [WS_EVENTS.RECORDING_STATUS]:       (payload: RecordingStatusPayload) => void;
  [WS_EVENTS.SESSION_STATUS_CHANGED]: (payload: SessionStatusChanged) => void;
  [WS_EVENTS.ERROR]:                  (payload: WsError) => void;
}

/**
 * Maps event names to their payload types for Client → Server events.
 * Use with socket.io's `ClientToServerEvents` generic slot.
 *
 * @example
 * ```ts
 * const io = new Server<ClientToServerEvents, ServerToClientEvents>();
 * io.on('connection', (socket) => {
 *   socket.on('session:join', (cmd) => { ... });
 * });
 * ```
 */
export interface ClientToServerEvents {
  [WS_EVENTS.JOIN_SESSION]:      (cmd: JoinSessionCommand) => void;
  [WS_EVENTS.LEAVE_SESSION]:     (cmd: LeaveSessionCommand) => void;
  [WS_EVENTS.ACCEPT_SUGGESTION]: (cmd: AcceptSuggestionCommand) => void;
  [WS_EVENTS.REJECT_SUGGESTION]: (cmd: RejectSuggestionCommand) => void;
}
