'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  RESET_PASSWORD_PATH,
  getBrowserAuthSignals,
} from '../../../lib/authFlow';
import { getPostLoginRoute, resolveAuthenticatedUser, type SessionUser } from '../../../lib/authSession';
import { clearRouteAuthCookie, writeRouteAuthCookie } from '../../../lib/routeAuthCookie';
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

const hasSignupOnboardingMetadata = (sessionUser: SessionUser) => {
  const metadata = {
    ...(sessionUser.app_metadata ?? {}),
    ...(sessionUser.user_metadata ?? {}),
  };
  return ['signup_type', 'account_type', 'requested_role', 'workspace_mode'].some((key) => {
    const value = metadata[key];
    return typeof value === 'string' && value.trim().length > 0;
  });
};

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [isLinkIssue, setIsLinkIssue] = useState(false);
  const [recoveryType, setRecoveryType] = useState<'recovery' | 'signup' | 'other'>('other');

  useEffect(() => {
    const INVALID_LINK_MESSAGE =
      'The link is invalid, expired, or has already been used. Please request a new link.';

    const getCallbackRecoveryType = (
      queryType: string | null,
      hashType: string | null,
      flow: string | null
    ): 'recovery' | 'signup' | 'other' => {
      const normalizedType = (queryType ?? hashType ?? flow ?? '').trim().toLowerCase();
      if (normalizedType === 'recovery' || normalizedType === 'invite') return 'recovery';
      if (normalizedType === 'signup' || normalizedType === 'email' || normalizedType === 'email_change') {
        return 'signup';
      }
      return 'other';
    };
    const getOtpType = (queryType: string | null, hashType: string | null, flow: string | null): OtpType | null => {
      const normalizedType = (queryType ?? hashType ?? flow ?? '').trim().toLowerCase();
      if (normalizedType === 'invite') return 'invite';
      if (normalizedType === 'recovery') return 'recovery';
      if (normalizedType === 'signup') return 'signup';
      if (normalizedType === 'email') return 'email';
      if (normalizedType === 'email_change') return 'email_change';
      return null;
    };

    const normalizeSignal = (value: string | null) => value?.trim() ?? '';
    const isPkceVerifierMissingError = (message: string) => {
      const normalized = message.toLowerCase();
      return normalized.includes('code verifier') || normalized.includes('both auth code and code verifier');
    };

    const redirectAuthenticatedUser = async (
      sessionUser: SessionUser | null,
      callbackRecoveryType: 'recovery' | 'signup' | 'other'
    ) => {
      if (!sessionUser) {
        setError(INVALID_LINK_MESSAGE);
        setIsLinkIssue(true);
        return;
      }

      const {
        data: { session },
      } = await withTimeout(supabase.auth.getSession(), AUTH_CALLBACK_TIMEOUT_MS);
      writeRouteAuthCookie(session);

      let onboardingPath: string | null = null;
      let onboardingStatus: string | null = null;
      const shouldInitializeOnboarding = callbackRecoveryType === 'signup' || hasSignupOnboardingMetadata(sessionUser);

      if (shouldInitializeOnboarding && session?.access_token) {
        const initResponse = await fetch('/api/onboarding/init', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + session.access_token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ forceRegenerateToken: false }),
        }).catch(() => null);

        if (initResponse?.ok) {
          const initData = await initResponse.json().catch(() => null) as { onboardingUrl?: string; status?: string } | null;
          onboardingStatus = initData?.status ?? null;
          if (initData?.onboardingUrl) {
            try {
              const url = new URL(initData.onboardingUrl);
              onboardingPath = `${url.pathname}${url.search}`;
            } catch {
              onboardingPath = initData.onboardingUrl.startsWith('/') ? initData.onboardingUrl : null;
            }
          }
        }
      }

      const result = await withTimeout(resolveAuthenticatedUser(sessionUser), AUTH_CALLBACK_TIMEOUT_MS);
      if (!result.user) {
        if (onboardingPath) {
          const normalizedStatus = (onboardingStatus ?? '').toLowerCase();
          const pendingReviewStatuses = new Set(['under_review', 'request_changes']);
          router.replace(pendingReviewStatuses.has(normalizedStatus) ? '/pending-approval' : onboardingPath);
          return;
        }
        router.replace('/forbidden');
        return;
      }

      if (onboardingPath && onboardingStatus && onboardingStatus !== 'approved') {
        const normalizedStatus = onboardingStatus.toLowerCase();
        const pendingReviewStatuses = new Set(['under_review', 'request_changes']);
        router.replace(pendingReviewStatuses.has(normalizedStatus) ? '/pending-approval' : onboardingPath);
        return;
      }

      router.replace(onboardingPath ?? getPostLoginRoute(result.user));
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
        const hasAnyAuthSignal = hasSessionTokens || hasCode || hasTokenHash;
        const callbackRecoveryType = getCallbackRecoveryType(signals.queryType, signals.hashType, signals.flow);
        const otpType = getOtpType(signals.queryType, signals.hashType, signals.flow) ?? 'recovery';
        setRecoveryType(callbackRecoveryType);

        let sessionUser: SessionUser | null = null;
        let consumedBrowserTokens = false;
        let verifiedOtpType: OtpType | null = null;

        const {
          data: { session: existingSession },
          error: existingSessionError,
        } = await withTimeout(supabase.auth.getSession(), AUTH_CALLBACK_TIMEOUT_MS);
        if (existingSessionError) throw existingSessionError;
        sessionUser = existingSession?.user ?? null;

        if (!sessionUser && !hasAnyAuthSignal) {
          setError(INVALID_LINK_MESSAGE);
          setIsLinkIssue(true);
          return;
        }

        if (!sessionUser && hasSessionTokens) {
          const { data: setSessionData } = await withTimeout(
            supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            }),
            AUTH_CALLBACK_TIMEOUT_MS
          );
          if (setSessionData.user) {
            sessionUser = setSessionData.user;
            consumedBrowserTokens = true;
          }
        }

        if (!sessionUser && hasCode) {
          const { data: exchangeData, error: exchangeError } = await withTimeout(
            supabase.auth.exchangeCodeForSession(code),
            AUTH_CALLBACK_TIMEOUT_MS
          );
          if (exchangeError) {
            if (isPkceVerifierMissingError(exchangeError.message)) {
              setError(
                'This sign-in link cannot be completed in this browser session. Please request a new link and open it in the same browser.'
              );
              setIsLinkIssue(true);
              return;
            }
          }
          if (exchangeData.user) {
            sessionUser = exchangeData.user;
            consumedBrowserTokens = true;
          }
        }

        if (!sessionUser && hasTokenHash) {
          const { data: verifyData, error: verifyError } = await withTimeout(
            supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: otpType,
            }),
            AUTH_CALLBACK_TIMEOUT_MS
          );
          if (!verifyError && verifyData.user) {
            sessionUser = verifyData.user;
            verifiedOtpType = otpType;
            consumedBrowserTokens = true;
          }
        }

        if (consumedBrowserTokens) {
          clearBrowserTokens('/auth/callback');
        }

        if (!sessionUser) {
          setError(
            callbackRecoveryType === 'recovery'
              ? `${INVALID_LINK_MESSAGE} Reopen the reset flow and request a new reset link.`
              : callbackRecoveryType === 'signup'
                ? `${INVALID_LINK_MESSAGE} Return to sign in or register and request a fresh confirmation link.`
                : INVALID_LINK_MESSAGE
          );
          setIsLinkIssue(true);
          return;
        }

        if (verifiedOtpType === 'invite' || verifiedOtpType === 'recovery') {
          router.replace(RESET_PASSWORD_PATH);
          return;
        }

        await redirectAuthenticatedUser(sessionUser, callbackRecoveryType);
      } catch (err) {
        clearRouteAuthCookie();
        const message = err instanceof Error ? err.message : 'Authentication callback failed.';
        setError(
          isPkceVerifierMissingError(message)
            ? 'This sign-in link cannot be completed in this browser session. Please request a new link and open it in the same browser.'
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
        <h1 style={{ marginBottom: '1rem' }}>{isLinkIssue ? 'Link issue detected' : 'Completing sign-in…'}</h1>
        {error && <p style={{ color: '#dc2626' }}>{error}</p>}
        {isLinkIssue && (
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {recoveryType === 'recovery' ? (
              <button
                type="button"
                onClick={() => router.replace('/login')}
                style={{
                  padding: '0.75rem 1.25rem',
                  backgroundColor: '#1F7A3D',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Request a new reset link
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => router.replace('/login')}
                  style={{
                    padding: '0.75rem 1.25rem',
                    backgroundColor: '#1F7A3D',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  Back to sign in
                </button>
                <button
                  type="button"
                  onClick={() => router.replace('/register')}
                  style={{
                    padding: '0.75rem 1.25rem',
                    backgroundColor: '#1d4ed8',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  Go to register
                </button>
              </>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
