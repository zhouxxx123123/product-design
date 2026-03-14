import httpClient from './http';

export interface TranscriptSegmentInput {
  text: string;
  startMs?: number;
  endMs?: number;
  speaker?: string;
}

export interface TranscriptSegment {
  id: string;
  text: string;
  startMs: number | null;
  endMs: number | null;
  speaker: string | null;
  sessionId: string;
  createdAt: string;
}

export const transcriptApi = {
  bulkCreate: (
    sessionId: string,
    segments: TranscriptSegmentInput[],
  ): Promise<TranscriptSegment[]> =>
    httpClient
      .post<TranscriptSegment[]>(`/sessions/${sessionId}/transcript/segments`, { segments })
      .then((r) => r.data),
};
