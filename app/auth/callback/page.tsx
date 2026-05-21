'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import type { Company, CompanyMembership, Driver, Profile } from '../../../lib/types/database';

type CreatorCompanySnapshot = Pick<Company, 'id' | 'company_type'>;

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
  const [profileRes, membershipRes, driverRes, creatorCompanyRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('role, is_driver, company_id')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('company_memberships')
      .select('company_id, role_in_company, status')
      .eq('user_id', userId)
      .neq('status', 'suspended')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('drivers')
      .select('id, company_id, user_id, app_access, must_change_password')
      .eq('user_id', userId)
      .eq('app_access', true)
      .maybeSingle(),
    supabase
      .from('companies')
      .select('id, company_type')
      .eq('created_by', userId)
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileRes.error || membershipRes.error || driverRes.error || creatorCompanyRes.error) {
    return null;
  }

  const profile = profileRes.data as Pick<Profile, 'role' | 'is_driver' | 'company_id'> | null;
  const membership = membershipRes.data as Pick<CompanyMembership, 'company_id' | 'role_in_company' | 'status'> | null;
  const driver = driverRes.data as Pick<Driver, 'id' | 'company_id' | 'user_id' | 'app_access' | 'must_change_password'> | null;
  const creatorCompany = creatorCompanyRes.data as CreatorCompanySnapshot | null;
  const mustChangePassword = Boolean(driver?.must_change_password);
  let resolvedCompanyId = driver?.company_id ?? profile?.company_id ?? membership?.company_id ?? creatorCompany?.id ?? null;

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
  if (creatorCompany && resolvedCompanyId) {
    return '/admin';
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

type SessionUser = {
  id: string;
  user_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
};

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    const resolveUserRedirect = async (sessionUser?: SessionUser | null) => {
      const user =
        sessionUser ??
        (
          await withTimeout(
            supabase.auth.getSession(),
            AUTH_CALLBACK_TIMEOUT_MS
          )
        ).data.session?.user ??
        null;
      if (!user) {
        console.warn('[auth/callback] resolveUserRedirect: no session → /login');
        router.replace('/login');
        return;
      }
      // SECURITY: Only use app_metadata.role as the fallback for redirect resolution.
      // user_metadata is end-user writable; app_metadata is service-role-only.
      const fallbackRole =
        typeof user.app_metadata?.role === 'string'
          ? user.app_metadata.role
          : null;
      console.log('[auth/callback] resolveUserRedirect: userId', user.id, 'fallbackRole', fallbackRole);
      const redirectPath = await withTimeout(
        resolveRedirectPath(user.id, fallbackRole),
        AUTH_CALLBACK_TIMEOUT_MS
      );
      if (!redirectPath) {
        console.warn('[auth/callback] resolveUserRedirect: no redirect path → /forbidden, signing out');
        await supabase.auth.signOut();
        router.replace('/forbidden');
        return;
      }
      console.log('[auth/callback] resolveUserRedirect: redirecting to', redirectPath);
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
        const queryType = searchParams.get('type');
        const flow = searchParams.get('flow');
        const nextPath = searchParams.get('next');
        const isRecoveryHint =
          queryType === 'recovery' ||
          hashType === 'recovery' ||
          flow === 'recovery' ||
          nextPath === '/reset-password' ||
          nextPath?.startsWith('/reset-password?') ||
          false;

        console.log('[auth/callback] params', {
          queryType,
          hashType,
          flow,
          nextPath,
          hasAccessToken: Boolean(accessToken),
          isRecoveryHint,
        });

        if (accessToken && refreshToken) {
          console.log('[auth/callback] hash-token flow: calling setSession');
          const { data: sessionData, error: setSessionError } = await withTimeout(
            supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            }),
            AUTH_CALLBACK_TIMEOUT_MS
          );
          if (setSessionError) {
            console.error('[auth/callback] setSession failed:', setSessionError.message);
            throw setSessionError;
          }
          console.log('[auth/callback] setSession success, user:', sessionData.user?.id);

          if (hashType === 'recovery' || isRecoveryHint) {
            console.log('[auth/callback] recovery detected via hashType/hint → /reset-password');
            router.replace('/reset-password');
            return;
          }

          console.log('[auth/callback] non-recovery hash flow → role redirect');
          await resolveUserRedirect(sessionData.user);
          return;
        }

        const code = searchParams.get('code');
        const tokenHash = searchParams.get('token_hash');
        const type = searchParams.get('type');
        const isRecoveryType = type === 'recovery';

        if (code) {
          console.log('[auth/callback] PKCE code flow: calling exchangeCodeForSession');
          const { data: exchangeData, error: exchangeError } = await withTimeout(
            supabase.auth.exchangeCodeForSession(code),
            AUTH_CALLBACK_TIMEOUT_MS
          );
          if (exchangeError) {
            console.error('[auth/callback] exchangeCodeForSession failed:', exchangeError.message);
            throw exchangeError;
          }
          console.log('[auth/callback] exchangeCodeForSession success, user:', exchangeData.user?.id);
          if (isRecoveryType || isRecoveryHint) {
            console.log('[auth/callback] recovery detected via type/hint → /reset-password');
            router.replace('/reset-password');
            return;
          }
          console.log('[auth/callback] non-recovery code flow → role redirect');
          await resolveUserRedirect(exchangeData.user);
          return;
        }

        if (tokenHash) {
          const otpType =
            type === 'signup' ||
            type === 'email' ||
            type === 'recovery' ||
            type === 'invite' ||
            type === 'email_change'
              ? type
              : 'recovery';
          console.log('[auth/callback] token_hash flow, otpType:', otpType);
          const { data: verifyData, error: verifyError } = await withTimeout(
            supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: otpType,
            }),
            AUTH_CALLBACK_TIMEOUT_MS
          );
          if (verifyError) {
            console.error('[auth/callback] verifyOtp failed:', verifyError.message);
            throw verifyError;
          }
          console.log('[auth/callback] verifyOtp success, user:', verifyData.user?.id);
          if (otpType === 'recovery' || isRecoveryHint) {
            console.log('[auth/callback] recovery OTP → /reset-password');
            router.replace('/reset-password');
            return;
          }
          console.log('[auth/callback] non-recovery OTP → role redirect');
          await resolveUserRedirect(verifyData.user);
          return;
        }

        console.warn('[auth/callback] no auth params found → /login');
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
