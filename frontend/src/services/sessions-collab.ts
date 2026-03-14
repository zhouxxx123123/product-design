import http from './http';

export interface SessionComment {
  id: string;
  sessionId: string;
  authorId: string;
  tenantId: string;
  content: string;
  targetType: string | null;
  targetId: string | null;
  createdAt: string;
}

export interface SessionCaseLink {
  id: string;
  sessionId: string;
  caseId: string;
  tenantId: string;
  reason: string | null;
  addedBy: string;
  createdAt: string;
}

export const sessionCollabApi = {
  // Comments
  listComments: (sessionId: string) =>
    http.get<SessionComment[]>(`/sessions/${sessionId}/comments`),
  addComment: (sessionId: string, body: { content: string; targetType?: string; targetId?: string }) =>
    http.post<SessionComment>(`/sessions/${sessionId}/comments`, body),

  // Case links
  listCaseLinks: (sessionId: string) =>
    http.get<SessionCaseLink[]>(`/sessions/${sessionId}/cases`),
  addCaseLink: (sessionId: string, body: { caseId: string; reason?: string }) =>
    http.post<SessionCaseLink>(`/sessions/${sessionId}/cases`, body),
};
