'use client';

import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import {
  ACCOUNT_TYPE_CONFIG,
  resolveAccountTypeFromMetadata,
  type AccountType,
} from '../../lib/accountTypes';
import { classifyOnboardingLifecycleStatus } from '../../lib/accessLifecycle';
import { RESET_PASSWORD_PATH, getResetPasswordEmailRedirectTo } from '../../lib/authFlow';
import {
  type AuthFailureReason,
  type AuthResolutionResult,
  type ResolvedAuthUser,
  type SessionUser,
  type UserRole,
  getPostLoginRoute,
  resolveAuthenticatedUser,
} from '../../lib/authSession';
import { clearRouteAuthCookie, writeRouteAuthCookie } from '../../lib/routeAuthCookie';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';

const LOGIN_TIMEOUT_MS = 45_000;
const LOGIN_BOOTSTRAP_RETRY_DELAY_MS = 1_500;
const LOGIN_UNAVAILABLE_ERROR = 'Login service unavailable. Please try again.';
const RESET_PASSWORD_COOLDOWN_MS = 60_000;
const RESET_PASSWORD_COOLDOWN_KEY = 'xdrive:last-password-reset-request-at';

class LoginTimeoutError extends Error {
  constructor() {
    super('Login request timed out');
    this.name = 'LoginTimeoutError';
  }
}

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new LoginTimeoutError()), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
};

const isServiceUnavailableError = (error: unknown): boolean => {
  if (error instanceof LoginTimeoutError) return true;
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return ['failed to fetch', 'network', 'timeout', 'timed out', 'fetch'].some((value) => message.includes(value));
};

type OnboardingAccessPayload = {
  error?: string;
  status?: string;
  accountType?: AccountType;
  onboardingPath?: string;
  resumeAllowed?: boolean;
};

const routeFromOnboardingPayload = (payload: OnboardingAccessPayload | null): string | null => {
  const lifecycle = classifyOnboardingLifecycleStatus(payload?.status);
  if (lifecycle === 'approved') return null;
  if (lifecycle === 'review') return '/pending-approval';
  if (lifecycle === 'rejected') return '/forbidden?reason=onboarding-rejected';
  if (lifecycle === 'editable') {
    if (payload?.onboardingPath?.startsWith('/onboarding/')) return payload.onboardingPath;
    if (payload?.accountType) return ACCOUNT_TYPE_CONFIG[payload.accountType].onboardingPath;
    return '/onboarding/resume';
  }
  if (payload?.status) throw new Error(`Unsupported onboarding status: ${payload.status}`);
  return null;
};

const resolveOnboardingLoginRoute = async (
  accessToken: string,
  sessionUser: SessionUser
): Promise<string | null> => {
  let response = await withTimeout(
    fetch('/api/onboarding/init', {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    }),
    LOGIN_TIMEOUT_MS
  );

  if (response.status === 404) {
    const accountType = resolveAccountTypeFromMetadata(sessionUser.user_metadata, sessionUser.app_metadata);
    if (!accountType) return null;

    response = await withTimeout(
      fetch('/api/onboarding/init', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_type: accountType,
          forceRegenerateToken: false,
        }),
      }),
      LOGIN_TIMEOUT_MS
    );
  }

  const payload = (await response.json().catch(() => null)) as OnboardingAccessPayload | null;
  if (!response.ok) throw new Error(payload?.error ?? 'Unable to validate onboarding progress.');
  return routeFromOnboardingPayload(payload);
};

const authFailureReasonToMessage = (
  reason: AuthFailureReason | null,
  dbError?: { message: string; code: string | null; query: string } | null
): string => {
  switch (reason) {
    case 'account_pending':
      return 'Your account is pending approval.';
    case 'account_blocked':
      return 'Your account is suspended or inactive. Please contact support.';
    case 'role_unsupported':
      return 'Your account role is not supported. Please contact support.';
    case 'profile_missing':
      return 'Your account setup is incomplete. Please contact support.';
    case 'company_context_missing':
      return 'Your account is not linked to its workspace. Please contact support.';
    case 'db_error':
      if (dbError?.message) {
        const codeSuffix = dbError.code ? ` [${dbError.code}]` : '';
        return `Account validation failed${codeSuffix}: ${dbError.message}`;
      }
      return 'Unable to validate account access. Please try again.';
    default:
      return 'Unable to validate account access. Please try again.';
  }
};

interface AuthContextType {
  user: ResolvedAuthUser | null;
  login: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string; route?: ReturnType<typeof getPostLoginRoute> }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
  hasSupabaseSession: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ResolvedAuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasSupabaseSession, setHasSupabaseSession] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const loginHydrating = useRef(false);
  const userRef = useRef<ResolvedAuthUser | null>(null);
  const hasSupabaseSessionRef = useRef(false);
  const hydrationRef = useRef<{ userId: string; promise: Promise<AuthResolutionResult> } | null>(null);

  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { hasSupabaseSessionRef.current = hasSupabaseSession; }, [hasSupabaseSession]);

  const syncRouteAuthCookie = useCallback((session: Pick<Session, 'access_token' | 'expires_at'> | null | undefined) => {
    writeRouteAuthCookie(session);
  }, []);

  const resetAuthState = useCallback(() => {
    setUser(null);
    setHasSupabaseSession(false);
    clearRouteAuthCookie();
  }, []);

  const setPasswordSetupSessionState = useCallback(() => {
    setUser(null);
    setHasSupabaseSession(true);
  }, []);

  const isPasswordSetupContext = useCallback((event?: string) => {
    if (pathnameRef.current === RESET_PASSWORD_PATH) return true;
    return event === 'PASSWORD_RECOVERY';
  }, []);

  const hydrateUser = useCallback(async (sessionUser: SessionUser): Promise<AuthResolutionResult> => {
    const existing = userRef.current;
    if (existing?.id === sessionUser.id) return { user: existing, reason: null };
    if (hydrationRef.current?.userId === sessionUser.id) return hydrationRef.current.promise;

    const promise = (async () => {
      const result = await withTimeout(resolveAuthenticatedUser(sessionUser), LOGIN_TIMEOUT_MS);
      setUser(result.user);
      setHasSupabaseSession(true);
      return result;
    })();

    hydrationRef.current = { userId: sessionUser.id, promise };
    try {
      return await promise;
    } finally {
      if (hydrationRef.current?.promise === promise) hydrationRef.current = null;
    }
  }, []);

  const routePendingAccount = useCallback(() => {
    setUser(null);
    setHasSupabaseSession(true);
    if (pathnameRef.current !== '/pending-approval') router.replace('/pending-approval');
  }, [router]);

  const resolveSession = useCallback(async (session: Session): Promise<AuthResolutionResult | null> => {
    const onboardingRoute = await resolveOnboardingLoginRoute(session.access_token, session.user);
    if (onboardingRoute) {
      setUser(null);
      setHasSupabaseSession(true);
      if (pathnameRef.current !== onboardingRoute) router.replace(onboardingRoute);
      return null;
    }

    const result = await hydrateUser(session.user);
    if (!result.user && result.reason === 'account_pending') {
      routePendingAccount();
      return null;
    }
    return result;
  }, [hydrateUser, routePendingAccount, router]);

  useEffect(() => {
    let isMounted = true;
    if (!isSupabaseConfigured) {
      resetAuthState();
      setIsLoading(false);
      return;
    }

    const bootstrapAuth = async () => {
      try {
        let lastError: unknown = null;
        let session: Session | null = null;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            const result = await withTimeout(supabase.auth.getSession(), LOGIN_TIMEOUT_MS);
            if (result.error) throw result.error;
            session = result.data.session;
            break;
          } catch (error) {
            lastError = error;
            if (!(isServiceUnavailableError(error) && attempt === 0 && !isPasswordSetupContext())) throw error;
            await new Promise((resolve) => setTimeout(resolve, LOGIN_BOOTSTRAP_RETRY_DELAY_MS));
          }
        }
        if (!session && lastError) throw lastError;

        if (session?.user) {
          syncRouteAuthCookie(session);
          if (isPasswordSetupContext()) setPasswordSetupSessionState();
          else await resolveSession(session);
        } else {
          resetAuthState();
        }
      } catch (error) {
        console.error('AuthContext bootstrap failed', error);
        if (!isPasswordSetupContext()) {
          if (isServiceUnavailableError(error) && (userRef.current || hasSupabaseSessionRef.current)) {
            setHasSupabaseSession(true);
          } else {
            resetAuthState();
          }
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void bootstrapAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      syncRouteAuthCookie(session);
      if (event === 'TOKEN_REFRESHED' && userRef.current) return;
      try {
        if (session?.user) {
          if (isPasswordSetupContext(event)) setPasswordSetupSessionState();
          else if (!loginHydrating.current) await resolveSession(session);
        } else if (!isPasswordSetupContext(event)) {
          resetAuthState();
        }
      } catch (error) {
        console.error('AuthContext auth state handling failed', error);
        if (session?.user && isServiceUnavailableError(error)) setHasSupabaseSession(true);
        else if (!isPasswordSetupContext(event)) resetAuthState();
      } finally {
        if (isMounted) setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [isPasswordSetupContext, resetAuthState, resolveSession, setPasswordSetupSessionState, syncRouteAuthCookie]);

  const login = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string; route?: ReturnType<typeof getPostLoginRoute> }> => {
    loginHydrating.current = true;
    try {
      if (!isSupabaseConfigured) return { success: false, error: LOGIN_UNAVAILABLE_ERROR };

      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password }),
        LOGIN_TIMEOUT_MS
      );

      if (error) {
        const authError = error as typeof error & { code?: string; status?: number };
        const message = error.message.toLowerCase();
        if (authError.code === 'invalid_credentials' || message.includes('invalid login credentials')) {
          return { success: false, error: 'Invalid email or password.' };
        }
        if (authError.code === 'user_banned') {
          return { success: false, error: 'This authentication account is banned. Please contact support.' };
        }
        if (authError.status === 429) {
          return { success: false, error: 'Too many login attempts. Please wait and try again.' };
        }
        return { success: false, error: error.message };
      }

      if (!data.user || !data.session?.access_token) return { success: false, error: 'Login failed.' };
      syncRouteAuthCookie(data.session);

      const onboardingRoute = await resolveOnboardingLoginRoute(data.session.access_token, data.user);
      if (onboardingRoute) {
        setUser(null);
        setHasSupabaseSession(true);
        router.replace(onboardingRoute);
        return { success: true, route: onboardingRoute };
      }

      const result = await hydrateUser(data.user);
      if (!result.user) {
        if (result.reason === 'account_pending') {
          routePendingAccount();
          return { success: true, route: '/pending-approval' };
        }
        if (result.reason === 'db_error') {
          console.error('[XDrive Auth] account validation db_error', result.dbError);
        }
        return {
          success: false,
          error: authFailureReasonToMessage(result.reason, result.reason === 'db_error' ? result.dbError : null),
        };
      }

      return { success: true, route: getPostLoginRoute(result.user) };
    } catch (error) {
      console.error('Login error:', error);
      if (isServiceUnavailableError(error)) return { success: false, error: LOGIN_UNAVAILABLE_ERROR };
      return { success: false, error: error instanceof Error ? error.message : 'An error occurred during login.' };
    } finally {
      loginHydrating.current = false;
    }
  };

  const resetPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Authentication is unavailable: Supabase is not configured.' };
    }

    try {
      if (typeof window !== 'undefined') {
        const lastRequestAtRaw = window.sessionStorage.getItem(RESET_PASSWORD_COOLDOWN_KEY);
        const lastRequestAt = lastRequestAtRaw ? Number(lastRequestAtRaw) : 0;
        const elapsed = Date.now() - lastRequestAt;
        if (Number.isFinite(lastRequestAt) && elapsed >= 0 && elapsed < RESET_PASSWORD_COOLDOWN_MS) {
          const remainingSeconds = Math.ceil((RESET_PASSWORD_COOLDOWN_MS - elapsed) / 1000);
          return { success: false, error: `Please wait ${remainingSeconds}s before requesting another reset email.` };
        }
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getResetPasswordEmailRedirectTo(),
      });
      if (error) return { success: false, error: error.message };
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(RESET_PASSWORD_COOLDOWN_KEY, String(Date.now()));
      }
      return { success: true };
    } catch (error) {
      console.error('Reset password error:', error);
      return { success: false, error: 'An error occurred. Please try again.' };
    }
  };

  const logout = async () => {
    if (isSupabaseConfigured) await supabase.auth.signOut();
    resetAuthState();
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, resetPassword, isLoading, hasSupabaseSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

export type { UserRole };
