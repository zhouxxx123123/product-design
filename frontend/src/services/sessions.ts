import http from './http';
import { PaginatedResponse } from './users';

export type SessionStatus =
  | 'scheduled'
  | 'in_progress'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'archived';

export interface Session {
  id: string;
  title: string;
  clientId: string;
  templateId?: string;
  status: SessionStatus;
  interviewDate: string;
  description?: string;
  createdAt: string;
  interviewerId?: string;
  plannedDurationMinutes?: number;
  recordingUrl?: string;
}

export interface CreateSessionDto {
  title: string;
  clientId: string;
  templateId?: string;
  interviewDate: string;
  description?: string;
}

export type UpdateSessionDto = Partial<CreateSessionDto>;

export const sessionsApi = {
  list: (params?: { page?: number; limit?: number; search?: string; status?: SessionStatus; clientId?: string }) =>
    http.get<PaginatedResponse<Session>>('/sessions', { params }),
  get: (id: string) => http.get<Session>(`/sessions/${id}`),
  create: (dto: CreateSessionDto) => http.post<Session>('/sessions', dto),
  update: (id: string, dto: UpdateSessionDto) => http.patch<Session>(`/sessions/${id}`, dto),
  updateStatus: (id: string, status: SessionStatus) =>
    http.patch<Session>(`/sessions/${id}/status`, { status }),
  delete: (id: string) => http.delete(`/sessions/${id}`),
};
