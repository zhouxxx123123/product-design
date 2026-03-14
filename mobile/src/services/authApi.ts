import httpClient from './http';
import { AuthUser } from '../stores/authStore';

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export const authApi = {
  login: (email: string, password: string): Promise<LoginResponse> =>
    httpClient
      .post<LoginResponse>('/auth/login', { email, password })
      .then((r) => r.data),

  refresh: (refreshToken: string): Promise<LoginResponse> =>
    httpClient
      .post<LoginResponse>('/auth/refresh', { refreshToken })
      .then((r) => r.data),

  logout: (): Promise<void> =>
    httpClient.post('/auth/logout').then(() => undefined),
};
