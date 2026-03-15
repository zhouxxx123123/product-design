import http from './http';
import { PaginatedResponse } from './users';

export type MemoryType = 'preference' | 'learning' | 'conversation' | 'setting';

export interface Memory {
  id: string;
  userId: string;
  tenantId: string;
  content: string;
  type: MemoryType;
  source: string | null;
  createdAt: string;
}

export const memoriesApi = {
  list: (params?: { page?: number; limit?: number; search?: string; type?: MemoryType }) =>
    http.get<PaginatedResponse<Memory>>('/memories', { params }),
  deleteOne: (id: string) => http.delete<{ success: boolean }>(`/memories/${id}`),
  deleteAll: () => http.delete<{ success: boolean }>('/memories?confirm=true'),
  export: () => http.get<Memory[]>('/memories/export'),
};
