'use client';

import { useState, type FormEvent, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../components/AuthContext';
import { buildPathWithAuthParams, getBrowserAuthSignals, isRecoveryAuthFlow, RESET_PASSWORD_PATH } from '../../lib/authFlow';
import { getPostLoginRoute, roleCanAccessPath } from '../../lib/authSession';
import { COMPANY_CONFIG } from '../config/company';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const { login, resetPassword, user, isLoading: authLoading } = useAuth();
  const nextPath = searchParams.get('next');
  const safeNextPath = nextPath && nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : null;

  useEffect(() => {
    const signals = getBrowserAuthSignals();
    if (!signals || !isRecoveryAuthFlow(signals)) return;
    router.replace(buildPathWithAuthParams(RESET_PASSWORD_PATH, signals));
  }, [router]);

  useEffect(() => {
    if (authLoading || !user) return;
    const canonicalRoute = getPostLoginRoute(user);
    const destination = safeNextPath && roleCanAccessPath(user, safeNextPath) ? safeNextPath : canonicalRoute;
    router.replace(destination);
  }, [authLoading, user, router, safeNextPath]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await login(email, password);
      if (!result.success) {
        setError(result.error || 'Login failed');
        return;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetMessage('');
    setResetLoading(true);
    const result = await resetPassword(resetEmail);
    setResetLoading(false);
    if (result.success) {
      setResetMessage('Password reset email sent. Please check your inbox.');
    } else {
      setResetError(result.error || 'Failed to send reset email.');
    }
  };

  const handleShowReset = () => {
    setShowReset(true);
    setError('');
    setResetEmail(email);
  };

  const handleBackToSignIn = () => {
    setShowReset(false);
    setResetMessage('');
    setResetError('');
  };

  const showResetSuccess = searchParams.get('reset') === 'success';

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a1324',
        padding: '1rem',
      }}
    >
      <div className="login-shell">
        <div className="login-hero" aria-hidden="true" />
        <div className="login-form-panel">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <Image src="/xdrive-logo.svg" alt="XDrive Logistics" width={180} height={40} priority style={{ width: 'auto', height: '40px' }} />
          </div>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: '700',
            color: '#0A2239',
            marginBottom: '0.5rem'
          }}>
            {COMPANY_CONFIG.name}
          </h1>
          <p style={{ color: '#5B6B85', fontSize: '0.95rem' }}>
            {showReset ? 'Reset your password' : 'Sign in to your account'}
          </p>
        </div>

        {showResetSuccess && !showReset && (
          <div style={{
            padding: '0.75rem',
            marginBottom: '1.5rem',
            backgroundColor: '#dcfce7',
            color: '#166534',
            borderRadius: '6px',
            fontSize: '0.9rem',
            border: '1px solid #bbf7d0'
          }}>
            Password updated successfully. Sign in with your new password.
          </div>
        )}

        {!showReset ? (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="email" style={{
                display: 'block',
                marginBottom: '0.5rem',
                color: '#0B1B33',
                fontWeight: '500',
                fontSize: '0.95rem'
              }}>
                Email Address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid rgba(14, 36, 72, 0.12)',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  transition: 'border-color 0.2s',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#1E4E8C'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(14, 36, 72, 0.12)'}
              />
            </div>

            <div style={{ marginBottom: '0.5rem' }}>
              <label htmlFor="password" style={{
                display: 'block',
                marginBottom: '0.5rem',
                color: '#0B1B33',
                fontWeight: '500',
                fontSize: '0.95rem'
              }}>
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid rgba(14, 36, 72, 0.12)',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  transition: 'border-color 0.2s',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#1E4E8C'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(14, 36, 72, 0.12)'}
              />
            </div>

            <div style={{ textAlign: 'right', marginBottom: '1.5rem' }}>
              <button
                type="button"
                onClick={handleShowReset}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#1E4E8C',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline'
                }}
              >
                Forgot password?
              </button>
            </div>

            {error && (
              <div style={{
                padding: '0.75rem',
                marginBottom: '1.5rem',
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                borderRadius: '6px',
                fontSize: '0.9rem',
                border: '1px solid #fecaca'
              }}>
                {error}
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
                transition: 'background-color 0.2s'
              }}
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>

            <p style={{ marginTop: '1rem', marginBottom: 0, color: '#5B6B85', textAlign: 'center' }}>
              Need an account?{' '}
              <Link href="/register" style={{ color: '#1E4E8C', fontWeight: 600 }}>
                Register
              </Link>
            </p>
          </form>
        ) : (
          <form onSubmit={handleResetPassword}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="reset-email" style={{
                display: 'block',
                marginBottom: '0.5rem',
                color: '#0B1B33',
                fontWeight: '500',
                fontSize: '0.95rem'
              }}>
                Email Address
              </label>
              <input
                id="reset-email"
                type="email"
                autoComplete="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                disabled={resetLoading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid rgba(14, 36, 72, 0.12)',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  transition: 'border-color 0.2s',
                  outline: 'none'
                }}
              />
            </div>

            {resetError && (
              <div style={{
                padding: '0.75rem',
                marginBottom: '1.5rem',
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                borderRadius: '6px',
                fontSize: '0.9rem',
                border: '1px solid #fecaca'
              }}>
                {resetError}
              </div>
            )}

            {resetMessage && (
              <div style={{
                padding: '0.75rem',
                marginBottom: '1.5rem',
                backgroundColor: '#dcfce7',
                color: '#166534',
                borderRadius: '6px',
                fontSize: '0.9rem',
                border: '1px solid #bbf7d0'
              }}>
                {resetMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={resetLoading}
              style={{
                width: '100%',
                padding: '0.875rem',
                backgroundColor: resetLoading ? '#86efac' : '#1F7A3D',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: resetLoading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              {resetLoading ? 'Sending...' : 'Send Reset Email'}
            </button>

            <p style={{ marginTop: '1rem', marginBottom: 0, textAlign: 'center' }}>
              <button
                type="button"
                onClick={handleBackToSignIn}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#1E4E8C',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Back to sign in
              </button>
            </p>
          </form>
        )}
      </div>
      </div>
      <style jsx>{`
        .login-shell {
          width: 100%;
          max-width: 1180px;
          min-height: 720px;
          border-radius: 16px;
          overflow: hidden;
          display: grid;
          grid-template-columns: 1.25fr 0.95fr;
          box-shadow: 0 20px 45px rgba(4, 10, 24, 0.45);
          background: #ffffff;
        }

        .login-hero {
          background-image: linear-gradient(180deg, rgba(10, 22, 45, 0.12) 0%, rgba(10, 22, 45, 0.58) 100%), url('/xdrive-login-banner.png');
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
        }

        .login-form-panel {
          background: #ffffff;
          padding: 2.5rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        @media (max-width: 960px) {
          .login-shell {
            min-height: auto;
            grid-template-columns: 1fr;
            max-width: 430px;
          }

          .login-hero {
            display: none;
          }

          .login-form-panel {
            padding: 2rem;
          }
        }
      `}</style>
    </div>
  );
}
