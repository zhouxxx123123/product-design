import http from './http';
import { PaginatedResponse } from './users';

export interface Contact {
  name: string;
  position?: string;
  phone?: string;
  email?: string;
}

export interface Client {
  id: string;
  companyName: string;
  industry?: string;
  size?: string;
  contacts?: Contact[];
  tags?: string[];
  status: string;
  notes?: string;
  lastInteraction?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClientDto {
  companyName: string;
  industry?: string;
  size?: string;
  contacts?: Contact[];
  tags?: string[];
  notes?: string;
  status?: string;
}

export type UpdateClientDto = Partial<CreateClientDto>;

export const clientsApi = {
  list: (params?: { page?: number; limit?: number; search?: string; industry?: string }) =>
    http.get<PaginatedResponse<Client>>('/clients', { params }),
  get: (id: string) => http.get<Client>(`/clients/${id}`),
  create: (dto: CreateClientDto) => http.post<Client>('/clients', dto),
  update: (id: string, dto: UpdateClientDto) => http.patch<Client>(`/clients/${id}`, dto),
  delete: (id: string) => http.delete(`/clients/${id}`),
};
