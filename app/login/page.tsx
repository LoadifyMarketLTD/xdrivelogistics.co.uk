'use client';

import { useState, type FormEvent, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../components/AuthContext';
import { buildPathWithAuthParams, getBrowserAuthSignals, isRecoveryAuthFlow, RESET_PASSWORD_PATH } from '../../lib/authFlow';
import { getPostLoginRoute, roleCanAccessPath } from '../../lib/authSession';
import styles from './login.module.css';

const MailIcon = () => (
  <svg className={styles.inputIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 6.75h16v10.5H4V6.75Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="m5 8 7 5 7-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const LockIcon = () => (
  <svg className={styles.inputIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M7 10V8a5 5 0 0 1 10 0v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M5.5 10h13v10h-13V10Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
);

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

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await login(email, password);
      if (!result.success) {
        setError(result.error || 'Login failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (event: FormEvent) => {
    event.preventDefault();
    setResetError('');
    setResetMessage('');
    setResetLoading(true);

    try {
      const result = await resetPassword(resetEmail);
      if (result.success) {
        setResetMessage('Password reset email sent. Please check your inbox.');
      } else {
        setResetError(result.error || 'Failed to send reset email.');
      }
    } finally {
      setResetLoading(false);
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
    <main className={styles.loginPage}>
      <div className={styles.loginShell}>
        <section className={styles.loginHero} aria-label="XDrive Logistics operations centre">
          <Image
            src="/login-hero-operations-centre.webp"
            alt="XDrive Logistics operations centre"
            fill
            priority
            sizes="(max-width: 820px) 100vw, 62vw"
            className={styles.loginHeroImage}
          />
        </section>

        <aside className={styles.loginFormPanel}>
          <div className={styles.loginFormInner}>
            <div className={styles.loginLogoRow}>
              <Image
                src="/xdrive-logo-horizontal.png"
                alt="XDrive Logistics"
                width={300}
                height={84}
                priority
                className={styles.loginLogo}
              />
            </div>

            <header className={styles.loginFormHeader}>
              <h2>{showReset ? 'Reset your password' : 'Welcome Back'}</h2>
              <p>{showReset ? 'Enter your email to receive reset instructions' : 'Sign in to your account to continue'}</p>
            </header>

            {showResetSuccess && !showReset && (
              <div className={`${styles.loginMessage} ${styles.success}`} role="status">
                Password updated successfully. Sign in with your new password.
              </div>
            )}

            {!showReset ? (
              <form onSubmit={handleSubmit} className={styles.loginForm}>
                <div className={styles.fieldGroup}>
                  <label htmlFor="email">Email</label>
                  <div className={styles.inputWrap}>
                    <MailIcon />
                    <input
                      id="email"
                      type="email"
                      autoComplete="username"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="Enter your email address"
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className={styles.fieldGroup}>
                  <label htmlFor="password">Password</label>
                  <div className={styles.inputWrap}>
                    <LockIcon />
                    <input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Enter your password"
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className={styles.forgotRow}>
                  <button type="button" onClick={handleShowReset} className={styles.linkButton}>
                    Forgot password?
                  </button>
                </div>

                {error && (
                  <div className={`${styles.loginMessage} ${styles.error}`} role="alert">
                    {error}
                  </div>
                )}

                <button type="submit" disabled={isLoading} className={styles.signinButton}>
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </button>

                <p className={styles.registerRow}>
                  Need an account? <Link href="/register">Register</Link>
                </p>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className={styles.loginForm}>
                <div className={styles.fieldGroup}>
                  <label htmlFor="reset-email">Email Address</label>
                  <div className={styles.inputWrap}>
                    <MailIcon />
                    <input
                      id="reset-email"
                      type="email"
                      autoComplete="email"
                      value={resetEmail}
                      onChange={(event) => setResetEmail(event.target.value)}
                      placeholder="Enter your email address"
                      required
                      disabled={resetLoading}
                    />
                  </div>
                </div>

                {resetError && (
                  <div className={`${styles.loginMessage} ${styles.error}`} role="alert">
                    {resetError}
                  </div>
                )}

                {resetMessage && (
                  <div className={`${styles.loginMessage} ${styles.success}`} role="status">
                    {resetMessage}
                  </div>
                )}

                <button type="submit" disabled={resetLoading} className={styles.signinButton}>
                  {resetLoading ? 'Sending...' : 'Send Reset Email'}
                </button>

                <p className={styles.registerRow}>
                  <button type="button" onClick={handleBackToSignIn} className={styles.linkButton}>
                    Back to sign in
                  </button>
                </p>
              </form>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
