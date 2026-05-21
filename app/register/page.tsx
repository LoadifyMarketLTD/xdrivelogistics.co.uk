'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';

type RegisterRole = 'customer' | 'driver' | 'company';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<RegisterRole>('customer');
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
      const redirectTo =
        typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined;

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            requested_role: role,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.user?.id) {
        const { error: profileError } = await supabase.from('profiles').upsert(
          [{
            user_id: data.user.id,
            role,
            is_driver: role === 'driver',
          }],
          { onConflict: 'user_id' }
        );

        if (profileError) {
          console.error('RegisterPage profile upsert failed', {
            role,
            message: profileError.message,
          });
          setError(`Account created, but profile setup failed: ${profileError.message}`);
          return;
        }
      }

      setMessage(
        'Account created. Check your email to verify your account, then sign in.'
      );
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setRole('customer');
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
          Register as customer, driver, or company user.
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
            Role
          </label>
          <select
            id="register-role"
            value={role}
            onChange={(e) => setRole(e.target.value as RegisterRole)}
            disabled={loading}
            style={{ width: '100%', marginBottom: '1rem', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
          >
            <option value="customer">Customer</option>
            <option value="driver">Driver</option>
            <option value="company">Company</option>
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
