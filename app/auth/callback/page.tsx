'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

/** Determine the post-login route for a user, mirroring AuthContext.resolveRole logic. */
async function resolveRedirectRoute(userId: string, userMetadata: Record<string, unknown> | null, type: string | null): Promise<string> {
  // For password-recovery flows, always go to settings so the user can update their password
  if (type === 'recovery') {
    return '/admin/settings';
  }

  const [membershipRes, driverRes, profileRes] = await Promise.all([
    supabase
      .from('company_memberships')
      .select('role_in_company, company_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle(),
    supabase
      .from('drivers')
      .select('id')
      .eq('user_id', userId)
      .eq('app_access', true)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('role, is_driver')
      .eq('id', userId)
      .maybeSingle(),
  ]);

  const memberRole = membershipRes.data?.role_in_company;
  if (memberRole === 'owner' || memberRole === 'admin' || memberRole === 'dispatcher') {
    return '/admin';
  }

  if (driverRes.data || profileRes.data?.is_driver) {
    return '/driver/jobs';
  }

  if (memberRole === 'viewer') {
    return '/customer';
  }

  // Fall back to user_metadata hints set during registration
  const metaRole = (userMetadata?.role ?? userMetadata?.requested_role ?? '') as string;
  const normalised = metaRole.toLowerCase();
  if (normalised === 'driver') return '/driver/jobs';
  if (normalised === 'owner' || normalised === 'admin' || normalised === 'company' || normalised === 'dispatcher') return '/admin';
  if (normalised === 'customer' || normalised === 'client') return '/customer';

  const profileRole = (profileRes.data?.role ?? '').toLowerCase();
  if (profileRole === 'driver') return '/driver/jobs';
  if (profileRole === 'owner' || profileRole === 'admin' || profileRole === 'company') return '/admin';

  // Default: customer dashboard
  return '/customer';
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    const completeAuth = async () => {
      try {
        const code = searchParams.get('code');
        const tokenHash = searchParams.get('token_hash');
        const type = searchParams.get('type');

        if (code) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          const sessionUser = data?.session?.user;
          if (sessionUser) {
            const route = await resolveRedirectRoute(sessionUser.id, sessionUser.user_metadata ?? null, type);
            router.replace(route);
          } else {
            router.replace('/admin');
          }
          return;
        }

        if (tokenHash && type) {
          const { data, error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as 'signup' | 'email' | 'recovery' | 'invite' | 'email_change',
          });
          if (verifyError) throw verifyError;
          const sessionUser = data?.session?.user ?? data?.user;
          if (sessionUser) {
            const route = await resolveRedirectRoute(sessionUser.id, sessionUser.user_metadata ?? null, type);
            router.replace(route);
          } else {
            router.replace(type === 'recovery' ? '/admin/settings' : '/admin');
          }
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
