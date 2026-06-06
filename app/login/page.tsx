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
  const marketingHighlights = [
    'Built by logistics professionals',
    'Secure. Compliant. Reliable.',
    'Designed for real-world operations',
  ];
  const platformStats = [
    { value: '15K+', label: 'Jobs Managed' },
    { value: '2K+', label: 'Active Users' },
    { value: '98%', label: 'On-Time Delivery' },
    { value: '100%', label: 'POD Accuracy' },
  ];

  return (
    <div className="login-page">
      <div className="login-shell">
        <section className="login-hero" aria-label="XDrive logistics platform introduction">
          <div className="login-hero-overlay">
            <div className="login-hero-top">
              <Image src="/xdrive-logo.svg" alt="XDrive Logistics" width={168} height={40} priority />
            </div>

            <div className="login-hero-content">
              <p className="login-hero-pill">UK Logistics Technology Platform</p>
              <h1 className="login-hero-title">
                Move Freight.
                <br />
                Manage Operations.
                <br />
                <span>Grow Your Network.</span>
              </h1>
              <p className="login-hero-description">
                XDrive is an early-access logistics platform connecting transport customers, courier companies, owner
                operators and drivers in one operational workflow.
              </p>
              <ul className="login-hero-highlights">
                {marketingHighlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="login-hero-stats">
              {platformStats.map((stat) => (
                <div key={stat.label} className="login-hero-stat">
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
        <aside className="login-form-panel">
        <div className="login-form-inner">
        <div className="login-form-header">
          <h2>{showReset ? 'Reset your password' : 'Welcome back'}</h2>
          <p>{showReset ? 'Enter your email to receive reset instructions' : `Sign in to your ${COMPANY_CONFIG.name} account`}</p>
        </div>

        {showResetSuccess && !showReset && (
          <div className="login-message success">
            Password updated successfully. Sign in with your new password.
          </div>
        )}

        {!showReset ? (
          <form onSubmit={handleSubmit} className="login-form">
            <div className="field-group">
              <label htmlFor="email">Email Address</label>
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
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>

            <p className="register-row">
              Need an account?{' '}
              <Link href="/register">
                Register
              </Link>
            </p>

            <div className="continue-row">
              <span />
              <p>or continue with</p>
              <span />
            </div>

            <div className="oauth-row">
              <button type="button" className="oauth-button">Sign in with Google</button>
              <button type="button" className="oauth-button">Sign in with Microsoft</button>
            </div>

            <p className="secure-note">Your data is secure and encrypted</p>
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
          width: 100%;
          min-height: 100vh;
          margin: 0;
          padding: 0;
          background: #031f46;
        }

        .login-shell {
          width: 100%;
          height: 100vh;
          min-height: 100vh;
          display: grid;
          grid-template-columns: 70% 30%;
        }

        .login-hero {
          position: relative;
          isolation: isolate;
          background-image: linear-gradient(140deg, rgba(2, 33, 77, 0.72) 0%, rgba(4, 40, 90, 0.55) 38%, rgba(3, 22, 50, 0.35) 70%, rgba(2, 15, 35, 0.35) 100%), url('/xdrive-login-banner.png');
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          min-height: 100vh;
        }

        .login-hero-overlay {
          min-height: 100vh;
          padding: 2.25rem 3rem 2rem;
          display: flex;
          flex-direction: column;
          color: #ffffff;
        }

        .login-hero-top {
          margin-bottom: 2.75rem;
        }

        .login-hero-content {
          max-width: 560px;
        }

        .login-hero-pill {
          display: inline-flex;
          align-items: center;
          padding: 0.35rem 0.95rem;
          margin-bottom: 1.5rem;
          border: 1px solid rgba(163, 196, 255, 0.45);
          border-radius: 999px;
          font-size: 0.95rem;
          background: rgba(15, 65, 132, 0.28);
        }

        .login-hero-title {
          margin: 0;
          font-size: clamp(2.3rem, 3.45vw, 4rem);
          line-height: 1.1;
          color: #ffffff;
          letter-spacing: -0.02em;
        }

        .login-hero-title span {
          color: #f2c24b;
        }

        .login-hero-description {
          max-width: 520px;
          margin: 1.5rem 0 1.8rem;
          color: rgba(236, 245, 255, 0.94);
          font-size: 1.05rem;
          line-height: 1.65;
        }

        .login-hero-highlights {
          display: grid;
          gap: 0.85rem;
          margin: 0;
          padding: 0;
          list-style: none;
        }

        .login-hero-highlights li {
          padding: 0;
          color: #f4f8ff;
          font-size: 1.02rem;
          line-height: 1.35;
        }

        .login-hero-highlights li::before {
          content: '•';
          margin-right: 0.6rem;
          color: #f2c24b;
        }

        .login-hero-stats {
          margin-top: auto;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.7rem;
        }

        .login-hero-stat {
          padding: 0.8rem 0.95rem;
          border: 1px solid rgba(173, 206, 255, 0.2);
          background: rgba(1, 24, 58, 0.44);
          border-radius: 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }

        .login-hero-stat strong {
          font-size: clamp(1.4rem, 2vw, 2.1rem);
          color: #ffffff;
          line-height: 1.05;
        }

        .login-hero-stat span {
          color: rgba(219, 234, 255, 0.92);
          font-size: 0.9rem;
        }

        .login-form-panel {
          background: #ffffff;
          padding: 2rem 2.4rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-height: 100vh;
          border-left: 1px solid rgba(14, 36, 72, 0.12);
          overflow-y: auto;
        }

        .login-form-inner {
          width: 100%;
          max-width: 460px;
          margin: 0 auto;
        }

        .login-form-header h2 {
          margin: 0 0 0.6rem;
          color: #111827;
          font-size: clamp(2rem, 2.15vw, 2.6rem);
          line-height: 1.05;
          letter-spacing: -0.02em;
        }

        .login-form-header p {
          margin: 0 0 2rem;
          color: #4b5563;
          font-size: 1.08rem;
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
          font-size: 1.55rem;
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

        .continue-row {
          margin-top: 0.2rem;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 0.8rem;
        }

        .continue-row span {
          height: 1px;
          background: #e5e7eb;
        }

        .continue-row p {
          margin: 0;
          color: #6b7280;
          font-size: 1rem;
        }

        .oauth-row {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.7rem;
        }

        .oauth-button {
          border: 1px solid #d5dae3;
          background: #ffffff;
          border-radius: 0.7rem;
          padding: 0.85rem 0.6rem;
          color: #111827;
          font-size: 0.95rem;
          font-weight: 500;
          cursor: pointer;
        }

        .secure-note {
          margin: 0.4rem 0 0;
          text-align: center;
          color: #4b5563;
          font-size: 0.96rem;
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

        @media (max-width: 960px) {
          .login-shell {
            grid-template-columns: 1fr;
            min-height: 100vh;
            height: auto;
          }

          .login-hero {
            display: none;
          }

          .login-form-panel {
            padding: 1.75rem 1.25rem;
            min-height: 100vh;
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

          .oauth-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
