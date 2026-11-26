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
  getResponsivePostLoginRoute,
  resolveAuthenticatedUser,
} from '../../lib/authSession';
import { clearRouteAuthCookie, writeRouteAuthCookie } from '../../lib/routeAuthCookie';
import { isMobileDriverBrowser } from '../../lib/isMobileDriverBrowser';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';
import { stageDriverSession } from '../../lib/driverSessionHandoff';

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
  refreshUserContext: () => Promise<{
    success: boolean;
    user?: ResolvedAuthUser;
    error?: string;
  }>;
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
  // Without this, SPA navigation can recreate isPasswordSetupContext, rerun
  // useEffect, restart bootstrapAuth, and trigger 4-6 Supabase queries.
  const pathnameRef = useRef(pathname);
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);
  // Prevents onAuthStateChange from firing a concurrent hydrateUser while
  // login() is already resolving the same SIGNED_IN event, which would cause
  // parallel exclusive LockManager lock acquisitions and a 10-second timeout.
  const loginHydrating = useRef(false);
  // An explicit login/logout supersedes earlier bootstrap and verification work.
  const authOperationRef = useRef(0);
  const explicitSignOutRef = useRef(false);
  const userRef = useRef<ResolvedAuthUser | null>(null);
  const hasSupabaseSessionRef = useRef(false);
  const hydrationRef = useRef<{ userId: string; operation: number; promise: Promise<AuthResolutionResult> } | null>(null);

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
    userRef.current = null;
    setHasSupabaseSession(false);
    clearRouteAuthCookie();
  }, []);

  const setPasswordSetupSessionState = useCallback(() => {
    setUser(null);
    userRef.current = null;
    setHasSupabaseSession(true);
  }, []);

  const isPasswordSetupContext = useCallback((event?: string) => {
    if (pathnameRef.current === RESET_PASSWORD_PATH) return true;
    if (event === 'PASSWORD_RECOVERY') return true;
    return false;
  }, []); // stable - uses ref, never needs to be recreated

  const hydrateUser = useCallback(async (sessionUser: SessionUser): Promise<AuthResolutionResult> => {
    // If the same user is already fully resolved, return immediately without re-running
    // resolveAuthenticatedUser() (which fires 4-6 Supabase queries). This prevents
    // re-hydration when the auth subscription re-fires for the same identity.
    const existing = userRef.current;
    if (existing && existing.id === sessionUser.id) {
      return { user: existing, reason: null } as AuthResolutionResult;
    }

    const operation = authOperationRef.current;
    if (hydrationRef.current?.userId === sessionUser.id && hydrationRef.current.operation === operation) {
      return hydrationRef.current.promise;
    }

    const hydrationPromise = (async () => {
      const result = await withTimeout(resolveAuthenticatedUser(sessionUser), LOGIN_TIMEOUT_MS);
      if (operation !== authOperationRef.current) return result;
      if (!result.user) {
        setUser(null);
        userRef.current = null;
        setHasSupabaseSession(true);
        return result;
      }

      setUser(result.user);
      userRef.current = result.user;
      setHasSupabaseSession(true);
      return result;
    })();

    hydrationRef.current = { userId: sessionUser.id, operation, promise: hydrationPromise };
    try {
      return await hydrationPromise;
    } finally {
      if (hydrationRef.current?.promise === hydrationPromise) {
        hydrationRef.current = null;
      }
    }
  }, []);

  const refreshUserContext = useCallback(async () => {
    if (!isSupabaseConfigured) {
      resetAuthState();
      return { success: false, error: LOGIN_UNAVAILABLE_ERROR };
    }

    const operation = authOperationRef.current;
    const isCurrent = () => operation === authOperationRef.current;
    setIsLoading(true);
    hydrationRef.current = null;

    try {
      const sessionResult = await withTimeout(supabase.auth.getSession(), LOGIN_TIMEOUT_MS);
      if (!isCurrent()) return { success: false, error: LOGIN_UNAVAILABLE_ERROR };
      if (sessionResult.error) throw sessionResult.error;

      const session = sessionResult.data.session;
      if (!session?.user) {
        resetAuthState();
        return { success: false, error: 'Your session has expired. Please sign in again.' };
      }

      syncRouteAuthCookie(session);

      // Keep the last verified user while the authoritative context is rebuilt.
      // A transient Supabase/DB failure must not turn a valid session into a fake logout.
      setHasSupabaseSession(true);

      const result = await withTimeout(
        resolveAuthenticatedUser(session.user),
        LOGIN_TIMEOUT_MS,
      );
      if (!isCurrent()) return { success: false, error: LOGIN_UNAVAILABLE_ERROR };

      if (!result.user) {
        setHasSupabaseSession(true);
        if (result.reason !== 'db_error') {
          setUser(null);
          userRef.current = null;
        }
        return {
          success: false,
          error: authFailureReasonToMessage(
            result.reason,
            result.reason === 'db_error' ? result.dbError : null,
          ),
        };
      }

      setUser(result.user);
      userRef.current = result.user;
      setHasSupabaseSession(true);
      return { success: true, user: result.user };
    } catch (error) {
      if (!isCurrent()) return { success: false, error: LOGIN_UNAVAILABLE_ERROR };
      console.error('AuthContext forced refresh failed', error);
      if (isServiceUnavailableError(error)) {
        setHasSupabaseSession(true);
        return { success: false, error: LOGIN_UNAVAILABLE_ERROR };
      }
      setUser(null);
      userRef.current = null;
      resetAuthState();
      return { success: false, error: 'Unable to refresh account access.' };
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  }, [resetAuthState, syncRouteAuthCookie]);

  useEffect(() => {
    let isMounted = true;

    if (!isSupabaseConfigured) {
      resetAuthState();
      setIsLoading(false);
      return;
    }

    const bootstrapAuth = async () => {
      const operation = authOperationRef.current;
      const isCurrent = () => isMounted && operation === authOperationRef.current;
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
        if (!isCurrent()) return;

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
        if (!isCurrent()) return;
        console.error('AuthContext bootstrap failed', error);
        if (!isPasswordSetupContext()) {
          if (isServiceUnavailableError(error) && (userRef.current || hasSupabaseSessionRef.current)) {
            setHasSupabaseSession(true);
          } else {
            resetAuthState();
          }
        }
      } finally {
        if (isCurrent()) setIsLoading(false);
      }
    };

    void bootstrapAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      // An initial snapshot can arrive after the user has explicitly signed in.
      if (event === 'INITIAL_SESSION' && authOperationRef.current !== 0) return;
      // Null snapshots are not proof of revocation; verify first. Genuine sign-out
      // still clears the route token immediately, including cross-tab sign-out.
      if (!session?.user && event === 'SIGNED_OUT') ++authOperationRef.current;
      if (session?.user || event === 'SIGNED_OUT') syncRouteAuthCookie(session);
      const operation = authOperationRef.current;
      const isCurrent = () => isMounted && operation === authOperationRef.current;

      // TOKEN_REFRESHED: the Supabase client silently rotated the JWT.
      // Profile, role, and company context are unchanged - re-running the full
      // database hydration would fire 4+ unnecessary Supabase queries and can
      // cascade into repeated dashboard/driver page reloads.
      if (event === 'TOKEN_REFRESHED' && session?.user && userRef.current) {
        return;
      }

      if (session?.user && isPasswordSetupContext(event)) {
        setPasswordSetupSessionState();
        if (isMounted) setIsLoading(false);
        return;
      }

      if (!session?.user) {
        if (isPasswordSetupContext(event)) {
          if (isMounted) setIsLoading(false);
          return;
        }
        if (explicitSignOutRef.current) {
          explicitSignOutRef.current = false;
          resetAuthState();
          if (isMounted) setIsLoading(false);
          return;
        }

        // Verify unexpected null-session events before clearing a valid workspace.
        // This prevents transient cross-tab/token reconciliation from becoming a false logout.
        window.setTimeout(() => {
          if (!isCurrent()) return;
          void (async () => {
            try {
              const result = await withTimeout(supabase.auth.getSession(), LOGIN_TIMEOUT_MS);
              if (!isCurrent()) return;
              const verifiedSession = result.data.session;
              if (result.error) throw result.error;
              if (verifiedSession?.user) {
                syncRouteAuthCookie(verifiedSession);
                setHasSupabaseSession(true);
                if (!userRef.current) await hydrateUser(verifiedSession.user);
                return;
              }
              resetAuthState();
            } catch (error) {
              if (!isCurrent()) return;
              console.error('AuthContext null-session verification failed', error);
              if (isServiceUnavailableError(error) && (userRef.current || hasSupabaseSessionRef.current)) {
                setHasSupabaseSession(true);
                return;
              }
              resetAuthState();
            } finally {
              if (isCurrent()) setIsLoading(false);
            }
          })();
        }, 250);
        return;
      }

      if (loginHydrating.current) {
        // login() is already resolving this session. Do not start another
        // hydration for the same SIGNED_IN event.
        if (isMounted) setIsLoading(false);
        return;
      }

      // Supabase documents a supabase-js deadlock when asynchronous API work is
      // awaited inside onAuthStateChange. Return from the callback first, then run
      // the profile/company hydration in the next macrotask so the auth lock is
      // released before resolveAuthenticatedUser() issues database queries.
      window.setTimeout(() => {
        if (!isCurrent()) return;

        void (async () => {
          try {
            await hydrateUser(session.user);
          } catch (error) {
            if (!isCurrent()) return;
            console.error('AuthContext auth state handling failed', error);
            if (isServiceUnavailableError(error)) {
              setHasSupabaseSession(true);
            } else if (!isPasswordSetupContext(event)) {
              resetAuthState();
            }
          } finally {
            if (isCurrent()) setIsLoading(false);
          }
        })();
      }, 0);
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
    if (loginHydrating.current) return { success: false, error: 'Sign-in is already in progress.' };
    const operation = ++authOperationRef.current;
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
      if (operation !== authOperationRef.current) return { success: false, error: LOGIN_UNAVAILABLE_ERROR };
      if (error) { return { success: false, error: error.message }; }
      if (!data.user) { return { success: false, error: 'Login failed' }; }
      syncRouteAuthCookie(data.session);

      const result = await hydrateUser(data.user);
      if (operation !== authOperationRef.current) return { success: false, error: LOGIN_UNAVAILABLE_ERROR };
      if (!result.user) {
        if (result.reason === 'account_pending') {
          const { data: onboardingApplication } = await supabase
            .from('onboarding_applications')
            .select('status, account_type')
            .eq('user_id', data.user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const onboardingStatus = String(onboardingApplication?.status ?? '').trim().toLowerCase();
          if (['invited', 'draft', 'in_progress', 'request_changes'].includes(onboardingStatus)) {
            return { success: true, route: '/onboarding/resume' };
          }
          if (['submitted', 'under_review', 'compliance_review', 'admin_approval'].includes(onboardingStatus)) {
            return { success: true, route: '/pending-approval' };
          }
        }

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

      const route = getResponsivePostLoginRoute(result.user, typeof window !== 'undefined' && isMobileDriverBrowser());
      if (route === '/driver/official-pwa-live' && data.session) stageDriverSession(data.session);
      return { success: true, route };
    } catch (error) {
      console.error('Login error:', error);
      if (isServiceUnavailableError(error)) {
        return { success: false, error: LOGIN_UNAVAILABLE_ERROR };
      }
      return { success: false, error: 'An error occurred during login' };
    } finally {
      loginHydrating.current = false;
      if (operation === authOperationRef.current) setIsLoading(false);
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
    ++authOperationRef.current;
    explicitSignOutRef.current = true;
    if (isSupabaseConfigured) await supabase.auth.signOut();
    resetAuthState();
    setIsLoading(false);
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        resetPassword,
        refreshUserContext,
        isLoading,
        hasSupabaseSession,
      }}
    >
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