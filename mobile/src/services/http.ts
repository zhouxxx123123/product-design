import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../stores/authStore';

const BASE_URL = 'http://10.0.2.2:3000/api';

const httpClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach Bearer token to every outgoing request
httpClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return config;
});

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    displayName: string;
    email: string;
    role: 'admin' | 'sales' | 'expert';
    tenantId: string | null;
  };
}

// Track whether a token refresh is already in flight to avoid race conditions
let isRefreshing = false;
let pendingQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function drainQueue(newToken: string | null, error: unknown): void {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (newToken) {
      resolve(newToken);
    } else {
      reject(error);
    }
  });
  pendingQueue = [];
}

httpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    const { refreshToken, setAuth, clearAuth } = useAuthStore.getState();

    if (!refreshToken) {
      clearAuth();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Queue this request until the ongoing refresh completes
      return new Promise((resolve, reject) => {
        pendingQueue.push({
          resolve: (token) => {
            originalRequest.headers.set('Authorization', `Bearer ${token}`);
            resolve(httpClient(originalRequest));
          },
          reject,
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post<RefreshResponse>(`${BASE_URL}/auth/refresh`, {
        refreshToken,
      });

      setAuth(data.user, data.accessToken, data.refreshToken);
      drainQueue(data.accessToken, null);

      originalRequest.headers.set('Authorization', `Bearer ${data.accessToken}`);
      return httpClient(originalRequest);
    } catch (refreshError) {
      drainQueue(null, refreshError);
      clearAuth();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default httpClient;
