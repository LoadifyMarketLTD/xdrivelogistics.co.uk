'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  RESET_PASSWORD_PATH,
  buildPathWithAuthParams,
  getBrowserAuthSignals,
  isInviteAuthFlow,
  isRecoveryAuthFlow,
} from '../../../lib/authFlow';
import { getPostLoginRoute, resolveAuthenticatedUser, type SessionUser } from '../../../lib/authSession';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';

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

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    const redirectAuthenticatedUser = async (sessionUser: SessionUser | null) => {
      if (!sessionUser) {
        router.replace('/login');
        return;
      }

      const resolvedUser = await withTimeout(resolveAuthenticatedUser(sessionUser), AUTH_CALLBACK_TIMEOUT_MS);
      if (!resolvedUser) {
        router.replace('/forbidden');
        return;
      }

      router.replace(getPostLoginRoute(resolvedUser));
    };

    const completeAuth = async () => {
      try {
        if (!isSupabaseConfigured) {
          setError('Authentication is unavailable: Supabase is not configured.');
          return;
        }

        const signals = getBrowserAuthSignals();
        if (!signals) {
          router.replace('/login');
          return;
        }

        if (isRecoveryAuthFlow(signals)) {
          router.replace(buildPathWithAuthParams(RESET_PASSWORD_PATH, signals));
          return;
        }

        let sessionUser: SessionUser | null = null;

        if (signals.hasHashSessionTokens && signals.accessToken && signals.refreshToken) {
          const { data, error: setSessionError } = await withTimeout(
            supabase.auth.setSession({
              access_token: signals.accessToken,
              refresh_token: signals.refreshToken,
            }),
            AUTH_CALLBACK_TIMEOUT_MS
          );
          if (setSessionError) throw setSessionError;
          sessionUser = data.user ?? null;
        } else if (signals.code) {
          const { data, error: exchangeError } = await withTimeout(
            supabase.auth.exchangeCodeForSession(signals.code),
            AUTH_CALLBACK_TIMEOUT_MS
          );
          if (exchangeError) throw exchangeError;
          sessionUser = data.user ?? null;
        } else if (signals.tokenHash) {
          const otpType = isInviteAuthFlow(signals)
            ? 'invite'
            : signals.queryType === 'signup' || signals.queryType === 'email' || signals.queryType === 'email_change'
              ? signals.queryType
              : 'email';

          const { data, error: verifyError } = await withTimeout(
            supabase.auth.verifyOtp({
              token_hash: signals.tokenHash,
              type: otpType,
            }),
            AUTH_CALLBACK_TIMEOUT_MS
          );
          if (verifyError) throw verifyError;
          sessionUser = data.user ?? null;
        } else {
          const {
            data: { session },
            error: sessionError,
          } = await withTimeout(supabase.auth.getSession(), AUTH_CALLBACK_TIMEOUT_MS);
          if (sessionError) throw sessionError;
          sessionUser = session?.user ?? null;
        }

        if (isInviteAuthFlow(signals)) {
          router.replace(RESET_PASSWORD_PATH);
          return;
        }

        await redirectAuthenticatedUser(sessionUser);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Authentication callback failed.';
        setError(message);
      }
    };

    void completeAuth();
  }, [router]);

  return (
    <main>
      <section style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <h1 style={{ marginBottom: '1rem' }}>Completing sign-in…</h1>
        {error && <p style={{ color: '#dc2626' }}>{error}</p>}
      </section>
    </main>
  );
}
