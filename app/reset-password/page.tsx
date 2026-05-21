'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';

const SESSION_DETECT_TIMEOUT_MS = 15_000;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const sessionConfirmedRef = useRef(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError('Authentication is unavailable: Supabase is not configured.');
      setIsCheckingSession(false);
      return;
    }

    console.log('[reset-password] page loaded, url:', typeof window !== 'undefined' ? window.location.href : '');

    const confirmSession = () => {
      if (sessionConfirmedRef.current) return;
      sessionConfirmedRef.current = true;
      console.log('[reset-password] recovery session confirmed — showing password form');
      setHasRecoverySession(true);
      setIsCheckingSession(false);
    };

    const failSession = (reason: string) => {
      if (sessionConfirmedRef.current) return;
      console.warn('[reset-password] session not confirmed:', reason);
      setError('Recovery link is invalid or expired. Please request a new password reset email.');
      setHasRecoverySession(false);
      setIsCheckingSession(false);
    };

    // 1. Subscribe to auth state changes FIRST, before any token exchange.
    //    When Supabase processes a recovery token it fires PASSWORD_RECOVERY.
    //    When it processes a PKCE code it fires SIGNED_IN.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[reset-password] onAuthStateChange event:', event, 'userId:', session?.user?.id ?? 'none');
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session?.user)) {
        confirmSession();
      }
    });

    // 2. Detect URL params and kick off token exchange.
    const init = async () => {
      const queryParams = new URLSearchParams(window.location.search);
      const code = queryParams.get('code');
      const tokenHash = queryParams.get('token_hash');
      const hashParams = window.location.hash
        ? new URLSearchParams(window.location.hash.replace(/^#/, ''))
        : null;
      const accessToken = hashParams?.get('access_token');
      const refreshToken = hashParams?.get('refresh_token');

      console.log('[reset-password] detected params:', {
        hasCode: Boolean(code),
        hasTokenHash: Boolean(tokenHash),
        hasHashTokens: Boolean(accessToken),
      });

      // Case A: PKCE code (modern Supabase default) — redirectTo lands ?code=xxx here
      if (code) {
        console.log('[reset-password] exchanging PKCE code for session');
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          console.error('[reset-password] exchangeCodeForSession failed:', exchangeError.message);
          failSession(exchangeError.message);
          // Remove the code from the URL to prevent re-use on refresh
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, '', cleanUrl);
        }
        // onAuthStateChange will fire SIGNED_IN/PASSWORD_RECOVERY → confirmSession()
        return;
      }

      // Case B: Legacy hash tokens — Supabase detectSessionInUrl auto-processes these.
      //         The PASSWORD_RECOVERY event fires automatically; nothing to do explicitly.
      if (accessToken && refreshToken) {
        console.log('[reset-password] hash tokens present — Supabase will auto-process via detectSessionInUrl');
        // onAuthStateChange will fire PASSWORD_RECOVERY → confirmSession()
        return;
      }

      // Case C: token_hash (email OTP format)
      if (tokenHash) {
        console.log('[reset-password] verifying token_hash OTP');
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'recovery',
        });
        if (verifyError) {
          console.error('[reset-password] verifyOtp failed:', verifyError.message);
          failSession(verifyError.message);
        }
        // onAuthStateChange → confirmSession() on success
        return;
      }

      // Case D: No URL params — check if there is already an active recovery session
      //         (e.g. page refresh after token was already exchanged)
      console.log('[reset-password] no URL params — checking existing session');
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('[reset-password] getSession error:', sessionError.message);
        failSession(sessionError.message);
        return;
      }
      if (data.session?.user) {
        console.log('[reset-password] existing session found, userId:', data.session.user.id);
        confirmSession();
      } else {
        // No session, no tokens — link is invalid or expired
        failSession('no session and no recovery params in URL');
      }
    };

    // 3. Set a timeout so we never leave the user on the loading spinner forever.
    const timeoutId = setTimeout(() => {
      if (!sessionConfirmedRef.current) {
        failSession('session detection timed out after ' + SESSION_DETECT_TIMEOUT_MS + 'ms');
      }
    }, SESSION_DETECT_TIMEOUT_MS);

    void init();

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
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
      console.log('[reset-password] calling updateUser to set new password');
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        console.error('[reset-password] updateUser failed:', updateError.message);
        setError(updateError.message);
        return;
      }

      console.log('[reset-password] password updated — signing out and redirecting to /login');
      await supabase.auth.signOut();
      setSuccess('Password updated successfully. Redirecting to sign in…');
      setTimeout(() => router.replace('/login'), 1200);
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingSession) {
    return (
      <main>
        <section style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <h1 style={{ marginBottom: '1rem' }}>Preparing password reset…</h1>
          <p style={{ color: '#5B6B85' }}>Verifying your recovery link…</p>
        </section>
      </main>
    );
  }

  if (!hasRecoverySession) {
    return (
      <main>
        <section style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <h1 style={{ marginBottom: '1rem' }}>Password reset link issue</h1>
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
        <h1 style={{ marginTop: 0, marginBottom: '0.75rem', color: '#0A2239' }}>Set a new password</h1>
        <p style={{ marginTop: 0, marginBottom: '1.5rem', color: '#5B6B85' }}>
          Enter your new password to complete account recovery.
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
