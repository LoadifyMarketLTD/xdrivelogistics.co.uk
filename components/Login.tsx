"use client";

import { useState, FormEvent } from 'react';
import styles from './login.module.css';

interface LoginProps {
  onSubmit?: (data: { identifier: string; password: string; remember: boolean }) => void | Promise<void>;
}

export default function Login({ onSubmit }: LoginProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (onSubmit) {
        await onSubmit({ identifier, password, remember });
      } else {
        // Demo simulation - replace with actual notification system in production
        console.log('Login attempt (demo mode)');
        await new Promise(resolve => setTimeout(resolve, 1000));
        // TODO: Replace alert with proper toast/notification component
        alert('Demo mode: Login would be processed here');
      }
    } catch (error) {
      console.error('Login error:', error);
      // TODO: Replace alert with proper error notification component
      alert('An error occurred during login. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className={styles.container}>
      {/* LEFT HERO SECTION */}
      <section className={styles.hero} aria-hidden="true">
        <img
          src="/assets/hero.jpg"
          alt=""
          className={styles.heroImage}
        />
        <div className={styles.heroOverlay}>
          <p className={styles.brandLine}>XDrive Logistics — UK Courier Exchange Platform</p>
          <h1 className={styles.heroTitle}>XDrive Logistics</h1>
          <p className={styles.heroSubtitle}>
            Login to access loads, routes &amp; driver dashboard
          </p>

          <div className={styles.heroFooter}>
            <ul className={styles.dots} aria-hidden="true">
              <li className={`${styles.dot} ${styles.active}`}></li>
              <li className={styles.dot}></li>
              <li className={styles.dot}></li>
            </ul>

            <div className={styles.thumbs} aria-hidden="true">
              <div className={styles.thumb}>Network</div>
              <div className={styles.thumb}>Speed</div>
              <div className={styles.thumb}>Fleet</div>
            </div>
          </div>
        </div>
      </section>

      {/* RIGHT PANEL */}
      <aside className={styles.panel} role="region" aria-labelledby="signin-title">
        <div className={styles.panelCard}>
          <div className={styles.panelBrand}>
            {/* Small logo SVG */}
            <svg
              className={styles.logoSmall}
              viewBox="0 0 220 140"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <g transform="translate(6,6) scale(0.85)">
                <polygon
                  points="0,0 44,0 110,58 176,0 220,0 132,98 220,196 176,196 110,140 44,196 0,196 96,98"
                  fill="#D6A551"
                />
              </g>
            </svg>
            <div className={styles.brandText}>XDRIVE LOGISTICS</div>
          </div>

          <h2 id="signin-title" className={styles.title}>Sign in</h2>
          <p className={styles.subtitle}>Login to view jobs, vehicles &amp; earnings</p>

          <form className={styles.loginForm} onSubmit={handleSubmit} noValidate>
            <div className={styles.inputWrapper}>
              <label htmlFor="identifier" className={styles.srOnly}>
                Email / Username
              </label>
              <input
                id="identifier"
                name="identifier"
                className={styles.input}
                type="text"
                placeholder="Email / Username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoComplete="username"
              />
            </div>

            <div className={styles.passwordWrapper}>
              <label htmlFor="password" className={styles.srOnly}>
                Password
              </label>
              <input
                id="password"
                name="password"
                className={styles.input}
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className={styles.togglePassword}
                onClick={togglePasswordVisibility}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                )}
              </button>
            </div>

            <div className={styles.formRow}>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  name="remember"
                  className={styles.checkboxInput}
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span>Keep me logged in</span>
              </label>
              <a href="/forgot-password" className={styles.forgot}>
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Signing in...' : 'Sign in to XDrive'}
            </button>
          </form>

          <p className={styles.footer}>
            No account yet?{' '}
            <a href="/register" className={styles.footerLink}>
              Request access
            </a>
          </p>
        </div>
      </aside>
    </div>
  );
}
