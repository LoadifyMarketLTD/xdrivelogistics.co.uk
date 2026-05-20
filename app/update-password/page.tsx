'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { COMPANY_CONFIG } from '../config/company';
import type { CompanyMembership, Driver, Profile } from '../../lib/types/database';

const mapRole = (value: string | null | undefined) => {
  const normalized = (value ?? '').toLowerCase();
  if (normalized === 'owner') return 'owner';
  if (normalized === 'admin') return 'admin';
  if (normalized === 'company' || normalized === 'dispatcher') return 'company';
  if (normalized === 'driver') return 'driver';
  if (normalized === 'customer' || normalized === 'client' || normalized === 'viewer') return 'customer';
  return null;
};

const resolveRedirectPath = async (userId: string, fallbackRole?: string | null) => {
  const [profileRes, membershipRes, driverRes] = await Promise.all([
    supabase.from('profiles').select('role, is_driver, company_id').eq('id', userId).maybeSingle(),
    supabase
      .from('company_memberships')
      .select('company_id, role_in_company, status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('drivers')
      .select('id, company_id, user_id, app_access')
      .eq('user_id', userId)
      .eq('app_access', true)
      .maybeSingle(),
  ]);

  if (profileRes.error || membershipRes.error || driverRes.error) return null;

  const profile = profileRes.data as Pick<Profile, 'role' | 'is_driver' | 'company_id'> | null;
  const membership = membershipRes.data as Pick<CompanyMembership, 'company_id' | 'role_in_company' | 'status'> | null;
  const driver = driverRes.data as Pick<Driver, 'id' | 'company_id' | 'user_id' | 'app_access'> | null;
  const resolvedCompanyId = driver?.company_id ?? profile?.company_id ?? membership?.company_id ?? null;

  if (
    membership?.role_in_company === 'owner' ||
    membership?.role_in_company === 'admin' ||
    membership?.role_in_company === 'dispatcher'
  ) {
    return resolvedCompanyId ? '/admin' : null;
  }
  if (driver || profile?.is_driver) return resolvedCompanyId ? '/driver/jobs' : null;
  if (membership?.role_in_company === 'viewer') return '/customer';

  const profileRole = mapRole(profile?.role);
  if (profileRole === 'driver') return resolvedCompanyId ? '/driver/jobs' : null;
  if (profileRole === 'customer') return '/customer';
  if (profileRole === 'company' || profileRole === 'admin' || profileRole === 'owner') {
    return resolvedCompanyId ? '/admin' : null;
  }

  const metadataRole = mapRole(fallbackRole);
  if (metadataRole === 'driver') return resolvedCompanyId ? '/driver/jobs' : null;
  if (metadataRole === 'customer') return '/customer';
  if (metadataRole === 'company' || metadataRole === 'admin' || metadataRole === 'owner') {
    return resolvedCompanyId ? '/admin' : null;
  }

  return null;
};

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      if (!isSupabaseConfigured) {
        setError('Authentication is unavailable: Supabase is not configured.');
        setSessionChecked(true);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }
      setSessionChecked(true);
    };
    void checkSession();
  }, [router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setIsLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }

      const fallbackRole =
        typeof user.user_metadata?.role === 'string'
          ? user.user_metadata.role
          : typeof user.user_metadata?.requested_role === 'string'
            ? user.user_metadata.requested_role
            : null;

      const redirectPath = await resolveRedirectPath(user.id, fallbackRole);
      router.replace(redirectPath ?? '/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!sessionChecked) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#5B6B85' }}>Loading\u2026</p>
      </div>
    );
  }

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
          background: 'white',
          padding: '2.5rem',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
          width: '100%',
          maxWidth: '400px',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: '700', color: '#0A2239', marginBottom: '0.5rem' }}>
            {COMPANY_CONFIG.name}
          </h1>
          <p style={{ color: '#5B6B85', fontSize: '0.95rem' }}>Set a new password for your account</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="new-password"
              style={{ display: 'block', marginBottom: '0.5rem', color: '#0B1B33', fontWeight: '500', fontSize: '0.95rem' }}
            >
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              minLength={8}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid rgba(14, 36, 72, 0.12)',
                borderRadius: '6px',
                fontSize: '1rem',
                transition: 'border-color 0.2s',
                outline: 'none',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#1E4E8C')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(14, 36, 72, 0.12)')}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="confirm-password"
              style={{ display: 'block', marginBottom: '0.5rem', color: '#0B1B33', fontWeight: '500', fontSize: '0.95rem' }}
            >
              Confirm New Password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isLoading}
              minLength={8}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid rgba(14, 36, 72, 0.12)',
                borderRadius: '6px',
                fontSize: '1rem',
                transition: 'border-color 0.2s',
                outline: 'none',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#1E4E8C')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(14, 36, 72, 0.12)')}
            />
          </div>

          {error && (
            <div
              style={{
                padding: '0.75rem',
                marginBottom: '1.5rem',
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                borderRadius: '6px',
                fontSize: '0.9rem',
                border: '1px solid #fecaca',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '0.875rem',
              backgroundColor: isLoading ? '#86efac' : '#1F7A3D',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!isLoading) e.currentTarget.style.backgroundColor = '#166534';
            }}
            onMouseLeave={(e) => {
              if (!isLoading) e.currentTarget.style.backgroundColor = '#1F7A3D';
            }}
          >
            {isLoading ? 'Updating\u2026' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
