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
  accessToken: string | null;      // memory-only, NOT persisted (short-lived)
  refreshToken: string | null;     // persisted in localStorage (long-lived, needed for page refresh)
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
        // accessToken is NOT persisted (15min expiry, memory-only)
        // refreshToken IS persisted so page refresh silently re-acquires accessToken
        refreshToken: state.refreshToken,
      }),
    },
  ),
);
