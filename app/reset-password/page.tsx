'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LOGIN_RESET_SUCCESS_PATH, getBrowserAuthSignals } from '../../lib/authFlow';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hasPasswordSetupSession, setHasPasswordSetupSession] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const INVALID_RESET_LINK_MESSAGE =
      'The link is invalid, expired, or has already been used. Please request a new link.';
    const normalizeSignal = (value: string | null) => value?.trim() ?? '';
    const isPkceVerifierMissingError = (message: string) => {
      const normalized = message.toLowerCase();
      return normalized.includes('code verifier') || normalized.includes('both auth code and code verifier');
    };
    const getOtpType = (queryType: string | null, hashType: string | null, flow: string | null) => {
      const normalizedType = (queryType ?? hashType ?? flow ?? '').trim().toLowerCase();
      if (normalizedType === 'invite') return 'invite' as const;
      if (normalizedType === 'recovery') return 'recovery' as const;
      return 'recovery' as const;
    };

    const clearBrowserTokens = () => {
      if (typeof window === 'undefined') return;
      window.history.replaceState(null, '', '/reset-password');
    };

    const preparePasswordSetupSession = async () => {
      if (!isSupabaseConfigured) {
        setError('Authentication is unavailable: Supabase is not configured.');
        setIsCheckingSession(false);
        return;
      }

      try {
        const signals = getBrowserAuthSignals();
        const accessToken = normalizeSignal(signals?.accessToken ?? null);
        const refreshToken = normalizeSignal(signals?.refreshToken ?? null);
        const code = normalizeSignal(signals?.code ?? null);
        const tokenHash = normalizeSignal(signals?.tokenHash ?? null);
        const otpType = getOtpType(signals?.queryType ?? null, signals?.hashType ?? null, signals?.flow ?? null);
        const hasSessionTokens = Boolean(accessToken && refreshToken);
        const hasCode = Boolean(code);
        const hasTokenHash = Boolean(tokenHash);
        const hasAnyAuthSignal = hasSessionTokens || hasCode || hasTokenHash;

        const { data: initialSession, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        let handoffSucceeded = false;

        if (!initialSession.session?.user && !hasAnyAuthSignal) {
          setError(INVALID_RESET_LINK_MESSAGE);
          setHasPasswordSetupSession(false);
          setIsCheckingSession(false);
          return;
        }

        if (!initialSession.session?.user && hasAnyAuthSignal) {
          if (hasSessionTokens) {
            const { data: setSessionData } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (setSessionData.user) {
              handoffSucceeded = true;
            }
          }

          if (!handoffSucceeded && hasCode) {
            const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            if (exchangeError && isPkceVerifierMissingError(exchangeError.message)) {
              setError(
                'This reset link cannot be completed in this browser session. Please request a new reset link and open it in the same browser.'
              );
              setHasPasswordSetupSession(false);
              setIsCheckingSession(false);
              return;
            }
            if (exchangeData.user) {
              handoffSucceeded = true;
            }
          }

          if (!handoffSucceeded && hasTokenHash) {
            const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: otpType,
            });
            if (!verifyError && verifyData.user) {
              handoffSucceeded = true;
            }
          }
        }

        if (handoffSucceeded) {
          clearBrowserTokens();
        }

        const { data: checkedSession, error: checkedSessionError } = await supabase.auth.getSession();
        if (checkedSessionError) throw checkedSessionError;

        if (!checkedSession.session?.user) {
          setError(INVALID_RESET_LINK_MESSAGE);
          setHasPasswordSetupSession(false);
          setIsCheckingSession(false);
          return;
        }

        setHasPasswordSetupSession(true);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Password setup failed.';
        setError(message);
        setHasPasswordSetupSession(false);
      } finally {
        setIsCheckingSession(false);
      }
    };

    void preparePasswordSetupSession();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }

      await supabase.auth.signOut();
      setSuccess('Password updated successfully. Redirecting to sign in…');
      setTimeout(() => router.replace(LOGIN_RESET_SUCCESS_PATH), 1200);
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingSession) {
    return (
      <main>
        <section style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <h1 style={{ marginBottom: '1rem' }}>Preparing password setup…</h1>
        </section>
      </main>
    );
  }

  if (!hasPasswordSetupSession) {
    return (
      <main>
        <section style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <h1 style={{ marginBottom: '1rem' }}>Password setup link issue</h1>
          {error && <p style={{ color: '#dc2626', marginBottom: '1rem' }}>{error}</p>}
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
        </section>
      </main>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0A2239 0%, #1E4E8C 100%)',
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: 'white',
          padding: '2.5rem',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
          width: '100%',
          maxWidth: '420px',
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: '0.75rem', color: '#0A2239' }}>
          Set a new password
        </h1>
        <p style={{ marginTop: 0, marginBottom: '1.5rem', color: '#5B6B85' }}>
          Enter your new password to complete password setup.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="new-password" style={{ display: 'block', marginBottom: '0.5rem', color: '#0B1B33' }}>
              New password
            </label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              minLength={8}
              autoComplete="new-password"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid rgba(14, 36, 72, 0.12)',
                borderRadius: '6px',
                fontSize: '1rem',
              }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="confirm-password" style={{ display: 'block', marginBottom: '0.5rem', color: '#0B1B33' }}>
              Confirm new password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isLoading}
              minLength={8}
              autoComplete="new-password"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid rgba(14, 36, 72, 0.12)',
                borderRadius: '6px',
                fontSize: '1rem',
              }}
            />
          </div>

          {error && (
            <div
              style={{
                padding: '0.75rem',
                marginBottom: '1rem',
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                borderRadius: '6px',
                fontSize: '0.9rem',
                border: '1px solid #fecaca',
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              style={{
                padding: '0.75rem',
                marginBottom: '1rem',
                backgroundColor: '#dcfce7',
                color: '#166534',
                borderRadius: '6px',
                fontSize: '0.9rem',
                border: '1px solid #bbf7d0',
              }}
            >
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '0.875rem',
              backgroundColor: isLoading ? '#86efac' : '#1F7A3D',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {isLoading ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
