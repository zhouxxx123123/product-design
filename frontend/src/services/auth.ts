import http from './http';

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  role: string;   // lowercase: 'admin'|'sales'|'expert'
  isActive: boolean;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export const authApi = {
  login: (dto: LoginDto) => http.post<AuthResponse>('/auth/login', dto),
  refresh: (refreshToken: string) => http.post<RefreshResponse>('/auth/refresh', { refreshToken }),
  logout: () => http.post('/auth/logout'),
  me: () => http.get<AuthUser>('/auth/me'),
};
