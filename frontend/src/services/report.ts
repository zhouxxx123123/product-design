import http from './http';

export type ReportJobStatus = 'pending' | 'done' | 'failed';

export interface ReportJob {
  jobId: string;
  sessionId: string;
  status: ReportJobStatus;
  createdAt: string;
}

export interface ReportJobDetail {
  id: string;
  tenantId: string;
  sessionId: string;
  status: 'pending' | 'processing' | 'done' | 'failed';
  format: string;
  filePath: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export const reportApi = {
  startExport: (sessionId: string) =>
    http.post<ReportJob>(`/sessions/${sessionId}/report/export`),

  /** Download the report blob via the shared axios instance (sends Bearer token). */
  download: (sessionId: string) =>
    http.get<Blob>(`/sessions/${sessionId}/report/download`, {
      responseType: 'blob',
    }),

  pollJobStatus: (jobId: string) =>
    http.get<ReportJobDetail>(`/report-jobs/${jobId}`),

  listJobs: (sessionId?: string) =>
    http.get<ReportJobDetail[]>('/report-jobs', {
      params: sessionId ? { sessionId } : undefined,
    }),
};
