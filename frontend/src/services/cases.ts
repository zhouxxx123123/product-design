import http from './http';
import { PaginatedResponse } from './users';

export type CaseType = 'project' | 'research' | 'insight' | 'template';
export type CaseStatus = 'draft' | 'published' | 'archived';

export interface Case {
  id: string;
  tenantId: string;
  createdBy: string | null;
  title: string;
  industry: string | null;
  caseType: CaseType;
  content: string;
  summary: string | null;
  tags: string[] | null;
  status: CaseStatus;
  isPublic: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SimilarCase extends Case {
  similarity: number; // cosine similarity score (0–1, higher is more similar)
}

export interface CreateCaseDto {
  title: string;
  industry?: string;
  caseType?: CaseType;
  content: string;
  summary?: string;
  tags?: string[];
  isPublic?: boolean;
}

export type UpdateCaseDto = Partial<CreateCaseDto>;

export const casesApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    industry?: string;
    tags?: string;
  }) => http.get<PaginatedResponse<Case>>('/cases', { params }),
  get: (id: string) => http.get<Case>(`/cases/${id}`),
  create: (dto: CreateCaseDto) => http.post<Case>('/cases', dto),
  update: (id: string, dto: UpdateCaseDto) => http.patch<Case>(`/cases/${id}`, dto),
  delete: (id: string) => http.delete(`/cases/${id}`),
  similar: (params: { text: string; limit?: number }) =>
    http.get<{ data: SimilarCase[]; total: number }>('/cases/similar', { params }),
};
