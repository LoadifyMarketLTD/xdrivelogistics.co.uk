'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  RESET_PASSWORD_PATH,
  getBrowserAuthSignals,
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

type OtpType = 'invite' | 'recovery' | 'signup' | 'email' | 'email_change';

const clearBrowserTokens = (pathname: string) => {
  if (typeof window === 'undefined') return;
  window.history.replaceState(null, '', pathname);
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

      const result = await withTimeout(resolveAuthenticatedUser(sessionUser), AUTH_CALLBACK_TIMEOUT_MS);
      if (!result.user) {
        router.replace('/forbidden');
        return;
      }

      router.replace(getPostLoginRoute(result.user));
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

        let sessionUser: SessionUser | null = null;
        let consumedBrowserTokens = false;
        let verifiedOtpType: OtpType | null = null;

        const {
          data: { session: existingSession },
          error: existingSessionError,
        } = await withTimeout(supabase.auth.getSession(), AUTH_CALLBACK_TIMEOUT_MS);
        if (existingSessionError) throw existingSessionError;
        sessionUser = existingSession?.user ?? null;

        if (!sessionUser) {
          const { data: setSessionData } = await withTimeout(
            supabase.auth.setSession({
              access_token: signals.accessToken ?? '',
              refresh_token: signals.refreshToken ?? '',
            }),
            AUTH_CALLBACK_TIMEOUT_MS
          );
          if (setSessionData.user) {
            sessionUser = setSessionData.user;
            consumedBrowserTokens = true;
          }
        }

        if (!sessionUser) {
          const { data: exchangeData } = await withTimeout(
            supabase.auth.exchangeCodeForSession(signals.code ?? ''),
            AUTH_CALLBACK_TIMEOUT_MS
          );
          if (exchangeData.user) {
            sessionUser = exchangeData.user;
            consumedBrowserTokens = true;
          }
        }

        if (!sessionUser) {
          const otpTypes: OtpType[] = ['invite', 'recovery', 'signup', 'email', 'email_change'];
          for (const otpType of otpTypes) {
            const { data: verifyData } = await withTimeout(
              supabase.auth.verifyOtp({
                token_hash: signals.tokenHash ?? '',
                type: otpType,
              }),
              AUTH_CALLBACK_TIMEOUT_MS
            );
            if (verifyData.user) {
              sessionUser = verifyData.user;
              verifiedOtpType = otpType;
              consumedBrowserTokens = true;
              break;
            }
          }
        }

        if (consumedBrowserTokens) {
          clearBrowserTokens('/auth/callback');
        }

        if (verifiedOtpType === 'invite' || verifiedOtpType === 'recovery') {
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
