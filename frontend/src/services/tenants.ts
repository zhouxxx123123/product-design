import http from './http';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  aiConfig: {
    provider: string;
    model: string;
    temperature: number;
    topP?: number;
    maxTokens?: number;
  };
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface TenantMember {
  id: string;
  tenantId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joinedAt: string;
}

export interface CreateTenantDto {
  name: string;
  slug: string;
  aiConfig?: Tenant['aiConfig'];
  settings?: Record<string, unknown>;
}

export interface UpdateTenantDto {
  name?: string;
  aiConfig?: Tenant['aiConfig'];
  settings?: Record<string, unknown>;
}

export interface AddMemberDto {
  userId: string;
  role: TenantMember['role'];
}

export interface PaginatedTenants {
  data: Tenant[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const tenantsApi = {
  list: (params?: { page?: number; limit?: number; search?: string }) =>
    http.get<PaginatedTenants>('/tenants', { params }),

  get: (id: string) =>
    http.get<Tenant>(`/tenants/${id}`),

  create: (dto: CreateTenantDto) =>
    http.post<Tenant>('/tenants', dto),

  update: (id: string, dto: UpdateTenantDto) =>
    http.patch<Tenant>(`/tenants/${id}`, dto),

  delete: (id: string) =>
    http.delete<{ success: boolean }>(`/tenants/${id}`),

  listMembers: (tenantId: string) =>
    http.get<TenantMember[]>(`/tenants/${tenantId}/members`),

  addMember: (tenantId: string, dto: AddMemberDto) =>
    http.post<TenantMember>(`/tenants/${tenantId}/members`, dto),

  removeMember: (tenantId: string, userId: string) =>
    http.delete<{ success: boolean }>(`/tenants/${tenantId}/members/${userId}`),

  updateMemberRole: (tenantId: string, userId: string, role: TenantMember['role']) =>
    http.patch<TenantMember>(`/tenants/${tenantId}/members/${userId}/role`, { role }),
};