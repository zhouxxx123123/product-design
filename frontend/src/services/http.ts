import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const http = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
});

// Request interceptor: attach access token
http.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401 → try refresh → retry
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
};

http.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return http(original);
        });
      }
      original._retry = true;
      isRefreshing = true;
      const { refreshToken, setAuth, clearAuth, user } = useAuthStore.getState();
      try {
        const res = await axios.post('/api/v1/auth/refresh', { refreshToken });
        const { accessToken: newToken, refreshToken: newRefresh } = res.data;
        if (!user) throw new Error('user missing from store during token refresh');
        setAuth(user, newToken, newRefresh);
        processQueue(null, newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return http(original);
      } catch (err) {
        processQueue(err);
        clearAuth();
        window.location.href = '/login';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);

export default http;
