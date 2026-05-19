'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import type { CompanyMembership, Driver, Profile } from '../../lib/types/database';

interface User {
  id: string;
  email: string;
  role: UserRole;
  companyId: string | null;
  driverId: string | null;
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

  const resolveRole = async (userId: string): Promise<{ role: UserRole; companyId: string | null; driverId: string | null }> => {
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
        .select('id, company_id, user_id, app_access')
        .eq('user_id', userId)
        .eq('app_access', true)
        .maybeSingle(),
    ]);

    const profile = profileRes.data as Pick<Profile, 'role' | 'is_driver' | 'company_id'> | null;
    const membership = membershipRes.data as Pick<CompanyMembership, 'company_id' | 'role_in_company' | 'status'> | null;
    const driver = driverRes.data as Pick<Driver, 'id' | 'company_id' | 'user_id' | 'app_access'> | null;
    const driverId = driver?.id ?? null;

    if (membership?.role_in_company === 'owner') {
      return { role: 'owner', companyId: membership.company_id, driverId };
    }
    if (membership?.role_in_company === 'admin') {
      return { role: 'admin', companyId: membership.company_id, driverId };
    }
    if (membership?.role_in_company === 'dispatcher') {
      return { role: 'company', companyId: membership.company_id, driverId };
    }
    if (driver || profile?.is_driver) {
      return { role: 'driver', companyId: driver?.company_id ?? profile?.company_id ?? membership?.company_id ?? null, driverId };
    }
    if (membership?.role_in_company === 'viewer') {
      return { role: 'customer', companyId: membership.company_id, driverId };
    }

    const profileRole = (profile?.role ?? '').toLowerCase();
    if (profileRole === 'owner') return { role: 'owner', companyId: profile?.company_id ?? null, driverId };
    if (profileRole === 'admin') return { role: 'admin', companyId: profile?.company_id ?? null, driverId };
    if (profileRole === 'company' || profileRole === 'dispatcher') return { role: 'company', companyId: profile?.company_id ?? null, driverId };
    if (profileRole === 'driver') return { role: 'driver', companyId: profile?.company_id ?? null, driverId };
    if (profileRole === 'customer' || profileRole === 'client' || profileRole === 'viewer') {
      return { role: 'customer', companyId: profile?.company_id ?? null, driverId };
    }

    return { role: 'customer', companyId: profile?.company_id ?? membership?.company_id ?? null, driverId };
  };

  const hydrateUser = async (sessionUser: { id: string; email?: string | null }) => {
    const roleData = await resolveRole(sessionUser.id);
    const userData: User = {
      id: sessionUser.id,
      email: sessionUser.email ?? '',
      role: roleData.role,
      companyId: roleData.companyId,
      driverId: roleData.driverId,
    };
    setUser(userData);
    setHasSupabaseSession(true);
    return userData;
  };

  const getPostLoginRoute = (role: UserRole) => {
    if (role === 'driver') return '/driver/jobs';
    return '/admin';
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setUser(null);
      setHasSupabaseSession(false);
      setIsLoading(false);
      return;
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await hydrateUser(session.user);
      } else {
        setUser(null);
        setHasSupabaseSession(false);
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await hydrateUser(session.user);
      } else {
        setUser(null);
        setHasSupabaseSession(false);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!isSupabaseConfigured) {
        return { success: false, error: 'Authentication is unavailable: Supabase is not configured.' };
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { success: false, error: error.message };
      if (!data.user) return { success: false, error: 'Login failed' };

      const hydrated = await hydrateUser(data.user);
      router.push(getPostLoginRoute(hydrated.role));
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
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
    setUser(null);
    setHasSupabaseSession(false);
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
