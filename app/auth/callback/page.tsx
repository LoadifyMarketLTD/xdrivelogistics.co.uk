'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

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
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          router.replace('/admin');
          return;
        }

        if (tokenHash && type) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as 'signup' | 'email' | 'recovery' | 'invite' | 'email_change',
          });
          if (verifyError) throw verifyError;
          router.replace(type === 'recovery' ? '/admin/settings' : '/admin');
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
