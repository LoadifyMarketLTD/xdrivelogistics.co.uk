'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
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
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';

const LOGIN_TIMEOUT_MS = 10_000;
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
    default:
      return 'Unable to validate account access. Please try again.';
  }
};

interface AuthContextType {
  user: ResolvedAuthUser | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
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

  const resetAuthState = useCallback(() => {
    setUser(null);
    setHasSupabaseSession(false);
  }, []);

  const setPasswordSetupSessionState = useCallback(() => {
    setUser(null);
    setHasSupabaseSession(true);
  }, []);

  const isPasswordSetupContext = useCallback((event?: string) => {
    if (pathname === RESET_PASSWORD_PATH) return true;
    if (event === 'PASSWORD_RECOVERY') return true;
    return false;
  }, [pathname]);

  const hydrateUser = useCallback(async (sessionUser: SessionUser): Promise<AuthResolutionResult> => {
    const result = await withTimeout(resolveAuthenticatedUser(sessionUser), LOGIN_TIMEOUT_MS);
    if (!result.user) {
      setUser(null);
      setHasSupabaseSession(true);
      return result;
    }

    setUser(result.user);
    setHasSupabaseSession(true);
    return result;
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
        const {
          data: { session },
          error,
        } = await withTimeout(supabase.auth.getSession(), LOGIN_TIMEOUT_MS);
        if (error) throw error;

        if (session?.user) {
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
          resetAuthState();
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void bootstrapAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (session?.user) {
          if (isPasswordSetupContext(event)) {
            setPasswordSetupSessionState();
          } else {
            await hydrateUser(session.user);
          }
        } else if (!isPasswordSetupContext(event)) {
          resetAuthState();
        }
      } catch (error) {
        console.error('AuthContext auth state handling failed', error);
        if (!isPasswordSetupContext(event)) {
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
  }, [hydrateUser, isPasswordSetupContext, resetAuthState, setPasswordSetupSessionState]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!isSupabaseConfigured) {
        return { success: false, error: LOGIN_UNAVAILABLE_ERROR };
      }

      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        LOGIN_TIMEOUT_MS
      );
      if (error) return { success: false, error: error.message };
      if (!data.user) return { success: false, error: 'Login failed' };

      console.debug('[XDrive Auth] signInWithPassword ok', { userId: data.user.id });

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
      console.debug('[XDrive Auth] redirect decision', { role: result.user.role, route });
      router.push(route);
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      if (isServiceUnavailableError(error)) {
        return { success: false, error: LOGIN_UNAVAILABLE_ERROR };
      }
      return { success: false, error: 'An error occurred during login' };
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
