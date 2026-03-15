import http from './http';

export interface User {
  id: string;
  displayName: string;
  email: string;
  role: string;
  isActive: boolean;
  tenantId: string;
  createdAt: string;
  avatarUrl?: string;
}

export interface CreateUserDto {
  displayName: string;
  email: string;
  role: 'sales' | 'expert' | 'admin';
  password: string;
}

export interface UpdateUserDto {
  displayName?: string;
  role?: 'sales' | 'expert' | 'admin';
  isActive?: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const usersApi = {
  list: (params?: { page?: number; limit?: number; search?: string }) =>
    http.get<PaginatedResponse<User>>('/users', { params }),
  get: (id: string) => http.get<User>(`/users/${id}`),
  me: () => http.get<User>('/users/me'),
  create: (dto: CreateUserDto) => http.post<User>('/users', dto),
  update: (id: string, dto: UpdateUserDto) => http.patch<User>(`/users/${id}`, dto),
  delete: (id: string) => http.delete(`/users/${id}`),
};
