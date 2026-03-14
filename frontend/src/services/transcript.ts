import http from './http';

export interface TranscriptSegment {
  id: string;
  sessionId: string;
  tenantId: string;
  text: string;
  startMs: number | null;
  endMs: number | null;
  speaker: string | null;
  createdAt: string;
}

export interface CreateSegmentDto {
  text: string;
  startMs?: number;
  endMs?: number;
  speaker?: string;
}

export const transcriptApi = {
  listBySession: (sessionId: string) =>
    http.get<TranscriptSegment[]>(`/sessions/${sessionId}/transcript`),
  create: (sessionId: string, dto: CreateSegmentDto) =>
    http.post<TranscriptSegment>(`/sessions/${sessionId}/transcript`, dto),
  bulkCreate: (sessionId: string, segments: CreateSegmentDto[]) =>
    http.post<TranscriptSegment[]>(`/sessions/${sessionId}/transcript/segments`, { segments }),
};
