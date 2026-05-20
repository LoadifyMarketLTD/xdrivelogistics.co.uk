'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import type { CompanyMembership, Driver, Profile } from '../../lib/types/database';

const LOGIN_TIMEOUT_MS = 10_000;
const LOGIN_UNAVAILABLE_ERROR = 'Login service unavailable. Please try again.';

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

interface User {
  id: string;
  email: string;
  role: UserRole;
  companyId: string | null;
  driverId: string | null;
  mustChangePassword: boolean;
}

export type UserRole = 'guest' | 'customer' | 'driver' | 'company' | 'admin' | 'owner';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
  hasSupabaseSession: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasSupabaseSession, setHasSupabaseSession] = useState(false);
  const router = useRouter();

  const mapRole = (value: string | null | undefined): UserRole | null => {
    const normalized = (value ?? '').toLowerCase();
    if (normalized === 'owner') return 'owner';
    if (normalized === 'admin') return 'admin';
    if (normalized === 'company' || normalized === 'dispatcher') return 'company';
    if (normalized === 'driver') return 'driver';
    if (normalized === 'customer' || normalized === 'client' || normalized === 'viewer') return 'customer';
    return null;
  };

  const resetAuthState = () => {
    setUser(null);
    setHasSupabaseSession(false);
  };

  const resolveRole = async (
    userId: string,
    fallbackRole?: string | null
  ): Promise<{ role: UserRole; companyId: string | null; driverId: string | null; mustChangePassword: boolean } | null> => {
    const [profileRes, membershipRes, driverRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('role, is_driver, company_id')
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .from('company_memberships')
        .select('company_id, role_in_company, status')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('drivers')
        .select('id, company_id, user_id, app_access, must_change_password')
        .eq('user_id', userId)
        .eq('app_access', true)
        .maybeSingle(),
    ]);

    if (profileRes.error) {
      console.error('AuthContext.resolveRole profiles query failed', {
        userId,
        error: profileRes.error,
      });
      return null;
    }
    if (membershipRes.error) {
      console.error('AuthContext.resolveRole company_memberships query failed', {
        userId,
        error: membershipRes.error,
      });
      return null;
    }
    if (driverRes.error) {
      console.error('AuthContext.resolveRole drivers query failed', {
        userId,
        error: driverRes.error,
      });
      return null;
    }

    const profile = profileRes.data as Pick<Profile, 'role' | 'is_driver' | 'company_id'> | null;
    const membership = membershipRes.data as Pick<CompanyMembership, 'company_id' | 'role_in_company' | 'status'> | null;
    const driver = driverRes.data as Pick<Driver, 'id' | 'company_id' | 'user_id' | 'app_access' | 'must_change_password'> | null;
    const driverId = driver?.id ?? null;
    const mustChangePassword = Boolean(driver?.must_change_password);

    let resolvedCompanyId = driver?.company_id ?? profile?.company_id ?? membership?.company_id ?? null;

    const fallbackMappedRole = mapRole(fallbackRole);
    const profileMappedRole = mapRole(profile?.role);
    const shouldProvisionCompany =
      !resolvedCompanyId &&
      (fallbackMappedRole === 'company' ||
        fallbackMappedRole === 'admin' ||
        fallbackMappedRole === 'owner' ||
        profileMappedRole === 'company' ||
        profileMappedRole === 'admin' ||
        profileMappedRole === 'owner');

    if (shouldProvisionCompany) {
      const { data: provisionedCompanyId } = await supabase.rpc('get_or_create_company_for_user');
      if (typeof provisionedCompanyId === 'string' && provisionedCompanyId) {
        resolvedCompanyId = provisionedCompanyId;
      }
    }

    if (membership?.role_in_company === 'owner') {
      return resolvedCompanyId ? { role: 'owner', companyId: resolvedCompanyId, driverId, mustChangePassword: false } : null;
    }
    if (membership?.role_in_company === 'admin') {
      return resolvedCompanyId ? { role: 'admin', companyId: resolvedCompanyId, driverId, mustChangePassword: false } : null;
    }
    if (membership?.role_in_company === 'dispatcher') {
      return resolvedCompanyId ? { role: 'company', companyId: resolvedCompanyId, driverId, mustChangePassword: false } : null;
    }
    if (driver || profile?.is_driver) {
      return resolvedCompanyId ? { role: 'driver', companyId: resolvedCompanyId, driverId, mustChangePassword } : null;
    }
    if (membership?.role_in_company === 'viewer') {
      return { role: 'customer', companyId: resolvedCompanyId, driverId, mustChangePassword: false };
    }

    const profileRole = mapRole(profile?.role);
    if (profileRole) {
      if ((profileRole === 'company' || profileRole === 'admin' || profileRole === 'owner' || profileRole === 'driver') && !resolvedCompanyId) {
        return null;
      }
      return { role: profileRole, companyId: resolvedCompanyId, driverId, mustChangePassword: profileRole === 'driver' ? mustChangePassword : false };
    }

    const metadataRole = mapRole(fallbackRole);
    if (metadataRole) {
      if ((metadataRole === 'company' || metadataRole === 'admin' || metadataRole === 'owner' || metadataRole === 'driver') && !resolvedCompanyId) {
        return null;
      }
      return { role: metadataRole, companyId: resolvedCompanyId, driverId, mustChangePassword: metadataRole === 'driver' ? mustChangePassword : false };
    }

    return null;
  };

  const hydrateUser = async (sessionUser: { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null }) => {
    if (!sessionUser?.id) {
      resetAuthState();
      return null;
    }

    const fallbackRole =
      typeof sessionUser.user_metadata?.role === 'string'
        ? sessionUser.user_metadata.role
        : typeof sessionUser.user_metadata?.requested_role === 'string'
          ? sessionUser.user_metadata.requested_role
          : null;
    const roleData = await withTimeout(resolveRole(sessionUser.id, fallbackRole), LOGIN_TIMEOUT_MS);
    if (!roleData) {
      resetAuthState();
      if (isSupabaseConfigured) {
        await supabase.auth.signOut();
      }
      return null;
    }

    const userData: User = {
      id: sessionUser.id,
      email: sessionUser.email ?? '',
      role: roleData.role,
      companyId: roleData.companyId,
      driverId: roleData.driverId,
      mustChangePassword: roleData.mustChangePassword,
    };
    setUser(userData);
    setHasSupabaseSession(true);
    return userData;
  };

  const getPostLoginRoute = (currentUser: User) => {
    if (currentUser.role === 'driver') return currentUser.mustChangePassword ? '/driver/change-password' : '/driver/jobs';
    if (currentUser.role === 'customer') return '/customer';
    return '/admin';
  };

  const getAuthUrlSignals = () => {
    if (typeof window === 'undefined') {
      return {
        pathname: '',
        queryType: null as string | null,
        hashType: null as string | null,
        hasRecoveryTokens: false,
      };
    }

    const queryParams = new URLSearchParams(window.location.search);
    const hashParams = window.location.hash
      ? new URLSearchParams(window.location.hash.replace(/^#/, ''))
      : null;

    const queryType = queryParams.get('type');
    const hashType = hashParams?.get('type') ?? null;
    const hasRecoveryTokens =
      Boolean(hashParams?.get('access_token') && hashParams?.get('refresh_token')) ||
      Boolean(queryParams.get('code')) ||
      Boolean(queryParams.get('token_hash'));

    return {
      pathname: window.location.pathname,
      queryType,
      hashType,
      hasRecoveryTokens,
    };
  };

  const isRecoveryAuthContext = (event?: string) => {
    if (event === 'PASSWORD_RECOVERY') return true;
    const { pathname, queryType, hashType, hasRecoveryTokens } = getAuthUrlSignals();
    if (pathname === '/reset-password') return true;
    if (queryType === 'recovery' || hashType === 'recovery') return true;
    if (pathname === '/auth/callback' && hasRecoveryTokens && (queryType === 'recovery' || hashType === 'recovery')) {
      return true;
    }
    return false;
  };

  useEffect(() => {
    let isMounted = true;

    if (!isSupabaseConfigured) {
      resetAuthState();
      if (isMounted) setIsLoading(false);
      return;
    }

    const { pathname, queryType, hashType, hasRecoveryTokens } = getAuthUrlSignals();
    const hasRecoverySignal =
      queryType === 'recovery' ||
      hashType === 'recovery' ||
      (hasRecoveryTokens && (queryType === 'recovery' || hashType === 'recovery'));

    if (hasRecoverySignal && pathname !== '/auth/callback') {
      router.replace(`/auth/callback${window.location.search}${window.location.hash}`);
    }

    const bootstrapAuth = async () => {
      try {
        const { data: { session }, error } = await withTimeout(supabase.auth.getSession(), LOGIN_TIMEOUT_MS);
        if (error) {
          throw error;
        }

        if (session?.user) {
          if (isRecoveryAuthContext()) {
            setUser(null);
            setHasSupabaseSession(true);
          } else {
            await hydrateUser(session.user);
          }
        } else {
          resetAuthState();
        }
      } catch (error) {
        console.error('AuthContext bootstrap failed', error);
        resetAuthState();
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void bootstrapAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (session?.user) {
          if (isRecoveryAuthContext(event)) {
            setUser(null);
            setHasSupabaseSession(true);
          } else {
            await hydrateUser(session.user);
          }
        } else {
          resetAuthState();
        }
      } catch (error) {
        console.error('AuthContext auth state handling failed', error);
        resetAuthState();
      } finally {
        if (isMounted) setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

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

      const hydrated = await withTimeout(hydrateUser(data.user), LOGIN_TIMEOUT_MS);
      if (!hydrated) {
        return { success: false, error: 'Unable to validate account access.' };
      }
      router.push(getPostLoginRoute(hydrated));
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
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`,
      });
      if (error) return { success: false, error: error.message };
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
