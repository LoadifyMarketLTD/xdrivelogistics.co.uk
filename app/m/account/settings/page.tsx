'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { useAuth } from '../../../components/AuthContext';
import { supabase } from '../../../lib/supabaseClient';

export default function AccountSettingsPage() {
  const router = useRouter();
  const { logout } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmationText, setConfirmationText] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleDelete = async () => {
    setMessage('');
    if (confirmationText !== 'DELETE') {
      setMessage('Type DELETE to confirm account removal.');
      return;
    }
    if (!password || password.length < 8) {
      setMessage('Enter your current password to continue.');
      return;
    }

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? null;
    if (!token) {
      setMessage('Session expired. Please sign in again.');
      return;
    }

    setLoading(true);
    const response = await fetch('/api/account/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
      body: JSON.stringify({
        confirmationText,
        password,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    setLoading(false);

    if (!response.ok) {
      setMessage(payload.error ?? `Account deletion failed (${response.status}).`);
      return;
    }

    await logout();
    router.replace('/login?deleted=1');
  };

  return (
    <ProtectedRoute>
      <main style={{ minHeight: '100vh', background: '#f8fafc', padding: '1rem' }}>
        <section style={{ maxWidth: '720px', margin: '0 auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem' }}>
          <h1 style={{ marginTop: 0, color: '#0f172a' }}>Account settings</h1>
          <p style={{ color: '#475569' }}>
            GDPR deletion permanently removes your account data, profile, memberships, company-linked operational records and authentication access.
          </p>
          <div style={{ border: '1px solid #fecaca', borderRadius: '10px', padding: '0.9rem', background: '#fef2f2' }}>
            <h2 style={{ marginTop: 0, color: '#991b1b', fontSize: '1rem' }}>Delete account</h2>
            <p style={{ color: '#7f1d1d' }}>This action is irreversible.</p>
            <label style={{ display: 'block', marginBottom: '0.65rem' }}>
              <span style={{ display: 'block', marginBottom: '0.3rem', color: '#7f1d1d' }}>Type DELETE to confirm</span>
              <input value={confirmationText} onChange={(e) => setConfirmationText(e.target.value)} style={{ width: '100%', padding: '0.55rem', border: '1px solid #fca5a5', borderRadius: '8px' }} />
            </label>
            <label style={{ display: 'block', marginBottom: '0.75rem' }}>
              <span style={{ display: 'block', marginBottom: '0.3rem', color: '#7f1d1d' }}>Current password</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', padding: '0.55rem', border: '1px solid #fca5a5', borderRadius: '8px' }} />
            </label>
            <button onClick={handleDelete} disabled={loading} style={{ background: '#b91c1c', color: '#fff', border: 0, borderRadius: '8px', padding: '0.55rem 0.9rem', cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Deleting…' : 'Delete my account'}
            </button>
            {message && <p style={{ marginTop: '0.65rem', color: '#b91c1c' }}>{message}</p>}
          </div>
        </section>
      </main>
    </ProtectedRoute>
  );
}
