'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { mapAppRole, roleRequiresCompanyContext, shouldAutoProvisionCompany } from '../../../lib/authRole';
import {
  AUTH_CALLBACK_PATH,
  RESET_PASSWORD_PATH,
  clearRecoverySession,
  hasRecoverySessionMarker,
  markRecoverySession,
} from '../../../lib/authFlow';
import type { Company, CompanyMembership, Driver, Profile } from '../../../lib/types/database';

type CreatorCompanySnapshot = Pick<Company, 'id' | 'company_type'>;
type SessionUser = {
  id: string;
  user_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
};
type OtpType = 'signup' | 'email' | 'recovery' | 'invite' | 'email_change';

const AUTH_CALLBACK_TIMEOUT_MS = 20_000;

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
    console.warn('Auth callback profile validation failure', {
      userId,
      profileError: profileRes.error?.message,
      membershipError: membershipRes.error?.message,
      driverError: driverRes.error?.message,
      companyError: creatorCompanyRes.error?.message,
    });
    return null;
  }

  const profile = profileRes.data as Pick<Profile, 'role' | 'is_driver' | 'company_id'> | null;
  const membership = membershipRes.data as Pick<CompanyMembership, 'company_id' | 'role_in_company' | 'status'> | null;
  const driver = driverRes.data as Pick<Driver, 'id' | 'company_id' | 'user_id' | 'app_access' | 'must_change_password'> | null;
  const creatorCompany = creatorCompanyRes.data as CreatorCompanySnapshot | null;
  const mustChangePassword = Boolean(driver?.must_change_password);
  let resolvedCompanyId = driver?.company_id ?? profile?.company_id ?? membership?.company_id ?? creatorCompany?.id ?? null;

  const shouldProvisionCompany =
    !resolvedCompanyId &&
    shouldAutoProvisionCompany({
      fallbackRole,
      profileRole: profile?.role,
    });

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

  const profileRole = mapAppRole(profile?.role);
  if (profileRole === 'driver') {
    if (roleRequiresCompanyContext(profileRole) && !resolvedCompanyId) return null;
    return mustChangePassword ? '/driver/change-password' : '/driver/jobs';
  }
  if (profileRole === 'customer') return '/customer';
  if (profileRole === 'company' || profileRole === 'admin' || profileRole === 'owner') {
    return resolvedCompanyId ? '/admin' : null;
  }

  const metadataRole = mapAppRole(fallbackRole);
  if (metadataRole === 'driver') {
    if (roleRequiresCompanyContext(metadataRole) && !resolvedCompanyId) return null;
    return mustChangePassword ? '/driver/change-password' : '/driver/jobs';
  }
  if (metadataRole === 'customer') return '/customer';
  if (metadataRole === 'company' || metadataRole === 'admin' || metadataRole === 'owner') {
    return resolvedCompanyId ? '/admin' : null;
  }

  return null;
};

const getOtpType = (type: string | null, isRecoveryHint: boolean): OtpType => {
  if (type === 'signup' || type === 'email' || type === 'recovery' || type === 'invite' || type === 'email_change') {
    return type;
  }
  return isRecoveryHint ? 'recovery' : 'email';
};

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    let recoveryEventDetected = hasRecoverySessionMarker();

    const markRecovery = (source: string) => {
      recoveryEventDetected = true;
      markRecoverySession(source);
      console.info('Auth callback recovery session detected', { source });
    };

    const resolveUserRedirect = async (sessionUser?: SessionUser | null) => {
      let user = sessionUser ?? null;

      if (!user) {
        const { data, error: sessionError } = await withTimeout(
          supabase.auth.getSession(),
          AUTH_CALLBACK_TIMEOUT_MS
        );
        if (sessionError) {
          console.error('Auth callback getSession failure', sessionError);
          throw new Error('Authentication session could not be loaded.');
        }
        user = data.session?.user ?? null;
      }

      if (!user) {
        console.warn('Auth callback token missing and no active session');
        router.replace('/login');
        return;
      }

      const fallbackRole =
        typeof user.user_metadata?.role === 'string'
          ? user.user_metadata.role
          : typeof user.user_metadata?.requested_role === 'string'
            ? user.user_metadata.requested_role
            : typeof user.app_metadata?.role === 'string'
              ? user.app_metadata.role
              : null;

      const redirectPath = await withTimeout(
        resolveRedirectPath(user.id, fallbackRole),
        AUTH_CALLBACK_TIMEOUT_MS
      );

      if (!redirectPath) {
        console.warn('Auth callback profile validation failure', {
          userId: user.id,
          fallbackRole,
        });
        await supabase.auth.signOut();
        router.replace('/login?reason=account_validation_failed');
        return;
      }

      clearRecoverySession();
      router.replace(redirectPath);
    };

    const completeAuth = async () => {
      try {
        if (!isSupabaseConfigured) {
          setError('Authentication is unavailable: Supabase is not configured.');
          return;
        }

        const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
          if (event === 'PASSWORD_RECOVERY') {
            markRecovery('auth-state-password-recovery');
          }
        });

        try {
          const hashParams =
            typeof window !== 'undefined' && window.location.hash
              ? new URLSearchParams(window.location.hash.replace(/^#/, ''))
              : null;

          const accessToken = hashParams?.get('access_token') ?? searchParams.get('access_token');
          const refreshToken = hashParams?.get('refresh_token') ?? searchParams.get('refresh_token');
          const hashType = hashParams?.get('type');
          const queryType = searchParams.get('type');
          const flow = searchParams.get('flow');
          const nextPath = searchParams.get('next');
          const code = searchParams.get('code');
          const tokenHash = searchParams.get('token_hash');
          const authErrorDescription =
            searchParams.get('error_description') ?? hashParams?.get('error_description');

          const isRecoveryHint =
            queryType === 'recovery' ||
            hashType === 'recovery' ||
            flow === 'recovery' ||
            nextPath === RESET_PASSWORD_PATH ||
            nextPath?.startsWith(`${RESET_PASSWORD_PATH}?`) ||
            recoveryEventDetected;

          if (authErrorDescription) {
            console.error('Auth callback token exchange error', { authErrorDescription });
            setError(authErrorDescription);
            return;
          }

          if (accessToken && refreshToken) {
            const { data: sessionData, error: setSessionError } = await withTimeout(
              supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              }),
              AUTH_CALLBACK_TIMEOUT_MS
            );
            if (setSessionError) {
              console.error('Auth callback setSession failure', setSessionError);
              throw new Error('Authentication session could not be established.');
            }

            if (hashType === 'recovery' || queryType === 'recovery' || recoveryEventDetected) {
              markRecovery('callback-access-token');
              router.replace(RESET_PASSWORD_PATH);
              return;
            }

            await resolveUserRedirect(sessionData.user);
            return;
          }

          if (code) {
            const { data: exchangeData, error: exchangeError } = await withTimeout(
              supabase.auth.exchangeCodeForSession(code),
              AUTH_CALLBACK_TIMEOUT_MS
            );
            if (exchangeError) {
              console.error('Auth callback exchangeCodeForSession failure', exchangeError);
              throw new Error('Authentication link exchange failed. Please request a new email link.');
            }

            if (queryType === 'recovery' || recoveryEventDetected) {
              markRecovery('callback-code-exchange');
              router.replace(RESET_PASSWORD_PATH);
              return;
            }

            await resolveUserRedirect(exchangeData.user);
            return;
          }

          if (tokenHash) {
            const otpType = getOtpType(queryType, isRecoveryHint);
            const { data: verifyData, error: verifyError } = await withTimeout(
              supabase.auth.verifyOtp({
                token_hash: tokenHash,
                type: otpType,
              }),
              AUTH_CALLBACK_TIMEOUT_MS
            );
            if (verifyError) {
              console.error('Auth callback verifyOtp failure', verifyError);
              throw new Error('Authentication link verification failed. Please request a new email link.');
            }

            if (otpType === 'recovery' || recoveryEventDetected) {
              markRecovery('callback-otp-verify');
              router.replace(RESET_PASSWORD_PATH);
              return;
            }

            await resolveUserRedirect(verifyData.user);
            return;
          }

          const { data: sessionData, error: sessionError } = await withTimeout(
            supabase.auth.getSession(),
            AUTH_CALLBACK_TIMEOUT_MS
          );

          if (sessionError) {
            console.error('Auth callback getSession failure', sessionError);
            throw new Error('Authentication session could not be loaded.');
          }

          if (sessionData.session?.user) {
            if (isRecoveryHint || recoveryEventDetected) {
              markRecovery('callback-existing-session');
              router.replace(RESET_PASSWORD_PATH);
              return;
            }

            await resolveUserRedirect(sessionData.session.user);
            return;
          }

          console.warn('Auth callback token missing', {
            pathname: AUTH_CALLBACK_PATH,
            queryType,
            hashType,
            hasCode: Boolean(code),
            hasTokenHash: Boolean(tokenHash),
          });

          if (isRecoveryHint) {
            setError('Recovery link is missing required tokens or has expired. Please request a new password reset email.');
            return;
          }

          if (queryType === 'signup' || queryType === 'invite' || queryType === 'email') {
            setError('Authentication link is missing required tokens or has expired. Please request a new email link.');
            return;
          }

          router.replace('/login');
        } finally {
          authListener.subscription.unsubscribe();
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Authentication callback failed.';
        setError(message);
      }
    };

    void completeAuth();

    return () => {
      // Cleanup
    };
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
