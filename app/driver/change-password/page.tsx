'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { supabase } from '../../../lib/supabaseClient';

const cardStyle = {
  width: '100%',
  maxWidth: '560px',
  backgroundColor: '#FFFFFF',
  borderRadius: '12px',
  padding: '1.5rem',
  border: '1px solid rgba(11, 47, 107, 0.16)',
  boxShadow: '0 6px 16px rgba(26, 31, 43, 0.08)',
} as const;

const inputStyle = {
  width: '100%',
  padding: '0.75rem',
  borderRadius: '8px',
  border: '1px solid rgba(11, 47, 107, 0.16)',
  fontSize: '0.95rem',
} as const;

export default function DriverChangePasswordPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'driver') {
      router.replace('/forbidden');
    }
  }, [router, user]);

  const guidance = useMemo(() => {
    if (user?.mustChangePassword) {
      return 'You must set a new password before you can continue to the operations workspace.';
    }
    return 'Update your password whenever you want extra account protection or need to replace a shared temporary password.';
  }, [user?.mustChangePassword]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
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
        setError('Your session expired before the password update could start. Sign in again and retry.');
        return;
      }

      const response = await fetch('/api/driver/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + accessToken,
        },
        body: JSON.stringify({ newPassword }),
      });

      const payload = await response.json().catch(() => ({} as { error?: string }));
      if (!response.ok) {
        setError(payload.error || 'Failed to update password.');
        return;
      }

      setNewPassword('');
      setConfirmPassword('');
      setSuccess(
        user?.mustChangePassword
          ? 'Password updated. Redirecting you to the operations workspace...'
          : 'Password updated successfully. Redirecting you to the operations workspace.'
      );

      window.setTimeout(() => {
        window.location.assign('/admin/marketplace');
      }, user?.mustChangePassword ? 1200 : 1600);
    } catch {
      setError('Failed to update password. Please try again in a moment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <div style={{ minHeight: '100vh', background: '#F4F6F8', display: 'grid', placeItems: 'center', padding: '1rem' }}>
        <div style={{ display: 'grid', gap: '1rem', width: '100%', maxWidth: '560px' }}>
          <div style={cardStyle}>
            <h1 style={{ marginTop: 0, marginBottom: '0.5rem', color: '#1A1F2B', fontSize: '1.35rem' }}>
              Password &amp; Security
            </h1>
            <p style={{ marginTop: 0, color: '#0B2F6B', fontSize: '0.92rem', lineHeight: 1.5 }}>
              {guidance}
            </p>

            <div style={{ backgroundColor: '#F4F6F8', borderRadius: '10px', border: '1px solid rgba(11, 47, 107, 0.16)', padding: '0.9rem', marginTop: '1rem' }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#0B2F6B', marginBottom: '0.35rem' }}>
                Security guidance
              </div>
              <ul style={{ margin: 0, paddingLeft: '1rem', color: '#0B2F6B', fontSize: '0.84rem', lineHeight: 1.6 }}>
                <li>Use at least 8 characters.</li>
                <li>Avoid reusing a dispatcher-issued temporary password.</li>
                <li>Choose a password that is unique to your XDrive account.</li>
              </ul>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.9rem', marginTop: '1rem' }}>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                autoComplete="new-password"
                required
                style={inputStyle}
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                autoComplete="new-password"
                required
                style={inputStyle}
              />
              {error && (
                <div
                  style={{
                    padding: '0.7rem',
                    backgroundColor: '#F4F6F8',
                    border: '1px solid rgba(11, 47, 107, 0.16)',
                    color: '#1A1F2B',
                    borderRadius: '8px',
                    fontSize: '0.86rem',
                  }}
                >
                  {error}
                </div>
              )}
              {success && (
                <div
                  style={{
                    padding: '0.7rem',
                    backgroundColor: '#F4F6F8',
                    border: '1px solid rgba(11, 47, 107, 0.16)',
                    color: '#1D57D8',
                    borderRadius: '8px',
                    fontSize: '0.86rem',
                  }}
                >
                  {success}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.8rem',
                  backgroundColor: loading ? '#F4F6F8' : '#1D57D8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Updating…' : 'Save New Password'}
              </button>
            </form>

            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.9rem' }}>
              {!user?.mustChangePassword && (
                <button
                  onClick={() => router.push('/admin/marketplace')}
                  style={{
                    flex: 1,
                    minWidth: '180px',
                    padding: '0.7rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(11, 47, 107, 0.16)',
                    backgroundColor: '#F4F6F8',
                    color: '#1D57D8',
                    cursor: 'pointer',
                  }}
                >
                  Continue to Workspace
                </button>
              )}
              <button
                onClick={logout}
                style={{
                  flex: 1,
                  minWidth: '180px',
                  padding: '0.7rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(11, 47, 107, 0.16)',
                  backgroundColor: '#F4F6F8',
                  color: '#1D57D8',
                  cursor: 'pointer',
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
