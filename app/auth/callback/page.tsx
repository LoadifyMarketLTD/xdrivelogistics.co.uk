'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { resolveAccountTypeFromMetadata } from '../../../lib/accountTypes';
import { classifyOnboardingLifecycleStatus } from '../../../lib/accessLifecycle';
import { RESET_PASSWORD_PATH, getBrowserAuthSignals } from '../../../lib/authFlow';
import {
  getPostLoginRoute,
  resolveAuthenticatedUser,
  type SessionUser,
} from '../../../lib/authSession';
import { clearRouteAuthCookie, writeRouteAuthCookie } from '../../../lib/routeAuthCookie';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';

const AUTH_CALLBACK_TIMEOUT_MS = 15_000;
const INVALID_LINK_MESSAGE = 'The link is invalid, expired, or has already been used. Please request a new link.';

type OtpType = 'invite' | 'recovery' | 'signup' | 'email' | 'email_change';
type RecoveryType = 'recovery' | 'signup' | 'other';
type OnboardingResponse = {
  error?: string;
  status?: string;
  onboardingPath?: string;
};

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

const clearBrowserTokens = () => {
  if (typeof window !== 'undefined') window.history.replaceState(null, '', '/auth/callback');
};

const normalizeSignal = (value: string | null) => value?.trim() ?? '';

const recoveryTypeFor = (
  queryType: string | null,
  hashType: string | null,
  flow: string | null
): RecoveryType => {
  const value = (queryType ?? hashType ?? flow ?? '').trim().toLowerCase();
  if (value === 'recovery' || value === 'invite') return 'recovery';
  if (['signup', 'email', 'email_change'].includes(value)) return 'signup';
  return 'other';
};

const otpTypeFor = (
  queryType: string | null,
  hashType: string | null,
  flow: string | null
): OtpType | null => {
  const value = (queryType ?? hashType ?? flow ?? '').trim().toLowerCase();
  return ['invite', 'recovery', 'signup', 'email', 'email_change'].includes(value)
    ? value as OtpType
    : null;
};

const isPkceVerifierMissingError = (message: string) => {
  const normalized = message.toLowerCase();
  return normalized.includes('code verifier') || normalized.includes('both auth code and code verifier');
};

const onboardingRoute = (payload: OnboardingResponse | null): string | null => {
  const lifecycle = classifyOnboardingLifecycleStatus(payload?.status);
  if (lifecycle === 'editable') return '/onboarding/resume';
  if (lifecycle === 'review') return '/pending-approval';
  if (lifecycle === 'rejected') return '/forbidden?reason=onboarding-rejected';
  if (lifecycle === 'approved') return null;
  if (payload?.status) throw new Error(`Unsupported onboarding status: ${payload.status}`);
  return null;
};

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [isLinkIssue, setIsLinkIssue] = useState(false);
  const [recoveryType, setRecoveryType] = useState<RecoveryType>('other');

  useEffect(() => {
    const redirectAuthenticatedUser = async (sessionUser: SessionUser | null) => {
      if (!sessionUser) {
        setError(INVALID_LINK_MESSAGE);
        setIsLinkIssue(true);
        return;
      }

      const { data: { session }, error: sessionError } = await withTimeout(
        supabase.auth.getSession(),
        AUTH_CALLBACK_TIMEOUT_MS
      );
      if (sessionError) throw sessionError;
      if (!session?.access_token) throw new Error('Confirmed account session was not created. Please sign in.');
      writeRouteAuthCookie(session);

      let response = await fetch('/api/onboarding/init', {
        method: 'GET',
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      });

      if (response.status === 404) {
        const accountType = resolveAccountTypeFromMetadata(
          sessionUser.user_metadata,
          sessionUser.app_metadata
        );
        if (accountType) {
          response = await fetch('/api/onboarding/init', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              account_type: accountType,
              forceRegenerateToken: false,
            }),
          });
        }
      }

      if (response.ok) {
        const payload = await response.json().catch(() => null) as OnboardingResponse | null;
        const route = onboardingRoute(payload);
        if (route) {
          router.replace(route);
          return;
        }
      } else if (response.status !== 404) {
        const payload = await response.json().catch(() => null) as OnboardingResponse | null;
        throw new Error(payload?.error ?? 'Unable to initialize onboarding.');
      }

      const result = await withTimeout(
        resolveAuthenticatedUser(sessionUser),
        AUTH_CALLBACK_TIMEOUT_MS
      );
      if (!result.user) {
        if (result.reason === 'account_pending') {
          router.replace('/pending-approval');
          return;
        }
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
          setError(INVALID_LINK_MESSAGE);
          setIsLinkIssue(true);
          return;
        }

        const accessToken = normalizeSignal(signals.accessToken);
        const refreshToken = normalizeSignal(signals.refreshToken);
        const code = normalizeSignal(signals.code);
        const tokenHash = normalizeSignal(signals.tokenHash);
        const hasSessionTokens = Boolean(accessToken && refreshToken);
        const hasCode = Boolean(code);
        const hasTokenHash = Boolean(tokenHash);
        const callbackRecoveryType = recoveryTypeFor(signals.queryType, signals.hashType, signals.flow);
        const otpType = otpTypeFor(signals.queryType, signals.hashType, signals.flow) ?? 'recovery';
        setRecoveryType(callbackRecoveryType);

        const { data: { session: existingSession }, error: existingSessionError } = await withTimeout(
          supabase.auth.getSession(),
          AUTH_CALLBACK_TIMEOUT_MS
        );
        if (existingSessionError) throw existingSessionError;

        let sessionUser: SessionUser | null = existingSession?.user ?? null;
        let consumedBrowserTokens = false;
        let verifiedOtpType: OtpType | null = null;

        if (!sessionUser && !hasSessionTokens && !hasCode && !hasTokenHash) {
          setError(INVALID_LINK_MESSAGE);
          setIsLinkIssue(true);
          return;
        }

        if (!sessionUser && hasSessionTokens) {
          const { data, error: setSessionError } = await withTimeout(
            supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }),
            AUTH_CALLBACK_TIMEOUT_MS
          );
          if (setSessionError) throw setSessionError;
          sessionUser = data.user;
          consumedBrowserTokens = Boolean(data.user);
        }

        if (!sessionUser && hasCode) {
          const { data, error: exchangeError } = await withTimeout(
            supabase.auth.exchangeCodeForSession(code),
            AUTH_CALLBACK_TIMEOUT_MS
          );
          if (exchangeError) {
            if (isPkceVerifierMissingError(exchangeError.message)) {
              setError('This link must be opened in the same browser that requested it. Request a new link and try again.');
              setIsLinkIssue(true);
              return;
            }
            throw exchangeError;
          }
          sessionUser = data.user;
          consumedBrowserTokens = Boolean(data.user);
        }

        if (!sessionUser && hasTokenHash) {
          const { data, error: verifyError } = await withTimeout(
            supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType }),
            AUTH_CALLBACK_TIMEOUT_MS
          );
          if (verifyError) throw verifyError;
          sessionUser = data.user;
          verifiedOtpType = otpType;
          consumedBrowserTokens = Boolean(data.user);
        }

        if (consumedBrowserTokens) clearBrowserTokens();

        if (!sessionUser) {
          setError(INVALID_LINK_MESSAGE);
          setIsLinkIssue(true);
          return;
        }

        if (verifiedOtpType === 'invite' || verifiedOtpType === 'recovery' || callbackRecoveryType === 'recovery') {
          router.replace(RESET_PASSWORD_PATH);
          return;
        }

        await redirectAuthenticatedUser(sessionUser);
      } catch (reason) {
        clearRouteAuthCookie();
        const message = reason instanceof Error ? reason.message : 'Authentication callback failed.';
        setError(
          isPkceVerifierMissingError(message)
            ? 'This link must be opened in the same browser that requested it. Request a new link and try again.'
            : message
        );
        setIsLinkIssue(isPkceVerifierMissingError(message));
      }
    };

    void completeAuth();
  }, [router]);

  return (
    <main>
      <section style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <h1>{isLinkIssue ? 'Link issue detected' : 'Completing sign-in…'}</h1>
        {error && <p role="alert" style={{ color: '#dc2626' }}>{error}</p>}
        {isLinkIssue && (
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => router.replace('/login')} style={{ padding: '0.75rem 1.25rem' }}>
              {recoveryType === 'recovery' ? 'Request a new reset link' : 'Back to sign in'}
            </button>
            {recoveryType !== 'recovery' && (
              <button type="button" onClick={() => router.replace('/register')} style={{ padding: '0.75rem 1.25rem' }}>
                Go to register
              </button>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
