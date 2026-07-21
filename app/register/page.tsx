'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { getAuthCallbackEmailRedirectTo } from '../../lib/authFlow';
import { normalizeProfileRoleForStorage } from '../../lib/authRole';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';

type RegisterRole = 'owner_operator' | 'fleet_operator' | 'transport_broker' | 'customer_shipper';

type SignupConfig = {
  appRole: 'broker' | 'company_admin' | 'driver' | 'customer';
  accountType: 'owner_driver' | 'fleet_courier' | 'broker_shipper' | 'customer_shipper';
  workspaceMode: 'owner_driver' | 'company' | 'broker' | 'customer';
  ownerDriverWorkspace: boolean;
};

const SIGNUP_ROLE_CONFIG: Record<RegisterRole, SignupConfig> = {
  owner_operator: {
    appRole: 'driver',
    accountType: 'owner_driver',
    workspaceMode: 'owner_driver',
    ownerDriverWorkspace: true,
  },
  fleet_operator: {
    appRole: 'company_admin',
    accountType: 'fleet_courier',
    workspaceMode: 'company',
    ownerDriverWorkspace: false,
  },
  transport_broker: {
    appRole: 'broker',
    accountType: 'broker_shipper',
    workspaceMode: 'broker',
    ownerDriverWorkspace: false,
  },
  customer_shipper: {
    appRole: 'customer',
    accountType: 'customer_shipper',
    workspaceMode: 'customer',
    ownerDriverWorkspace: false,
  },
};

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<RegisterRole>('customer_shipper');
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
      const signupConfig = SIGNUP_ROLE_CONFIG[role];
      const storedRole = normalizeProfileRoleForStorage(signupConfig.appRole) ?? 'customer';
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: getAuthCallbackEmailRedirectTo(),
          data: {
            role: signupConfig.appRole,
            requested_role: role,
            signup_type: role,
            account_type: signupConfig.accountType,
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
        const { error: profileUpsertError } = await supabase
          .from('profiles')
          .upsert({
            user_id: data.user.id,
            role: storedRole,
            status: 'active',
            is_driver: signupConfig.appRole === 'driver',
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });

        if (profileUpsertError) {
          setWarning(`Account created, but profile sync needs attention: ${profileUpsertError.message}`);
        }

        const initResponse = await fetch('/api/onboarding/init', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${data.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ forceRegenerateToken: false }),
        });
        const initPayload = (await initResponse.json().catch(() => null)) as { error?: string } | null;
        if (!initResponse.ok) {
          setError(initPayload?.error ?? 'Account created, but onboarding could not be started.');
          return;
        }

        router.replace('/onboarding/resume');
        return;
      }

      setMessage('Account created. Check your email to verify your account, then sign in.');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setRole('customer_shipper');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Registration failed.');
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
        <div style={{ marginBottom: '1rem' }}>
          <Image src="/xdrive-logo.jpeg" alt="XDrive Logistics" width={180} height={40} priority style={{ width: 'auto', height: '40px' }} />
        </div>
        <p style={{ marginTop: 0, color: '#5B6B85', marginBottom: '1.5rem' }}>
          Register as a customer, transport broker, fleet operator, or owner operator.
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="register-email" style={{ display: 'block', marginBottom: '0.4rem', color: '#0B1B33' }}>
            Email
          </label>
          <input
            id="register-email"
            type="email"
            autoComplete="email"
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
            <option value="customer_shipper">Customer / Shipper</option>
            <option value="transport_broker">Transport Broker</option>
            <option value="fleet_operator">Fleet Operator</option>
            <option value="owner_operator">Owner Operator</option>
          </select>

          <label htmlFor="register-password" style={{ display: 'block', marginBottom: '0.4rem', color: '#0B1B33' }}>
            Password
          </label>
          <input
            id="register-password"
            type="password"
            autoComplete="new-password"
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
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            disabled={loading}
            style={{ width: '100%', marginBottom: '1rem', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
          />

          <p style={{ marginTop: 0, marginBottom: '1rem', color: '#5B6B85', fontSize: '0.9rem' }}>
            Customers use the customer workspace. Brokers, fleet operators, and owner operators use the operations workspace with permissions matched to their role.
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
          {warning && (
            <p style={{ margin: '0 0 1rem', color: '#b45309', fontSize: '0.9rem' }}>
              {warning}
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
