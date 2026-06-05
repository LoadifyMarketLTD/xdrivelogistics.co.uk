'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { supabase } from '../../../lib/supabaseClient';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';

export default function DriverChangePasswordPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'driver') {
      router.replace('/forbidden');
      return;
    }
    if (!user.mustChangePassword) {
      router.replace('/driver/jobs');
    }
  }, [router, user]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        setError('Your session is not available. Please sign in again.');
        return;
      }

      const response = await fetch('/api/driver/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ newPassword }),
      });

      const payload = await response.json().catch(() => ({} as { error?: string }));
      if (!response.ok) {
        setError(payload.error || 'Failed to update password.');
        return;
      }

      window.location.assign('/driver/jobs');
    } catch {
      setError('Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell subtitle="Update your account password to keep your driver access secure.">
        <div
          style={{
            width: '100%',
            maxWidth: '540px',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '1.5rem',
            border: '1px solid #d7e0ea',
            boxShadow: '0 6px 16px rgba(15, 23, 42, 0.08)',
          }}
        >
          <h1 style={{ marginTop: 0, marginBottom: '0.5rem', color: '#0f172a', fontSize: '1.35rem' }}>
            Account Security
          </h1>
          <p style={{ marginTop: 0, color: '#475569', fontSize: '0.92rem', lineHeight: 1.5 }}>
            Set a new password for your driver workspace account.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.9rem', marginTop: '1rem' }}>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              autoComplete="new-password"
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.95rem',
              }}
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              autoComplete="new-password"
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.95rem',
              }}
            />
            {error && (
              <div
                style={{
                  padding: '0.7rem',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  borderRadius: '8px',
                  fontSize: '0.86rem',
                }}
              >
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.8rem',
                backgroundColor: loading ? '#93c5fd' : '#1d4ed8',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Updating...' : 'Save New Password'}
            </button>
          </form>

          <button
            onClick={logout}
            style={{
              marginTop: '0.8rem',
              width: '100%',
              padding: '0.7rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#f8fafc',
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            Sign out
          </button>
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
