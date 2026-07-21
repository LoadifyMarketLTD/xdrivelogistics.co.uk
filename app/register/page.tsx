'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import {
  ACCOUNT_TYPE_CONFIG,
  ACCOUNT_TYPE_OPTIONS,
  type AccountType,
} from '../../lib/accountTypes';
import { getAuthCallbackEmailRedirectTo } from '../../lib/authFlow';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';

const inputStyle = {
  width: '100%',
  marginBottom: '1rem',
  padding: '0.78rem',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  boxSizing: 'border-box' as const,
};

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('customer');
  const [message, setMessage] = useState('');
  const [warning, setWarning] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setWarning('');

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
      const signupConfig = ACCOUNT_TYPE_CONFIG[accountType];
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: getAuthCallbackEmailRedirectTo(),
          data: {
            role: signupConfig.appRole,
            requested_role: accountType,
            signup_type: accountType,
            account_type: accountType,
            workspace_mode: signupConfig.workspaceMode,
            owner_driver_workspace: signupConfig.ownerDriverWorkspace,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.session && data.user) {
        const { error: profileError } = await supabase.from('profiles').upsert(
          {
            user_id: data.user.id,
            role: signupConfig.appRole,
            status: 'pending',
            is_driver: signupConfig.appRole === 'driver',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

        if (profileError) {
          setWarning(`Account created, but profile synchronisation needs attention: ${profileError.message}`);
        }

        const initResponse = await fetch('/api/onboarding/init', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${data.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            account_type: accountType,
            forceRegenerateToken: false,
          }),
        });
        const initPayload = (await initResponse.json().catch(() => null)) as { error?: string } | null;
        if (!initResponse.ok) {
          setError(initPayload?.error ?? 'Account created, but onboarding could not be started.');
          return;
        }

        router.replace('/onboarding/resume');
        return;
      }

      setMessage('Account created. Open the confirmation email, then sign in to continue onboarding.');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #0b2f6b 0%, #1d57d8 100%)', padding: '1rem' }}>
      <section style={{ width: '100%', maxWidth: 480, padding: '2rem', background: '#fff', borderRadius: 14, boxShadow: '0 18px 45px rgba(0,0,0,0.2)' }}>
        <Image src="/xdrive-logo.jpeg" alt="XDrive Logistics" width={180} height={40} priority style={{ width: 'auto', height: 40 }} />
        <h1 style={{ color: '#0b2f6b', marginBottom: '0.45rem' }}>Create your XDrive account</h1>
        <p style={{ color: '#64748b', lineHeight: 1.5, marginTop: 0 }}>Choose the workspace that matches how you use the platform. Your onboarding progress is saved automatically.</p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="register-email">Email</label>
          <input id="register-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} style={inputStyle} />

          <label htmlFor="register-role">Account type</label>
          <select
            id="register-role"
            value={accountType}
            onChange={(e) => setAccountType(e.target.value as AccountType)}
            disabled={loading}
            style={inputStyle}
          >
            {ACCOUNT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <label htmlFor="register-password">Password</label>
          <input id="register-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} disabled={loading} style={inputStyle} />

          <label htmlFor="register-password-confirm">Confirm password</label>
          <input id="register-password-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} disabled={loading} style={inputStyle} />

          {error && <p style={{ color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '0.75rem' }}>{error}</p>}
          {warning && <p style={{ color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '0.75rem' }}>{warning}</p>}
          {message && <p style={{ color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '0.75rem' }}>{message}</p>}

          <button type="submit" disabled={loading} style={{ width: '100%', border: 0, borderRadius: 8, padding: '0.9rem', background: loading ? '#94a3b8' : '#1d57d8', color: '#fff', fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Creating account…' : 'Create account and continue'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: '#64748b', marginBottom: 0 }}>Already registered? <Link href="/login" style={{ color: '#1d57d8', fontWeight: 700 }}>Sign in</Link></p>
      </section>
    </main>
  );
}
