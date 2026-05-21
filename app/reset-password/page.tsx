'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LOGIN_RESET_SUCCESS_PATH,
  getBrowserAuthSignals,
  isInviteAuthFlow,
} from '../../lib/authFlow';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hasPasswordSetupSession, setHasPasswordSetupSession] = useState(false);
  const [isInviteFlow, setIsInviteFlow] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
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
        if (signals) {
          setIsInviteFlow(isInviteAuthFlow(signals));
        }

        const { data: initialSession, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (!initialSession.session?.user && signals?.hasHashSessionTokens && signals.accessToken && signals.refreshToken) {
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: signals.accessToken,
            refresh_token: signals.refreshToken,
          });
          if (setSessionError) throw setSessionError;
          clearBrowserTokens();
        } else if (!initialSession.session?.user && signals?.code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(signals.code);
          if (exchangeError) throw exchangeError;
          clearBrowserTokens();
        } else if (!initialSession.session?.user && signals?.tokenHash) {
          const otpType = isInviteAuthFlow(signals) ? 'invite' : 'recovery';
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: signals.tokenHash,
            type: otpType,
          });
          if (verifyError) throw verifyError;
          clearBrowserTokens();
        }

        const { data: checkedSession, error: checkedSessionError } = await supabase.auth.getSession();
        if (checkedSessionError) throw checkedSessionError;

        if (!checkedSession.session?.user) {
          setError('Password setup link is invalid or expired. Please request a new email.');
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
            Back to sign in
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
          {isInviteFlow ? 'Set your password' : 'Set a new password'}
        </h1>
        <p style={{ marginTop: 0, marginBottom: '1.5rem', color: '#5B6B85' }}>
          {isInviteFlow
            ? 'Choose your password to finish account setup.'
            : 'Enter your new password to complete account recovery.'}
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
