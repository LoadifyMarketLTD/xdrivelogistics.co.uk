'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import type { CompanyMembership, Driver, Profile } from '../../../lib/types/database';

const AUTH_CALLBACK_TIMEOUT_MS = 10_000;

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error('Authentication callback timed out.')), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
};

const mapRole = (value: string | null | undefined) => {
  const normalized = (value ?? '').toLowerCase();
  if (normalized === 'owner') return 'owner';
  if (normalized === 'admin') return 'admin';
  if (normalized === 'company' || normalized === 'dispatcher') return 'company';
  if (normalized === 'driver') return 'driver';
  if (normalized === 'customer' || normalized === 'client' || normalized === 'viewer') return 'customer';
  return null;
};

const resolveRedirectPath = async (
  userId: string,
  fallbackRole?: string | null
) => {
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

  if (profileRes.error || membershipRes.error || driverRes.error) {
    return null;
  }

  const profile = profileRes.data as Pick<Profile, 'role' | 'is_driver' | 'company_id'> | null;
  const membership = membershipRes.data as Pick<CompanyMembership, 'company_id' | 'role_in_company' | 'status'> | null;
  const driver = driverRes.data as Pick<Driver, 'id' | 'company_id' | 'user_id' | 'app_access' | 'must_change_password'> | null;
  const mustChangePassword = Boolean(driver?.must_change_password);
  const resolvedCompanyId = driver?.company_id ?? profile?.company_id ?? membership?.company_id ?? null;

  if (membership?.role_in_company === 'owner' || membership?.role_in_company === 'admin' || membership?.role_in_company === 'dispatcher') {
    return resolvedCompanyId ? '/admin' : null;
  }

  if (driver || profile?.is_driver) {
    if (!resolvedCompanyId) return null;
    return mustChangePassword ? '/driver/change-password' : '/driver/jobs';
  }

  if (membership?.role_in_company === 'viewer') {
    return '/customer';
  }

  const profileRole = mapRole(profile?.role);
  if (profileRole === 'driver') {
    if (!resolvedCompanyId) return null;
    return mustChangePassword ? '/driver/change-password' : '/driver/jobs';
  }
  if (profileRole === 'customer') return '/customer';
  if (profileRole === 'company' || profileRole === 'admin' || profileRole === 'owner') {
    return resolvedCompanyId ? '/admin' : null;
  }

  const metadataRole = mapRole(fallbackRole);
  if (metadataRole === 'driver') {
    if (!resolvedCompanyId) return null;
    return mustChangePassword ? '/driver/change-password' : '/driver/jobs';
  }
  if (metadataRole === 'customer') return '/customer';
  if (metadataRole === 'company' || metadataRole === 'admin' || metadataRole === 'owner') {
    return resolvedCompanyId ? '/admin' : null;
  }

  return null;
};

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    const resolveUserRedirect = async () => {
      const { data: userData } = await withTimeout(
        supabase.auth.getUser(),
        AUTH_CALLBACK_TIMEOUT_MS
      );
      if (!userData.user) {
        router.replace('/login');
        return;
      }
      const fallbackRole =
        typeof userData.user.user_metadata?.role === 'string'
          ? userData.user.user_metadata.role
          : typeof userData.user.user_metadata?.requested_role === 'string'
            ? userData.user.user_metadata.requested_role
            : null;
      const redirectPath = await withTimeout(
        resolveRedirectPath(userData.user.id, fallbackRole),
        AUTH_CALLBACK_TIMEOUT_MS
      );
      if (!redirectPath) {
        await supabase.auth.signOut();
        router.replace('/forbidden');
        return;
      }
      router.replace(redirectPath);
    };

    const completeAuth = async () => {
      try {
        if (!isSupabaseConfigured) {
          setError('Authentication is unavailable: Supabase is not configured.');
          return;
        }

        const hashParams =
          typeof window !== 'undefined' && window.location.hash
            ? new URLSearchParams(window.location.hash.replace(/^#/, ''))
            : null;
        const accessToken = hashParams?.get('access_token');
        const refreshToken = hashParams?.get('refresh_token');
        const hashType = hashParams?.get('type');

        if (accessToken && refreshToken) {
          const { error: setSessionError } = await withTimeout(
            supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            }),
            AUTH_CALLBACK_TIMEOUT_MS
          );
          if (setSessionError) throw setSessionError;

          if (hashType === 'recovery') {
            router.replace('/reset-password');
            return;
          }

          await resolveUserRedirect();
          return;
        }

        const code = searchParams.get('code');
        const tokenHash = searchParams.get('token_hash');
        const type = searchParams.get('type');

        if (code) {
          const { error: exchangeError } = await withTimeout(
            supabase.auth.exchangeCodeForSession(code),
            AUTH_CALLBACK_TIMEOUT_MS
          );
          if (exchangeError) throw exchangeError;
          if (type === 'recovery') {
            router.replace('/reset-password');
            return;
          }
          await resolveUserRedirect();
          return;
        }

        if (tokenHash && type) {
          const { error: verifyError } = await withTimeout(
            supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: type as 'signup' | 'email' | 'recovery' | 'invite' | 'email_change',
            }),
            AUTH_CALLBACK_TIMEOUT_MS
          );
          if (verifyError) throw verifyError;
          if (type === 'recovery') {
            router.replace('/reset-password');
            return;
          }
          await resolveUserRedirect();
          return;
        }

        router.replace('/login');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Authentication callback failed.';
        setError(message);
      }
    };

    completeAuth();
  }, [router, searchParams]);

  return (
    <main>
      <section style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <h1 style={{ marginBottom: '1rem' }}>Completing sign-in…</h1>
        {error && <p style={{ color: '#dc2626' }}>{error}</p>}
      </section>
    </main>
  );
}
