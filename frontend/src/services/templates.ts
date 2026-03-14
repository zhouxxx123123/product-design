import http from './http';
import { PaginatedResponse } from './users';

export interface TemplateSection {
  title: string;
  questions: Array<{
    text: string;
    type?: string;
    required?: boolean;
    hint?: string;
  }>;
}

export interface Template {
  id: string;
  title: string;
  category?: string;
  templateType?: string;
  sections?: TemplateSection[];
  createdAt: string;
  isDefault?: boolean;
  duration?: number;
}

export interface CreateTemplateDto {
  title: string;
  category?: string;
  sections?: TemplateSection[];
  duration?: number;
}

export type UpdateTemplateDto = Partial<CreateTemplateDto>;

export const templatesApi = {
  list: (params?: { page?: number; limit?: number; search?: string; templateType?: string; category?: string }) =>
    http.get<PaginatedResponse<Template>>('/templates', { params }),
  get: (id: string) => http.get<Template>(`/templates/${id}`),
  create: (dto: CreateTemplateDto) => http.post<Template>('/templates', dto),
  update: (id: string, dto: UpdateTemplateDto) => http.patch<Template>(`/templates/${id}`, dto),
  delete: (id: string) => http.delete(`/templates/${id}`),
  duplicate: (id: string) => http.post<Template>(`/templates/${id}/duplicate`),
  setDefault: (id: string) => http.patch<Template>(`/templates/${id}/default`),
};
