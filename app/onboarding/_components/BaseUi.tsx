'use client';

import { useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

export function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'date';
}) {
  return (
    <label style={{ display: 'block', marginBottom: '0.75rem' }}>
      <div style={{ marginBottom: '0.35rem', fontWeight: 500 }}>{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', border: '1px solid #D1D5DB', borderRadius: 6, padding: '0.6rem 0.75rem' }}
      />
    </label>
  );
}

export function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function InvitationControls({ status }: { status: string }) {
  const [working, setWorking] = useState<'resend' | 'revoke' | null>(null);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const normalizedStatus = status.trim().toLowerCase();

  if (normalizedStatus === 'approved' || normalizedStatus === 'under_review' || normalizedStatus === 'submitted') {
    return null;
  }

  const authenticatedRequest = async (method: 'POST' | 'DELETE') => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Your session has expired. Please sign in again.');

    const response = await fetch('/api/onboarding/init', {
      method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(method === 'POST' ? { body: JSON.stringify({ forceRegenerateToken: true }) } : {}),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string; tokenExpiresAt?: string | null };
    if (!response.ok) throw new Error(payload.error ?? 'The invitation action failed.');
    return payload;
  };

  const resend = async () => {
    setWorking('resend');
    setError('');
    setFeedback('');
    try {
      const payload = await authenticatedRequest('POST');
      const expiry = payload.tokenExpiresAt
        ? new Date(payload.tokenExpiresAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
        : null;
      setFeedback(`A new secure invitation was issued${expiry ? ` and expires ${expiry}` : ''}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to resend the invitation.');
    } finally {
      setWorking(null);
    }
  };

  const revoke = async () => {
    if (!window.confirm('Revoke the current onboarding invitation link? Your saved application data will remain available.')) return;

    setWorking('revoke');
    setError('');
    setFeedback('');
    try {
      await authenticatedRequest('DELETE');
      setFeedback('The current invitation link has been revoked. Use Resend invitation when you need a new secure link.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to revoke the invitation.');
    } finally {
      setWorking(null);
    }
  };

  return (
    <section style={{ marginTop: '1.5rem', border: '1px solid #d7e0ea', borderRadius: 10, background: '#f8fafc', padding: '1rem' }}>
      <h2 style={{ margin: '0 0 0.35rem', fontSize: '1rem', color: '#0f172a' }}>Secure invitation link</h2>
      <p style={{ margin: '0 0 0.8rem', color: '#64748b', fontSize: '0.82rem', lineHeight: 1.5 }}>
        Invitation links expire after 48 hours. Resending invalidates the previous link; revoking stops automatic regeneration until you explicitly resend it.
      </p>
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={working !== null}
          onClick={() => void resend()}
          style={{ border: 0, borderRadius: 7, background: '#1d4ed8', color: '#fff', padding: '0.58rem 0.78rem', fontWeight: 800, cursor: working ? 'wait' : 'pointer' }}
        >
          {working === 'resend' ? 'Resending…' : 'Resend invitation'}
        </button>
        <button
          type="button"
          disabled={working !== null}
          onClick={() => void revoke()}
          style={{ border: '1px solid #fecaca', borderRadius: 7, background: '#fff', color: '#b91c1c', padding: '0.58rem 0.78rem', fontWeight: 800, cursor: working ? 'wait' : 'pointer' }}
        >
          {working === 'revoke' ? 'Revoking…' : 'Revoke invitation'}
        </button>
      </div>
      {feedback && <p style={{ margin: '0.7rem 0 0', color: '#166534', fontSize: '0.8rem' }}>{feedback}</p>}
      {error && <p style={{ margin: '0.7rem 0 0', color: '#b91c1c', fontSize: '0.8rem' }}>{error}</p>}
    </section>
  );
}

export function PageLayout({
  title,
  status,
  currentStep,
  progress,
  children,
  error,
  message,
  onSave,
  onSubmit,
  saving,
  backToLogin,
  submitDisabled,
}: {
  title: string;
  status: string;
  currentStep: string;
  progress: number;
  children: React.ReactNode;
  error: string;
  message: string;
  onSave: () => void;
  onSubmit: () => void;
  saving: boolean;
  backToLogin: () => void;
  submitDisabled?: boolean;
}) {
  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '2rem' }}>
      <h1>{title}</h1>
      <p>
        Status: <strong>{status}</strong>
      </p>
      <p>
        Current step: <strong>{currentStep}</strong>
      </p>

      <div style={{ background: '#E5E7EB', borderRadius: 8, overflow: 'hidden', marginBottom: '1rem' }}>
        <div style={{ width: `${progress}%`, height: 10, background: '#2563EB' }} />
      </div>
      <p style={{ marginTop: 0 }}>{progress.toFixed(0)}% complete</p>

      {children}

      {error && <p style={{ color: '#B91C1C' }}>{error}</p>}
      {message && <p style={{ color: '#166534' }}>{message}</p>}

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={onSave}
          disabled={saving}
          style={{ padding: '0.75rem 1rem', borderRadius: 6, border: '1px solid #D1D5DB', cursor: 'pointer' }}
        >
          Save and continue later
        </button>
        <button
          onClick={onSubmit}
          disabled={saving || submitDisabled}
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 6,
            border: 'none',
            background: '#1D4ED8',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Submit for review
        </button>
        <button
          onClick={backToLogin}
          style={{ padding: '0.75rem 1rem', borderRadius: 6, border: '1px solid #D1D5DB', cursor: 'pointer' }}
        >
          Back to login
        </button>
      </div>

      <InvitationControls status={status} />
    </main>
  );
}
