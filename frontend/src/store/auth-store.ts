'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type UserRole =
  | 'SUPER_ADMIN'
  | 'ACADEMY_ADMIN'
  | 'INSTRUCTOR'
  | 'RECEPTIONIST'
  | 'ACCOUNTANT'
  | 'PARENT'
  | 'STUDENT';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  academyId: string | null;
  permissions?: string[];
  branchId?: string | null;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  setUser: (user: AuthUser) => void;
  setTokens: (tokens: AuthTokens) => void;
  setSession: (payload: { user: AuthUser } & AuthTokens) => void;
  clear: () => void;
  hasRole: (roles: UserRole | UserRole[]) => boolean;
  hasPermission: (permission: string) => boolean;
  markHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      hydrated: false,
      setUser: (user) => set({ user }),
      setTokens: ({ accessToken, refreshToken }) => set({ accessToken, refreshToken }),
      setSession: ({ user, accessToken, refreshToken }) =>
        set({ user, accessToken, refreshToken }),
      clear: () => set({ user: null, accessToken: null, refreshToken: null }),
      hasRole: (roles) => {
        const user = get().user;
        if (!user) return false;
        const list = Array.isArray(roles) ? roles : [roles];
        return list.includes(user.role);
      },
      hasPermission: (permission) => {
        const user = get().user;
        if (!user) return false;
        if (user.role === 'SUPER_ADMIN') return true;
        return (user.permissions ?? []).includes(permission);
      },
      markHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'tskk.auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ user: s.user, accessToken: s.accessToken, refreshToken: s.refreshToken }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    },
  ),
);
