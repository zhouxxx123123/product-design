import http from './http';

// ── SessionInsightEntity — used by SurveyInsightsView (three-layer analysis) ──
// Backed by the `session_insights` table via GET /sessions/:id/insights

export interface Insight {
  id: string;
  sessionId: string;
  tenantId: string;
  layer: number;
  content: Record<string, unknown>;
  editedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── InsightEntity — AI-generated cross-session insights (`insights` table) ────
// NOTE: No backend endpoints expose this entity yet. These types are defined
// here for future use when a list/detail endpoint is added to the backend.

export type InsightCategory =
  | 'pain_point'
  | 'need'
  | 'opportunity'
  | 'risk'
  | 'suggestion'
  | 'insight';

export type InsightStatus = 'pending' | 'approved' | 'rejected' | 'archived';

export interface FullInsight {
  id: string;
  sessionId: string;
  tenantId: string;
  category: InsightCategory;
  content: string;
  evidence: Array<{
    transcriptSegment: string;
    timestamp: string;
    confidence: number;
  }> | null;
  confidenceScore: number | null;
  status: InsightStatus;
  metadata: Record<string, unknown>;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInsightDto {
  layer: number;
  content: Record<string, unknown>;
}

export interface UpdateInsightDto {
  content?: Record<string, unknown>;
}

export const insightsApi = {
  listBySession: (sessionId: string) =>
    http.get<Insight[]>(`/sessions/${sessionId}/insights`),
  create: (sessionId: string, dto: CreateInsightDto) =>
    http.post<Insight>(`/sessions/${sessionId}/insights`, dto),
  update: (insightId: string, dto: UpdateInsightDto) =>
    http.patch<Insight>(`/insights/${insightId}`, dto),
  extractFromSession: (sessionId: string) =>
    http.post<Insight[]>(`/sessions/${sessionId}/insights/extract?force=true`),
  delete: (insightId: string) =>
    http.delete<{ success: boolean }>(`/insights/${insightId}`),
};
