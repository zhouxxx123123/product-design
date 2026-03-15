import http from './http';

export interface Permission {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  createdAt: string;
}

export interface PermissionsResponse {
  data: Permission[];
  categories: string[];
}

export const permissionsApi = {
  list: () => http.get<PermissionsResponse>('/permissions'),
  byRole: (role: 'admin' | 'sales' | 'expert') =>
    http.get<string[]>(`/permissions/by-role/${role}`),
};