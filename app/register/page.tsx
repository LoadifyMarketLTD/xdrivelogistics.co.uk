'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
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

const REGISTER_ROLES = new Set<RegisterRole>(['owner_operator', 'fleet_operator', 'transport_broker', 'customer_shipper']);

const SIGNUP_ROLE_CONFIG: Record<Exclude<RegisterRole, 'owner_operator'>, SignupConfig> = {
  fleet_operator: { appRole: 'company_admin', accountType: 'fleet_courier', workspaceMode: 'company', ownerDriverWorkspace: false },
  transport_broker: { appRole: 'broker', accountType: 'broker_shipper', workspaceMode: 'broker', ownerDriverWorkspace: false },
  customer_shipper: { appRole: 'customer', accountType: 'customer_shipper', workspaceMode: 'customer', ownerDriverWorkspace: false },
};

const getSignupConfig = (role: RegisterRole): SignupConfig => role === 'owner_operator'
  ? { appRole: 'driver', accountType: 'owner_driver', workspaceMode: 'owner_driver', ownerDriverWorkspace: true }
  : SIGNUP_ROLE_CONFIG[role];

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<RegisterRole>('customer_shipper');
  const [selectedPlan, setSelectedPlan] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [message, setMessage] = useState('');
  const [warning, setWarning] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedRole = params.get('role') as RegisterRole | null;
    const plan = params.get('plan')?.trim() || '';
    if (requestedRole && REGISTER_ROLES.has(requestedRole)) setRole(requestedRole);
    if (plan) setSelectedPlan(plan);
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(''); setMessage(''); setWarning('');

    if (!isSupabaseConfigured) { setError('Registration is unavailable: Supabase is not configured.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (!acceptedTerms) { setError('Please confirm that you agree to the Terms and have read the Privacy Policy.'); return; }

    setLoading(true);
    try {
      const signupConfig = getSignupConfig(role);
      const storedRole = normalizeProfileRoleForStorage(signupConfig.appRole) ?? 'customer';
      const acceptedAt = new Date().toISOString();
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
            selected_membership_plan: selectedPlan || null,
            terms_accepted_at: acceptedAt,
            terms_version: '2026-09-01',
            privacy_acknowledged_at: acceptedAt,
            privacy_version: '2026-09-01',
          },
        },
      });

      if (signUpError) { setError(signUpError.message); return; }

      if (data.session && data.user) {
        const { error: profileUpsertError } = await supabase.from('profiles').upsert({
          user_id: data.user.id,
          role: storedRole,
          status: 'active',
          is_driver: signupConfig.appRole === 'driver',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

        if (profileUpsertError) setWarning(`Account created, but profile sync needs attention: ${profileUpsertError.message}`);

        const initResponse = await fetch('/api/onboarding/init', {
          method: 'POST',
          headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ forceRegenerateToken: false }),
        });
        const initPayload = (await initResponse.json().catch(() => null)) as { error?: string } | null;
        if (!initResponse.ok) { setError(initPayload?.error ?? 'Account created, but onboarding could not be started.'); return; }

        router.replace('/onboarding/resume');
        return;
      }

      setMessage('Account created. Check your email to verify your account, then sign in.');
      setEmail(''); setPassword(''); setConfirmPassword(''); setAcceptedTerms(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Registration failed.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0A2239 0%, #1E4E8C 100%)', padding: '1rem' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: '12px', width: '100%', maxWidth: '460px', padding: '2rem', boxShadow: '0 10px 25px rgba(0,0,0,0.15)' }}>
        <h1 style={{ marginTop: 0, marginBottom: '0.5rem', color: '#0A2239' }}>Create account</h1>
        <div style={{ marginBottom: '1rem' }}><Image src="/xdrive-logo-primary.png" alt="XDrive Logistics" width={180} height={49} priority style={{ width: 'auto', height: '40px' }} /></div>
        <p style={{ marginTop: 0, color: '#5B6B85', marginBottom: selectedPlan ? '0.75rem' : '1.5rem' }}>Register as a Customer/Shipper, Transport Broker, Fleet Operator, or Owner Operator.</p>
        {selectedPlan ? <p style={{ marginTop: 0, marginBottom: '1.5rem', padding: '0.7rem 0.8rem', borderRadius: '6px', background: '#EFF5FF', color: '#1E4E8C', fontSize: '0.9rem', fontWeight: 700 }}>Selected membership: {selectedPlan.replaceAll('-', ' ')}</p> : null}

        <form onSubmit={handleSubmit}>
          <label htmlFor="register-email" style={{ display: 'block', marginBottom: '0.4rem', color: '#0B1B33' }}>Email</label>
          <input id="register-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} style={{ width: '100%', marginBottom: '1rem', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px' }} />

          <label htmlFor="register-role" style={{ display: 'block', marginBottom: '0.4rem', color: '#0B1B33' }}>Account type</label>
          <select id="register-role" value={role} onChange={(e) => setRole(e.target.value as RegisterRole)} disabled={loading} style={{ width: '100%', marginBottom: '1rem', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px' }}>
            <option value="customer_shipper">Customer / Shipper</option><option value="transport_broker">Transport Broker</option><option value="fleet_operator">Fleet Operator</option><option value="owner_operator">Owner Operator</option>
          </select>

          <label htmlFor="register-password" style={{ display: 'block', marginBottom: '0.4rem', color: '#0B1B33' }}>Password</label>
          <input id="register-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} disabled={loading} style={{ width: '100%', marginBottom: '1rem', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px' }} />

          <label htmlFor="register-password-confirm" style={{ display: 'block', marginBottom: '0.4rem', color: '#0B1B33' }}>Confirm Password</label>
          <input id="register-password-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} disabled={loading} style={{ width: '100%', marginBottom: '1rem', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px' }} />

          <p style={{ marginTop: 0, marginBottom: '1rem', color: '#5B6B85', fontSize: '0.9rem' }}>Fleet Operator drivers are invited into the company after registration. Owner Operators always receive an operations workspace.</p>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', marginBottom: '1rem', color: '#46566f', fontSize: '0.88rem', lineHeight: 1.5 }}>
            <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} disabled={loading} required style={{ marginTop: '0.2rem' }} />
            <span>I agree to the <Link href="/terms" target="_blank" style={{ color: '#1E4E8C', fontWeight: 700 }}>Terms & Conditions</Link> and confirm I have read the <Link href="/privacy" target="_blank" style={{ color: '#1E4E8C', fontWeight: 700 }}>Privacy Policy</Link>. Membership billing, when activated, is also governed by the <Link href="/subscription-terms" target="_blank" style={{ color: '#1E4E8C', fontWeight: 700 }}>Membership & Subscription Terms</Link>.</span>
          </label>

          {error && <p style={{ margin: '0 0 1rem', color: '#dc2626', fontSize: '0.9rem' }}>{error}</p>}
          {message && <p style={{ margin: '0 0 1rem', color: '#166534', fontSize: '0.9rem' }}>{message}</p>}
          {warning && <p style={{ margin: '0 0 1rem', color: '#b45309', fontSize: '0.9rem' }}>{warning}</p>}

          <button type="submit" disabled={loading} style={{ width: '100%', backgroundColor: loading ? '#86efac' : '#1F7A3D', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.85rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>{loading ? 'Creating account...' : 'Create account'}</button>
        </form>

        <p style={{ marginTop: '1rem', marginBottom: 0, color: '#5B6B85' }}>Already have an account? <Link href="/login" style={{ color: '#1E4E8C' }}>Sign in</Link></p>
      </div>
    </div>
  );
}
