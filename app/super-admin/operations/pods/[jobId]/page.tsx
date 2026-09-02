'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

const C = {
  navy: '#0B2F6B',
  blue: '#1D57D8',
  orange: '#F5A300',
  white: '#FFFFFF',
  charcoal: '#1A1F2B',
  light: '#F4F6F8',
  border: '#D9E1EA',
  muted: '#64748B',
  danger: '#DC2626',
  success: '#168553',
} as const;

type ReviewPayload = {
  previewReadOnly?: boolean;
  job?: {
    id: string;
    reference: string;
    status: string | null;
    companyId: string | null;
    pickup: string | null;
    delivery: string | null;
    deliveredAt: string | null;
    completedAt: string | null;
  };
  evidence?: {
    hasPhysicalEvidence: boolean;
    signaturePresent: boolean;
    deliveryPhotoCount: number;
    podPhotoCount: number;
    hardCopyPresent: boolean;
  };
  brokerReview?: {
    status: string | null;
    note: string | null;
    reviewedAt: string | null;
  };
  platformReview?: {
    status: string;
    note: string;
    reviewedBy: string;
    reviewedAt: string;
    evidenceSnapshot?: Record<string, unknown>;
    updatedAt?: string;
  } | null;
  error?: string;
};

type ReviewAction = 'approve' | 'reject' | 'request_missing';

const actionCopy: Record<ReviewAction, { label: string; description: string; tone: string }> = {
  approve: {
    label: 'Approve POD',
    description: 'Confirm that physical delivery evidence is sufficient under Platform Owner authority.',
    tone: C.success,
  },
  reject: {
    label: 'Reject POD',
    description: 'Record that the submitted physical evidence is insufficient or invalid.',
    tone: C.danger,
  },
  request_missing: {
    label: 'Request missing POD',
    description: 'Record that physical proof is missing and needs remediation.',
    tone: C.orange,
  },
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, background: C.white, padding: 10 }}>
      <div style={{ color: C.muted, fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div style={{ marginTop: 4, color: C.charcoal, fontSize: 12, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function ReviewPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = decodeURIComponent(params?.jobId ?? '').trim();
  const [payload, setPayload] = useState<ReviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState<ReviewAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!jobId) {
      setError('Invalid POD review route.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) {
        setError('No active Platform Owner session.');
        return;
      }
      const response = await fetch(`/api/super-admin/pod/${encodeURIComponent(jobId)}`, {
        headers: { Authorization: auth },
        cache: 'no-store',
      });
      const body = await response.json().catch(() => ({})) as ReviewPayload;
      if (!response.ok) {
        setPayload(null);
        setError(body.error ?? 'POD review state is unavailable.');
        return;
      }
      setPayload(body);
    } catch {
      setPayload(null);
      setError('POD review state is unavailable.');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => { void load(); }, [load]);

  const allowedActions = useMemo(() => {
    const hasEvidence = Boolean(payload?.evidence?.hasPhysicalEvidence);
    const current = payload?.platformReview?.status ?? null;
    const actions: ReviewAction[] = [];
    if (hasEvidence && current !== 'approved') actions.push('approve');
    if (hasEvidence && current !== 'rejected') actions.push('reject');
    if (!hasEvidence && current !== 'missing_requested') actions.push('request_missing');
    return actions;
  }, [payload?.evidence?.hasPhysicalEvidence, payload?.platformReview?.status]);

  const execute = async (action: ReviewAction) => {
    if (reason.trim().length < 5 || !jobId) {
      setMessage('Enter a review reason of at least 5 characters.');
      return;
    }

    setSubmitting(action);
    setMessage(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) throw new Error('No active Platform Owner session.');
      const response = await fetch(`/api/super-admin/pod/${encodeURIComponent(jobId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({ action, reason: reason.trim() }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Platform POD review failed.');
      setReason('');
      setMessage(`${actionCopy[action].label} recorded.`);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Platform POD review failed.');
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) return <div style={stateStyle}>Loading Platform POD review…</div>;
  if (error || !payload?.job || !payload.evidence) {
    return <div role="alert" style={{ ...stateStyle, color: C.danger }}>{error ?? 'POD review unavailable.'}</div>;
  }

  const { job, evidence, brokerReview, platformReview } = payload;

  return (
    <div style={{ minHeight: '100vh', background: C.light, color: C.charcoal, padding: 14 }}>
      <div style={{ marginBottom: 12 }}>
        <Link href="/super-admin/operations/pods" style={{ color: C.blue, fontSize: 11, fontWeight: 800, textDecoration: 'none' }}>← Back to PODs</Link>
      </div>

      <header style={{ border: `1px solid ${C.border}`, borderRadius: 12, background: C.white, padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: C.blue, fontSize: 9, fontWeight: 900, textTransform: 'uppercase' }}>Platform Owner POD Review</div>
            <h1 style={{ margin: '5px 0 0', color: C.navy, fontSize: 22, fontWeight: 900 }}>{job.reference}</h1>
            <div style={{ marginTop: 5, color: C.muted, fontSize: 11 }}>{job.pickup ?? 'Pickup'} → {job.delivery ?? 'Delivery'}</div>
          </div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <span style={badgeStyle}>{job.status ?? 'unknown'}</span>
            <span style={{ ...badgeStyle, borderColor: platformReview ? `${C.blue}55` : C.border, color: platformReview ? C.blue : C.muted }}>
              {platformReview?.status ?? 'unreviewed'}
            </span>
          </div>
        </div>
      </header>

      {payload.previewReadOnly ? (
        <div style={{ marginBottom: 12, border: `1px solid ${C.border}`, borderLeft: `4px solid ${C.orange}`, borderRadius: 8, background: C.white, padding: 10, fontSize: 11 }}>
          Deploy Preview is read-only. Review controls are shown for inspection but mutations are blocked server-side.
        </div>
      ) : null}

      <section style={{ marginBottom: 12 }}>
        <h2 style={sectionTitle}>Physical evidence</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 }}>
          <Stat label="Physical evidence" value={evidence.hasPhysicalEvidence ? 'Present' : 'Missing'} />
          <Stat label="Signature" value={evidence.signaturePresent ? 'Present' : 'Missing'} />
          <Stat label="Delivery photos" value={String(evidence.deliveryPhotoCount)} />
          <Stat label="POD photos" value={String(evidence.podPhotoCount)} />
          <Stat label="Hard copy" value={evidence.hardCopyPresent ? 'Present' : 'Missing'} />
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 10, marginBottom: 12 }}>
        <section style={panelStyle}>
          <h2 style={sectionTitle}>Broker review</h2>
          <p style={reviewStatusStyle}>{brokerReview?.status ?? 'No broker review recorded'}</p>
          <p style={bodyStyle}>{brokerReview?.note ?? 'No broker review note.'}</p>
          {brokerReview?.reviewedAt ? <div style={metaStyle}>{brokerReview.reviewedAt}</div> : null}
        </section>

        <section style={panelStyle}>
          <h2 style={sectionTitle}>Platform Owner review</h2>
          <p style={reviewStatusStyle}>{platformReview?.status ?? 'No Platform Owner review recorded'}</p>
          <p style={bodyStyle}>{platformReview?.note ?? 'No Platform Owner review note.'}</p>
          {platformReview?.reviewedAt ? <div style={metaStyle}>{platformReview.reviewedAt}</div> : null}
        </section>
      </div>

      <section style={panelStyle}>
        <h2 style={sectionTitle}>Platform Owner decision</h2>
        <p style={{ ...bodyStyle, marginBottom: 10 }}>
          This review is independent from broker POD review provenance. Every decision requires a reason and is written to the Platform Owner audit ledger.
        </p>

        <label htmlFor="pod-review-reason" style={{ display: 'block', color: C.navy, fontSize: 10, fontWeight: 800, marginBottom: 5 }}>Review reason</label>
        <textarea
          id="pod-review-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={4}
          maxLength={2000}
          disabled={Boolean(payload.previewReadOnly) || Boolean(submitting)}
          placeholder="Record the evidence review reason and any remediation required…"
          style={{ width: '100%', resize: 'vertical', border: `1px solid ${C.border}`, borderRadius: 8, padding: 9, font: 'inherit', fontSize: 11, color: C.charcoal, background: payload.previewReadOnly ? C.light : C.white }}
        />

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {allowedActions.map((action) => (
            <button
              key={action}
              type="button"
              disabled={Boolean(payload.previewReadOnly) || Boolean(submitting)}
              onClick={() => void execute(action)}
              title={actionCopy[action].description}
              style={{ minHeight: 36, border: `1px solid ${actionCopy[action].tone}`, borderRadius: 7, background: action === 'approve' ? actionCopy[action].tone : C.white, color: action === 'approve' ? C.white : actionCopy[action].tone, padding: '0 12px', fontSize: 11, fontWeight: 800, cursor: payload.previewReadOnly || submitting ? 'not-allowed' : 'pointer', opacity: payload.previewReadOnly || submitting ? 0.55 : 1 }}
            >
              {submitting === action ? 'Saving…' : actionCopy[action].label}
            </button>
          ))}
          {allowedActions.length === 0 ? <span style={{ color: C.muted, fontSize: 11 }}>No additional semantic POD action is currently required.</span> : null}
        </div>

        {message ? <div role="status" style={{ marginTop: 10, color: message.includes('failed') || message.includes('read-only') ? C.danger : C.navy, fontSize: 11 }}>{message}</div> : null}
      </section>
    </div>
  );
}

const panelStyle = { border: `1px solid ${C.border}`, borderRadius: 10, background: C.white, padding: 12 } as const;
const sectionTitle = { margin: '0 0 8px', color: C.navy, fontSize: 13, fontWeight: 900 } as const;
const bodyStyle = { margin: 0, color: C.muted, fontSize: 10.5, lineHeight: 1.5 } as const;
const metaStyle = { marginTop: 7, color: C.muted, fontSize: 9 } as const;
const reviewStatusStyle = { margin: '0 0 5px', color: C.charcoal, fontSize: 11, fontWeight: 800 } as const;
const badgeStyle = { border: `1px solid ${C.border}`, borderRadius: 999, background: C.light, color: C.charcoal, padding: '3px 8px', fontSize: 9, fontWeight: 800 } as const;
const stateStyle = { margin: 14, border: `1px solid ${C.border}`, borderRadius: 10, background: C.white, padding: 16, color: C.muted, fontSize: 11 } as const;

export default function Page() {
  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <ReviewPage />
    </ProtectedRoute>
  );
}
