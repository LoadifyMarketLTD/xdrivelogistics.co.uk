'use client';

import { useState, type FormEvent, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../components/AuthContext';
import { buildPathWithAuthParams, getBrowserAuthSignals, isRecoveryAuthFlow, RESET_PASSWORD_PATH } from '../../lib/authFlow';
import { getPostLoginRoute, roleCanAccessPath } from '../../lib/authSession';

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
  const [heroImageSrc, setHeroImageSrc] = useState('/xdrive-login-hero.webp.jpeg');
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
    <div className="login-page">
      <div className="login-shell">
        <section className="login-hero" aria-label="XDrive logistics platform introduction">
          <img
            src={heroImageSrc}
            alt="XDrive Logistics hero"
            className="login-hero-image"
            onError={() => setHeroImageSrc('/xdrive-login-banner.png')}
          />
        </section>
        <aside className="login-form-panel">
        <div className="login-form-inner">
        <div className="login-logo-row">
          <Image src="/xdrive-logo.jpeg" alt="XDrive Logistics" width={168} height={40} priority />
        </div>
        <div className="login-form-header">
          <h2>{showReset ? 'Reset your password' : 'Welcome Back'}</h2>
          <p>{showReset ? 'Enter your email to receive reset instructions' : 'Sign in to your account'}</p>
        </div>

        {showResetSuccess && !showReset && (
          <div className="login-message success">
            Password updated successfully. Sign in with your new password.
          </div>
        )}

        {!showReset ? (
          <form onSubmit={handleSubmit} className="login-form">
            <div className="field-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                required
                disabled={isLoading}
              />
            </div>

            <div className="field-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                disabled={isLoading}
              />
            </div>

            <div className="forgot-row">
              <button
                type="button"
                onClick={handleShowReset}
                className="link-button"
              >
                Forgot password?
              </button>
            </div>

            {error && (
              <div className="login-message error">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="signin-button"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>

            <p className="register-row">
              Need an account?{' '}
              <Link href="/register">
                Register
              </Link>
            </p>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="login-form">
            <div className="field-group">
              <label htmlFor="reset-email">Email Address</label>
              <input
                id="reset-email"
                type="email"
                autoComplete="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="Enter your email address"
                required
                disabled={resetLoading}
              />
            </div>

            {resetError && (
              <div className="login-message error">
                {resetError}
              </div>
            )}

            {resetMessage && (
              <div className="login-message success">
                {resetMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={resetLoading}
              className="signin-button"
            >
              {resetLoading ? 'Sending...' : 'Send Reset Email'}
            </button>

            <p className="register-row">
              <button
                type="button"
                onClick={handleBackToSignIn}
                className="link-button"
              >
                Back to sign in
              </button>
            </p>
          </form>
        )}
        </div>
      </aside>
    </div>
      <style jsx>{`
        .login-page {
          width: 100vw;
          height: 100vh;
          margin: 0;
          padding: 0;
          background: #ffffff;
          overflow: hidden;
        }

        .login-shell {
          width: 100vw;
          height: 100vh;
          display: grid;
          grid-template-columns: 70% 30%;
        }

        .login-hero {
          width: 100%;
          min-height: 100vh;
          height: 100%;
          overflow: hidden;
        }

        .login-hero-image {
          width: 100%;
          height: 100%;
          min-height: 100vh;
          object-fit: cover;
          object-position: center;
          display: block;
        }

        .login-form-panel {
          background: #ffffff;
          padding: 2rem 2.2rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
          height: 100vh;
          min-width: 420px;
          overflow-y: auto;
        }

        .login-form-inner {
          width: 100%;
          max-width: 440px;
          margin: 0 auto;
        }

        .login-logo-row {
          margin-bottom: 1.5rem;
        }

        .login-form-header h2 {
          margin: 0 0 0.6rem;
          color: #111827;
          font-size: clamp(1.9rem, 2vw, 2.4rem);
          line-height: 1.05;
          letter-spacing: -0.02em;
        }

        .login-form-header p {
          margin: 0 0 1.7rem;
          color: #4b5563;
          font-size: 1rem;
          line-height: 1.4;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .field-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .field-group label {
          margin: 0;
          color: #111827;
          font-size: 0.96rem;
          font-weight: 600;
        }

        .field-group :global(input) {
          width: 100%;
          border: 1px solid #d6dbe3;
          border-radius: 0.65rem;
          background: #ffffff;
          color: #111827;
          font-size: 1rem;
          line-height: 1.2;
          padding: 0.95rem 1rem;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .field-group :global(input:focus) {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
        }

        .forgot-row {
          display: flex;
          justify-content: flex-end;
        }

        .link-button {
          border: none;
          background: none;
          color: #2563eb;
          font-size: 0.96rem;
          font-weight: 500;
          padding: 0;
          cursor: pointer;
        }

        .signin-button {
          width: 100%;
          border: none;
          border-radius: 0.7rem;
          padding: 0.92rem 1rem;
          background: #1d64d8;
          color: #ffffff;
          font-size: 1.15rem;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .signin-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .signin-button:not(:disabled):hover {
          background: #1553c0;
        }

        .register-row {
          margin: 0.1rem 0 0;
          text-align: center;
          color: #4b5563;
        }

        .register-row :global(a) {
          color: #2563eb;
          font-weight: 600;
        }

        .login-message {
          padding: 0.75rem;
          border-radius: 0.55rem;
          font-size: 0.9rem;
          border: 1px solid transparent;
        }

        .login-message.error {
          background: #fee2e2;
          color: #dc2626;
          border-color: #fecaca;
        }

        .login-message.success {
          background: #dcfce7;
          color: #166534;
          border-color: #bbf7d0;
        }

        @media (max-width: 1400px) and (min-width: 961px) {
          .login-shell {
            grid-template-columns: 60% 40%;
          }
        }

        @media (max-width: 960px) {
          .login-shell {
            grid-template-columns: 1fr;
            grid-template-rows: 40vh minmax(60vh, auto);
            min-height: 100vh;
            height: auto;
            width: 100%;
          }

          .login-hero {
            min-height: 0;
            height: 40vh;
          }

          .login-hero-image {
            min-height: 0;
            height: 100%;
          }

          .login-form-panel {
            padding: 1.75rem 1.25rem;
            min-height: 60vh;
            height: auto;
            min-width: 0;
            border-left: none;
          }

          .login-form-inner {
            max-width: 560px;
          }

          .login-form-header h2 {
            font-size: 2rem;
          }

          .signin-button {
            font-size: 1.35rem;
          }
        }
      `}</style>
    </div>
  );
}
