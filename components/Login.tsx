import React, { useState } from "react";
import styles from "./login.module.css";

/**
 * Login component (React + TypeScript)
 * - local state for identifier/password/remember/showPwd
 * - calls props.onSubmit if provided, otherwise demo behavior
 */
export default function Login({
  onSubmit,
}: {
  onSubmit?: (identifier: string, password: string, remember: boolean) => Promise<void> | void;
}) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (onSubmit) await onSubmit(identifier, password, remember);
      else {
        // demo delay — replace with real API call
        await new Promise((r) => setTimeout(r, 700));
        alert("Demo login — integrați API-ul backend pentru autentificare");
      }
    } catch (err) {
      console.error(err);
      alert("Authentication error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.root}>
      {/* LEFT HERO */}
      <section className={styles.hero} aria-hidden>
        <div className={styles.heroInner}>
          <div className={styles.leftCopy}>
            <h1 className={styles.brand}>
              <span className={styles.accent}>XDrive Logistics</span> – UK Courier Exchange Platform
            </h1>
            <p className={styles.heroSub}>Login to access loads, routes & driver dashboard</p>

            <div className={styles.carouselIndicators} aria-hidden>
              <span className={`${styles.dot} ${styles.active}`} />
              <span className={styles.dot} />
              <span className={styles.dot} />
            </div>

            <div className={styles.thumbRow} aria-hidden>
              <div className={`${styles.thumb} ${styles.t1}`} />
              <div className={`${styles.thumb} ${styles.t2}`} />
              <div className={`${styles.thumb} ${styles.t3}`} />
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
                  type={showPwd ? "text" : "password"}
                  name="password"
                  placeholder="Password"
                  required
                />
                <button
                  type="button"
                  aria-label="Toggle password visibility"
                  onClick={() => setShowPwd((s) => !s)}
                  className={styles.pwdToggle}
                >
                  {showPwd ? "🙈" : "👁️"}
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

              <a href="#" className={styles.forgot}>
                Forgot password?
              </a>
            </div>

            <button className={styles.btnPrimary} type="submit" disabled={loading}>
              {loading ? "Signing in…" : "Sign in to XDrive"}
            </button>

            <p className={styles.foot}>
              No account yet? <a className={styles.mutedLink} href="#">Request access</a>
              <br />
              XDrive Logistics is a private platform for approved drivers & fleets
            </p>
          </form>
        </div>
      </aside>
    </main>
  );
}
