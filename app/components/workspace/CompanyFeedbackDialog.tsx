'use client';

import { useEffect, useState } from 'react';

import { supabase } from '../../../lib/supabaseClient';
import { ActionButton, AlertBanner, WorkspaceDialog } from './WorkspaceUI';

export type CompanyFeedbackDraft = {
  rating: number | null;
  comment: string | null;
  would_use_again?: boolean | null;
  delivered_promptly?: boolean | null;
  courteous?: boolean | null;
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
  const [wouldUseAgain, setWouldUseAgain] = useState(existing?.would_use_again ?? true);
  const [deliveredPromptly, setDeliveredPromptly] = useState(existing?.delivered_promptly ?? true);
  const [courteous, setCourteous] = useState(existing?.courteous ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setRating(existing?.rating ?? 5);
    setComment(existing?.comment ?? '');
    setWouldUseAgain(existing?.would_use_again ?? true);
    setDeliveredPromptly(existing?.delivered_promptly ?? true);
    setCourteous(existing?.courteous ?? true);
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
        body: JSON.stringify({
          companyId,
          rating,
          comment,
          wouldUseAgain,
          deliveredPromptly,
          courteous,
        }),
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
    <WorkspaceDialog
      ariaLabel="Company feedback"
      title={existing ? 'Edit company feedback' : 'Leave company feedback'}
      description={`${counterpartyLabel ? `For ${counterpartyLabel}. ` : ''}One company review is stored per booking and reviewer company.`}
      width={520}
      onDismiss={onClose}
      dismissDisabled={saving}
      actions={
        <>
          <ActionButton tone="secondary" disabled={saving} onClick={onClose}>Cancel</ActionButton>
          <ActionButton tone="success" disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : existing ? 'Update Feedback' : 'Submit Feedback'}</ActionButton>
        </>
      }
    >
      {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}
      <label style={{ display: 'grid', gap: 4, fontSize: 11, fontWeight: 700, color: '#64748b' }}>RATING<select value={rating} onChange={(event) => setRating(Number(event.target.value))}>{[5,4,3,2,1].map((value) => <option key={value} value={value}>{value} / 5</option>)}</select></label>
      <div style={{ display: 'grid', gap: 8 }}>
        <label style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', fontSize: 12, fontWeight: 700, color: '#334155' }}><span>Would use again</span><input type="checkbox" checked={wouldUseAgain} onChange={(event) => setWouldUseAgain(event.target.checked)} /></label>
        <label style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', fontSize: 12, fontWeight: 700, color: '#334155' }}><span>Delivered promptly</span><input type="checkbox" checked={deliveredPromptly} onChange={(event) => setDeliveredPromptly(event.target.checked)} /></label>
        <label style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', fontSize: 12, fontWeight: 700, color: '#334155' }}><span>Courteous / professional</span><input type="checkbox" checked={courteous} onChange={(event) => setCourteous(event.target.checked)} /></label>
      </div>
      <label style={{ display: 'grid', gap: 4, fontSize: 11, fontWeight: 700, color: '#64748b' }}>COMMENT<textarea value={comment} maxLength={2000} rows={5} onChange={(event) => setComment(event.target.value)} placeholder="Optional operational feedback" /></label>
    </WorkspaceDialog>
  );
}
