'use client';

import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { getAuthCallbackEmailRedirectTo } from '../../lib/authFlow';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';

type RegisterRole = 'broker' | 'company_admin' | 'owner_driver';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<RegisterRole>('broker');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!isSupabaseConfigured) {
      setError('Registration is unavailable: Supabase is not configured.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: getAuthCallbackEmailRedirectTo(),
          data: {
            role: role === 'owner_driver' ? 'driver' : role,
            requested_role: role === 'owner_driver' ? 'driver' : role,
            account_type: role,
            workspace_mode: role === 'owner_driver' ? 'owner_driver' : 'company',
            owner_driver_workspace: role === 'owner_driver',
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      setMessage('Account created. Check your email to verify your account, then sign in.');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setRole('broker');
    } catch (err) {
      const fallback = err instanceof Error ? err.message : 'Registration failed.';
      setError(fallback);
    } finally {
      setLoading(false);
    }
  };

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
          backgroundColor: '#fff',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '440px',
          padding: '2rem',
          boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: '0.5rem', color: '#0A2239' }}>Create account</h1>
        <p style={{ marginTop: 0, color: '#5B6B85', marginBottom: '1.5rem' }}>
          Register as broker, fleet/courier company, or owner-driver.
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="register-email" style={{ display: 'block', marginBottom: '0.4rem', color: '#0B1B33' }}>
            Email
          </label>
          <input
            id="register-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            style={{ width: '100%', marginBottom: '1rem', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
          />

          <label htmlFor="register-role" style={{ display: 'block', marginBottom: '0.4rem', color: '#0B1B33' }}>
            Account type
          </label>
          <select
            id="register-role"
            value={role}
            onChange={(e) => setRole(e.target.value as RegisterRole)}
            disabled={loading}
            style={{ width: '100%', marginBottom: '1rem', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
          >
            <option value="broker">Broker / Shipper</option>
            <option value="company_admin">Fleet / Courier Company</option>
            <option value="owner_driver">Owner-Driver / Sole Trader</option>
          </select>

          <label htmlFor="register-password" style={{ display: 'block', marginBottom: '0.4rem', color: '#0B1B33' }}>
            Password
          </label>
          <input
            id="register-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            disabled={loading}
            style={{ width: '100%', marginBottom: '1rem', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
          />

          <label htmlFor="register-password-confirm" style={{ display: 'block', marginBottom: '0.4rem', color: '#0B1B33' }}>
            Confirm Password
          </label>
          <input
            id="register-password-confirm"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            disabled={loading}
            style={{ width: '100%', marginBottom: '1rem', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
          />

          <p style={{ marginTop: 0, marginBottom: '1rem', color: '#5B6B85', fontSize: '0.9rem' }}>
            Fleet accounts get a company workspace. Owner-driver accounts get a personal workspace automatically after login.
          </p>

          {error && (
            <p style={{ margin: '0 0 1rem', color: '#dc2626', fontSize: '0.9rem' }}>
              {error}
            </p>
          )}
          {message && (
            <p style={{ margin: '0 0 1rem', color: '#166534', fontSize: '0.9rem' }}>
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              backgroundColor: loading ? '#86efac' : '#1F7A3D',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '0.85rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p style={{ marginTop: '1rem', marginBottom: 0, color: '#5B6B85' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: '#1E4E8C' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
