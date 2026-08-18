'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { supabase } from '../../../lib/supabaseClient';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { ActionButton, AlertBanner } from '../../components/workspace/WorkspaceUI';

export default function DriverChangePasswordPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const guidance = useMemo(() => {
    if (user?.mustChangePassword) return 'You must set a new password before continuing to the Driver Workspace.';
    return 'Update your password whenever you need to replace a temporary or compromised credential.';
  }, [user?.mustChangePassword]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 8) return setError('Password must be at least 8 characters long.');
    if (newPassword !== confirmPassword) return setError('Passwords do not match.');

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
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + accessToken },
        body: JSON.stringify({ newPassword }),
      });
      const payload = await response.json().catch(() => ({} as { error?: string }));
      if (!response.ok) {
        setError(payload.error || 'Failed to update password.');
        return;
      }

      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Password updated successfully. Redirecting to Driver Workspace…');
      window.setTimeout(() => window.location.assign('/driver'), user?.mustChangePassword ? 1200 : 1600);
    } catch {
      setError('Failed to update password. Please try again in a moment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        driverName="Password & Security"
        subtitle="Manage the credential used to access your Driver Workspace."
        headerActions={!user?.mustChangePassword ? <ActionButton tone="secondary" onClick={() => router.push('/driver/profile')}>← Account</ActionButton> : undefined}
      >
        {error && <AlertBanner tone="danger">{error}</AlertBanner>}
        {success && <AlertBanner tone="success">{success}</AlertBanner>}

        <div className="driver-account-hub">
          <section className="driver-account-column driver-account-nav-column">
            <div className="driver-account-column__head">Security Guidance</div>
            <div className="driver-account-column__body">
              <div className="driver-account-link"><span><strong>Minimum length</strong><small>Use at least 8 characters.</small></span></div>
              <div className="driver-account-link"><span><strong>Temporary passwords</strong><small>Do not reuse a dispatcher-issued temporary password.</small></span></div>
              <div className="driver-account-link"><span><strong>Unique credential</strong><small>Use a password unique to your XDrive account.</small></span></div>
            </div>
          </section>

          <section className="driver-account-column driver-account-profile-column">
            <div className="driver-account-column__head">Change Password</div>
            <div className="driver-account-edit">
              <p style={{ margin: 0, color: '#64748b', fontSize: 10, lineHeight: '14px' }}>{guidance}</p>
              <form onSubmit={handleSubmit} className="driver-account-edit">
                <label>New password<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" required /></label>
                <label>Confirm new password<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required /></label>
                <div className="driver-account-edit__actions">
                  {!user?.mustChangePassword && <ActionButton tone="secondary" onClick={() => router.push('/driver')}>Driver Workspace</ActionButton>}
                  <ActionButton type="submit" tone="primary" disabled={loading}>{loading ? 'Updating…' : 'Save New Password'}</ActionButton>
                </div>
              </form>
            </div>
          </section>

          <section className="driver-account-column driver-account-readiness-column">
            <div className="driver-account-column__head">Session</div>
            <div className="driver-account-column__body">
              <div className="driver-account-link"><span><strong>Signed-in account</strong><small>{user?.email ?? 'Driver account'}</small></span></div>
              <ActionButton tone="secondary" onClick={logout}>Sign out</ActionButton>
            </div>
          </section>
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
