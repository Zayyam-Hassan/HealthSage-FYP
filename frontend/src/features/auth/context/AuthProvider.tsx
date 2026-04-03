import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { router } from 'expo-router';
import { authService, type AuthUser, type UserRole } from '@/services/auth';
import { setAuthExpiredHandler } from '@/services/api';
import { registerCurrentDevice } from '@/src/shared/services/notificationService';

export type AuthContextValue = {
  user: AuthUser | null;
  role: UserRole | null;
  isLoading: boolean;
  refreshUser: () => Promise<AuthUser | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const handlingExpiredSessionRef = useRef(false);

  const refreshUser = useCallback(async () => {
    const u = await authService.getCurrentUser();
    setUser(u);
    return u;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const u = await authService.validateStoredSession();
        if (!cancelled) setUser(u);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    void registerCurrentDevice(user.id).catch(() => undefined);
  }, [user?.id]);

  useEffect(() => {
    setAuthExpiredHandler(async () => {
      if (handlingExpiredSessionRef.current) {
        return;
      }

      handlingExpiredSessionRef.current = true;
      try {
        await authService.logout();
        setUser(null);
        router.replace('/(auth)/login');
      } finally {
        handlingExpiredSessionRef.current = false;
      }
    });

    return () => {
      setAuthExpiredHandler(null);
    };
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
    router.replace('/(auth)/login');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role: user?.role ?? null,
      isLoading,
      refreshUser,
      logout,
    }),
    [user, isLoading, refreshUser, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
