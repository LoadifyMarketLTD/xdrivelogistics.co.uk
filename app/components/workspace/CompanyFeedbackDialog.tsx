'use client';

import { useEffect, useState } from 'react';

import { supabase } from '../../../lib/supabaseClient';
import { ActionButton, AlertBanner } from './WorkspaceUI';

export type CompanyFeedbackDraft = {
  rating: number | null;
  comment: string | null;
};

export function CompanyFeedbackDialog({
  jobId,
  companyId,
  existing,
  counterpartyLabel,
  onClose,
  onSaved,
}: {
  jobId: string;
  companyId: string;
  existing?: CompanyFeedbackDraft | null;
  counterpartyLabel?: string | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 5);
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setRating(existing?.rating ?? 5);
    setComment(existing?.comment ?? '');
    setError('');
  }, [existing, jobId]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error('Session expired.');
      const response = await fetch(`/api/admin/jobs/${encodeURIComponent(jobId)}/feedback`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, rating, comment }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Company feedback could not be saved.');
      await onSaved();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Company feedback could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 1300, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15,23,42,.45)' }}>
      <section role="dialog" aria-modal="true" aria-label="Company feedback" className="workspace-panel" style={{ width: 'min(520px, calc(100vw - 32px))', padding: 12, display: 'grid', gap: 10 }}>
        <div><strong style={{ display: 'block' }}>{existing ? 'Edit company feedback' : 'Leave company feedback'}</strong><span style={{ color: '#64748b', fontSize: 11 }}>{counterpartyLabel ? `For ${counterpartyLabel}. ` : ''}One company review is stored per booking and reviewer company.</span></div>
        {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}
        <label style={{ display: 'grid', gap: 4, fontSize: 11, fontWeight: 700, color: '#64748b' }}>RATING<select value={rating} onChange={(event) => setRating(Number(event.target.value))}>{[5,4,3,2,1].map((value) => <option key={value} value={value}>{value} / 5</option>)}</select></label>
        <label style={{ display: 'grid', gap: 4, fontSize: 11, fontWeight: 700, color: '#64748b' }}>COMMENT<textarea value={comment} maxLength={2000} rows={5} onChange={(event) => setComment(event.target.value)} placeholder="Optional operational feedback" /></label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}><ActionButton tone="secondary" disabled={saving} onClick={onClose}>Cancel</ActionButton><ActionButton tone="success" disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : existing ? 'Update Feedback' : 'Submit Feedback'}</ActionButton></div>
      </section>
    </div>
  );
}
