import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  displayName: string;
  email: string;
  role: 'ADMIN' | 'SALES' | 'EXPERT';
  tenantId: string;
  avatar?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;      // persisted to localStorage
  refreshToken: string | null;     // persisted to localStorage
  isLoggedIn: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoggedIn: false,
      setAuth: (user, accessToken, refreshToken) => set({ user, accessToken, refreshToken, isLoggedIn: true }),
      clearAuth: () => set({ user: null, accessToken: null, refreshToken: null, isLoggedIn: false }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isLoggedIn: state.isLoggedIn,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    },
  ),
);
