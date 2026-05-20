'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import type { CompanyMembership, Driver, Profile } from '../../../lib/types/database';

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
      .select('id, company_id, user_id, app_access')
      .eq('user_id', userId)
      .eq('app_access', true)
      .maybeSingle(),
  ]);

  const profile = profileRes.data as Pick<Profile, 'role' | 'is_driver' | 'company_id'> | null;
  const membership = membershipRes.data as Pick<CompanyMembership, 'company_id' | 'role_in_company' | 'status'> | null;
  const driver = driverRes.data as Pick<Driver, 'id' | 'company_id' | 'user_id' | 'app_access'> | null;

  if (membership?.role_in_company === 'owner' || membership?.role_in_company === 'admin' || membership?.role_in_company === 'dispatcher') {
    return '/admin';
  }

  if (driver || profile?.is_driver) {
    return '/driver/jobs';
  }

  if (membership?.role_in_company === 'viewer') {
    return '/customer';
  }

  const profileRole = mapRole(profile?.role);
  if (profileRole === 'driver') return '/driver/jobs';
  if (profileRole === 'customer') return '/customer';
  if (profileRole === 'company' || profileRole === 'admin' || profileRole === 'owner') return '/admin';

  const metadataRole = mapRole(fallbackRole);
  if (metadataRole === 'driver') return '/driver/jobs';
  if (metadataRole === 'customer') return '/customer';
  if (metadataRole === 'company' || metadataRole === 'admin' || metadataRole === 'owner') return '/admin';

  return '/customer';
};

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    const completeAuth = async () => {
      try {
        if (!isSupabaseConfigured) {
          setError('Authentication is unavailable: Supabase is not configured.');
          return;
        }

        const code = searchParams.get('code');
        const tokenHash = searchParams.get('token_hash');
        const type = searchParams.get('type');

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          const { data: userData } = await supabase.auth.getUser();
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
          router.replace(await resolveRedirectPath(userData.user.id, fallbackRole));
          return;
        }

        if (tokenHash && type) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as 'signup' | 'email' | 'recovery' | 'invite' | 'email_change',
          });
          if (verifyError) throw verifyError;

          const { data: userData } = await supabase.auth.getUser();
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
          router.replace(await resolveRedirectPath(userData.user.id, fallbackRole));
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
