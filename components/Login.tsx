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
      <aside className={styles.panel} aria-labelledby="signInTitle">
        <div className={styles.panelInner}>
          <div className={styles.panelTop}>
            <small className={styles.kicker}>XDRIVE LOGISTICS</small>
            <h2 id="signInTitle" className={styles.title}>
              Sign in
            </h2>
            <p className={styles.lead}>Login to view jobs, vehicles & earnings</p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit} autoComplete="on" noValidate>
            <label className={styles.field}>
              <input
                className={styles.input}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                type="text"
                name="identifier"
                placeholder="Email / Username"
                required
              />
            </label>

            <label className={styles.field}>
              <div className={styles.passwordWrap}>
                <input
                  id="password"
                  className={styles.input}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Password"
                  required
                />
                <button
                  type="button"
                  aria-label="Toggle password visibility"
                  onClick={togglePasswordVisibility}
                  className={styles.pwdToggle}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </label>

            <div className={styles.row}>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
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

            <p className={styles.foot}>
              No account yet? <a className={styles.mutedLink} href="/register">Request access</a>
              <br />
              XDrive Logistics is a private platform for approved drivers & fleets
            </p>
          </form>
        </div>
      </aside>
    </div>
  );
}
