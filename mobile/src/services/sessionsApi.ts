import httpClient from './http';
import { SessionStatus } from '@shared/types/enums';

export interface Session {
  id: string;
  title: string;
  status: SessionStatus;
  clientName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionsListResponse {
  data: Session[];
  total: number;
  page: number;
  limit: number;
}

interface ListParams {
  page?: number;
  limit?: number;
  status?: string;
}

export const sessionsApi = {
  list: (params?: ListParams): Promise<SessionsListResponse> =>
    httpClient
      .get<SessionsListResponse>('/sessions', { params })
      .then((r) => r.data),

  update: (id: string, dto: { title?: string }): Promise<Session> =>
    httpClient
      .patch<Session>(`/sessions/${id}`, dto)
      .then((r) => r.data),

  updateStatus: (id: string, status: string): Promise<Session> =>
    httpClient
      .patch<Session>(`/sessions/${id}/status`, { status })
      .then((r) => r.data),
};
