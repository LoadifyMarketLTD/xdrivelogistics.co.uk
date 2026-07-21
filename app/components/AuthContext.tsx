'use client';

import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  RESET_PASSWORD_PATH,
  getResetPasswordEmailRedirectTo,
} from '../../lib/authFlow';
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
  return (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('fetch')
  );
};

type OnboardingAccessPayload = {
  error?: string;
  status?: string;
  accountType?: 'customer_shipper' | 'broker_shipper' | 'fleet_courier' | 'owner_driver';
  resumeAllowed?: boolean;
  invitationRevoked?: boolean;
};

const resolveOnboardingLoginRoute = async (accessToken: string): Promise<string | null> => {
  const response = await withTimeout(
    fetch('/api/onboarding/init', {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    }),
    LOGIN_TIMEOUT_MS
  );

  if (response.status === 404) return null;

  const payload = (await response.json().catch(() => null)) as OnboardingAccessPayload | null;
  if (!response.ok) {
    throw new Error(payload?.error ?? 'Unable to validate onboarding progress.');
  }

  const status = String(payload?.status ?? '').trim().toLowerCase();
  if (status === 'approved') return null;
  if (status === 'rejected') return '/forbidden?reason=onboarding-rejected';
  if (
    status === 'under_review' ||
    status === 'submitted' ||
    status === 'compliance_review' ||
    status === 'admin_approval'
  ) {
    return '/pending-approval';
  }

  return '/onboarding/resume';
};

/** Convert a structured failure reason into a user-facing message. */
const authFailureReasonToMessage = (
  reason: AuthFailureReason | null,
  dbError?: { message: string; code: string | null; query: string } | null
): string => {
  switch (reason) {
    case 'account_pending':
      return 'Your account is pending approval. Please contact support.';
    case 'account_blocked':
      return 'Your account has been suspended. Please contact support.';
    case 'role_unsupported':
      return 'Your account role is not supported. Please contact support.';
    case 'profile_missing':
      return 'Account profile not found. Please contact support.';
    case 'company_context_missing':
      return 'Your account is not linked to a company. Please contact support.';
    case 'db_error':
      if (dbError?.message) {
        const codeSuffix = dbError.code ? ` [${dbError.code}]` : '';
        return `Account validation query failed${codeSuffix}: ${dbError.message}`;
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
  // Keep a ref so isPasswordSetupContext does not need pathname in its deps array.
  // Without this, every SPA navigation changes pathname → new isPasswordSetupContext
  // reference → useEffect re-runs → bootstrapAuth() fires → 4–6 Supabase queries.
  const pathnameRef = useRef(pathname);
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);
  // Prevents onAuthStateChange from firing a concurrent hydrateUser while
  // login() is already resolving the same SIGNED_IN event, which would cause
  // parallel exclusive LockManager lock acquisitions and a 10-second timeout.
  const loginHydrating = useRef(false);
  const userRef = useRef<ResolvedAuthUser | null>(null);
  const hasSupabaseSessionRef = useRef(false);
  const hydrationRef = useRef<{ userId: string; promise: Promise<AuthResolutionResult> } | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    hasSupabaseSessionRef.current = hasSupabaseSession;
  }, [hasSupabaseSession]);

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
    if (event === 'PASSWORD_RECOVERY') return true;
    return false;
  }, []); // stable — uses ref, never needs to be recreated

  const hydrateUser = useCallback(async (sessionUser: SessionUser): Promise<AuthResolutionResult> => {
    // If the same user is already fully resolved, return immediately without re-running
    // resolveAuthenticatedUser() (which fires 4–6 Supabase queries). This prevents
    // re-hydration when the auth subscription re-fires for the same identity.
    const existing = userRef.current;
    if (existing && existing.id === sessionUser.id) {
      return { user: existing, reason: null } as AuthResolutionResult;
    }

    if (hydrationRef.current?.userId === sessionUser.id) {
      return hydrationRef.current.promise;
    }

    const hydrationPromise = (async () => {
      const result = await withTimeout(resolveAuthenticatedUser(sessionUser), LOGIN_TIMEOUT_MS);
      if (!result.user) {
        setUser(null);
        setHasSupabaseSession(true);
        return result;
      }

      setUser(result.user);
      setHasSupabaseSession(true);
      return result;
    })();

    hydrationRef.current = { userId: sessionUser.id, promise: hydrationPromise };
    try {
      return await hydrationPromise;
    } finally {
      if (hydrationRef.current?.promise === hydrationPromise) {
        hydrationRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    if (!isSupabaseConfigured) {
      resetAuthState();
      setIsLoading(false);
      return;
    }

    const bootstrapAuth = async () => {
      try {
        const getSessionWithRetry = async () => {
          let lastError: unknown = null;

          for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
              const result = await withTimeout(supabase.auth.getSession(), LOGIN_TIMEOUT_MS);
              if (result.error) throw result.error;
              return result;
            } catch (error) {
              lastError = error;
              const canRetry = isServiceUnavailableError(error) && attempt === 0 && !isPasswordSetupContext();
              if (!canRetry) throw error;
              await new Promise((resolve) => setTimeout(resolve, LOGIN_BOOTSTRAP_RETRY_DELAY_MS));
            }
          }

          throw lastError;
        };

        const {
          data: { session },
        } = await getSessionWithRetry();

        if (session?.user) {
          syncRouteAuthCookie(session);
          if (isPasswordSetupContext()) {
            setPasswordSetupSessionState();
          } else {
            await hydrateUser(session.user);
          }
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

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      syncRouteAuthCookie(session);

      // TOKEN_REFRESHED: the Supabase client silently rotated the JWT.
      // Profile, role, and company context are unchanged — re-running the full
      // database hydration would fire 4+ unnecessary Supabase queries and can
      // cascade into repeated dashboard/driver page reloads.
      if (event === 'TOKEN_REFRESHED' && userRef.current) {
        return;
      }

      try {
        if (session?.user) {
          if (isPasswordSetupContext(event)) {
            setPasswordSetupSessionState();
          } else if (loginHydrating.current) {
            // login() is already resolving this session — skip to avoid concurrent
            // LockManager lock acquisition that causes auth-token lock timeout.
          } else {
            await hydrateUser(session.user);
          }
        } else if (!isPasswordSetupContext(event)) {
          resetAuthState();
        }
      } catch (error) {
        console.error('AuthContext auth state handling failed', error);
        if (session?.user && isServiceUnavailableError(error)) {
          setHasSupabaseSession(true);
        } else if (!isPasswordSetupContext(event)) {
          resetAuthState();
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [hydrateUser, isPasswordSetupContext, resetAuthState, setPasswordSetupSessionState, syncRouteAuthCookie]);

  const login = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string; route?: ReturnType<typeof getPostLoginRoute> }> => {
    loginHydrating.current = true;
    try {
      if (!isSupabaseConfigured) {
        return { success: false, error: LOGIN_UNAVAILABLE_ERROR };
      }

      const normalizedEmail = email.trim().toLowerCase();
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email: normalizedEmail, password }),
        LOGIN_TIMEOUT_MS
      );
      if (error) { return { success: false, error: error.message }; }
      if (!data.user || !data.session?.access_token) { return { success: false, error: 'Login failed' }; }
      syncRouteAuthCookie(data.session);

      const onboardingRoute = await resolveOnboardingLoginRoute(data.session.access_token);
      if (onboardingRoute) {
        setUser(null);
        setHasSupabaseSession(true);
        router.replace(onboardingRoute);
        return { success: true, route: onboardingRoute };
      }

      const result = await hydrateUser(data.user);
      if (!result.user) {
        if (result.reason === 'db_error') {
          console.error('[XDrive Auth] account validation db_error', {
            query: result.dbError.query,
            code: result.dbError.code,
            details: result.dbError.details,
            hint: result.dbError.hint,
            message: result.dbError.message,
          });
        }
        return {
          success: false,
          error: authFailureReasonToMessage(result.reason, result.reason === 'db_error' ? result.dbError : null),
        };
      }

      const route = getPostLoginRoute(result.user);
      return { success: true, route };
    } catch (error) {
      console.error('Login error:', error);
      if (isServiceUnavailableError(error)) {
        return { success: false, error: LOGIN_UNAVAILABLE_ERROR };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred during login',
      };
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
          return {
            success: false,
            error: `Please wait ${remainingSeconds}s before requesting another reset email.`,
          };
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
    } catch (err) {
      console.error('Reset password error:', err);
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
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export type { UserRole };
