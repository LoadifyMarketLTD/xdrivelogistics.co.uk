'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

const THEME = {
  pageBg: '#0f172a',
  cardBg: '#1e293b',
  cardBorder: '#334155',
  text: '#f1f5f9',
  muted: '#94a3b8',
  accent: '#f59e0b',
  green: '#22c55e',
  red: '#ef4444',
  blue: '#3b82f6',
};

type Company = {
  id: string;
  name: string;
  company_number: string | null;
  email: string | null;
  status: string;
  company_type: string | null;
  created_at: string;
};

type Readiness = {
  companyId: string;
  registrationProvided: boolean;
  emailProvided: boolean;
  driverCount: number;
  vehicleCount: number;
  documentCount: number;
  approvedDocuments: number;
  pendingDocuments: number;
  rejectedDocuments: number;
  expiredDocuments: number;
  readinessScore: number;
  readiness: 'ready' | 'review' | 'blocked';
};

type PendingAction = {
  companyId: string;
  companyName: string;
  action: 'approve' | 'reject';
  readiness?: Readiness;
} | null;

const badgeStyle = (tone: 'green' | 'amber' | 'red' | 'blue' | 'slate') => {
  const colors = {
    green: { fg: '#86efac', bg: 'rgba(34,197,94,.12)', border: 'rgba(34,197,94,.35)' },
    amber: { fg: '#fcd34d', bg: 'rgba(245,158,11,.12)', border: 'rgba(245,158,11,.35)' },
    red: { fg: '#fca5a5', bg: 'rgba(239,68,68,.12)', border: 'rgba(239,68,68,.35)' },
    blue: { fg: '#93c5fd', bg: 'rgba(59,130,246,.12)', border: 'rgba(59,130,246,.35)' },
    slate: { fg: '#cbd5e1', bg: 'rgba(148,163,184,.1)', border: 'rgba(148,163,184,.3)' },
  }[tone];
  return {
    display: 'inline-flex', alignItems: 'center', gap: '.3rem',
    border: `1px solid ${colors.border}`, backgroundColor: colors.bg, color: colors.fg,
    borderRadius: '999px', padding: '.2rem .5rem', fontSize: '.68rem', fontWeight: 700,
    whiteSpace: 'nowrap' as const,
  };
};

function ConfirmModal({ pending, onConfirm, onCancel, submitting }: {
  pending: PendingAction;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [reason, setReason] = useState('');
  useEffect(() => { setReason(''); }, [pending?.companyId, pending?.action]);
  if (!pending) return null;

  const isReject = pending.action === 'reject';
  const readiness = pending.readiness;
  const hasBlockers = readiness?.readiness === 'blocked';
  const isDisabled = submitting || (isReject && reason.trim().length < 5);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <div style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '14px', padding: '1.5rem', width: '100%', maxWidth: '520px' }}>
        <h2 style={{ margin: '0 0 .45rem', fontSize: '1.1rem', color: THEME.text }}>{isReject ? '❌ Reject company' : '✅ Approve company'}</h2>
        <p style={{ margin: '0 0 1rem', color: THEME.muted, fontSize: '.84rem', lineHeight: 1.5 }}>
          {isReject
            ? <>You are about to reject <strong style={{ color: THEME.text }}>{pending.companyName}</strong>. This action is recorded in the audit log.</>
            : <>You are about to approve <strong style={{ color: THEME.text }}>{pending.companyName}</strong> and grant platform access.</>}
        </p>

        {readiness && (
          <div style={{ border: `1px solid ${THEME.cardBorder}`, borderRadius: '10px', padding: '.8rem', marginBottom: '1rem', backgroundColor: '#0b1220' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.75rem', alignItems: 'center', marginBottom: '.6rem' }}>
              <strong style={{ color: THEME.text, fontSize: '.8rem' }}>Approval readiness</strong>
              <span style={badgeStyle(hasBlockers ? 'red' : readiness.readiness === 'review' ? 'amber' : 'green')}>{readiness.readinessScore}/100 · {readiness.readiness.toUpperCase()}</span>
            </div>
            <div style={{ color: THEME.muted, fontSize: '.74rem', lineHeight: 1.65 }}>
              Registration provided: {readiness.registrationProvided ? 'Yes' : 'No'} · Email provided: {readiness.emailProvided ? 'Yes' : 'No'}<br />
              Documents: {readiness.approvedDocuments} approved, {readiness.pendingDocuments} pending, {readiness.rejectedDocuments} rejected, {readiness.expiredDocuments} expired
            </div>
            {hasBlockers && !isReject && (
              <div style={{ color: '#fca5a5', fontSize: '.74rem', marginTop: '.55rem' }}>
                ⚠ This company has rejected or expired compliance documents. Approval is still a deliberate owner action, not an automatic decision.
              </div>
            )}
          </div>
        )}

        <label style={{ display: 'block', marginBottom: '.35rem', fontSize: '.78rem', fontWeight: 600, color: THEME.muted }}>
          {isReject ? 'Reason for rejection (required)' : 'Reason / notes (optional)'}
        </label>
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} placeholder={isReject ? 'Explain why this application is being rejected…' : 'Approval notes (optional)…'} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0b1220', border: `1px solid ${THEME.cardBorder}`, borderRadius: '8px', padding: '.6rem .75rem', color: THEME.text, fontSize: '.82rem', resize: 'vertical' }} />
        {isReject && reason.trim().length > 0 && reason.trim().length < 5 && <p style={{ color: THEME.red, fontSize: '.72rem', margin: '.3rem 0 0' }}>Reason must be at least 5 characters.</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.5rem', marginTop: '1.1rem' }}>
          <button onClick={onCancel} disabled={submitting} style={{ padding: '.45rem .9rem', borderRadius: '7px', border: `1px solid ${THEME.cardBorder}`, background: 'transparent', color: THEME.muted, cursor: submitting ? 'not-allowed' : 'pointer' }}>Cancel</button>
          <button onClick={() => onConfirm(reason.trim())} disabled={isDisabled} style={{ padding: '.45rem .9rem', borderRadius: '7px', border: 0, backgroundColor: isReject ? THEME.red : THEME.green, color: '#fff', fontWeight: 700, cursor: isDisabled ? 'not-allowed' : 'pointer', opacity: isDisabled ? .6 : 1 }}>
            {submitting ? 'Working…' : isReject ? 'Confirm Rejection' : 'Confirm Approval'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReadinessCell({ readiness }: { readiness?: Readiness }) {
  if (!readiness) return <span style={badgeStyle('slate')}>Unavailable</span>;
  const tone = readiness.readiness === 'ready' ? 'green' : readiness.readiness === 'blocked' ? 'red' : 'amber';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem', minWidth: 155 }}>
      <span style={badgeStyle(tone)}>{readiness.readinessScore}/100 · {readiness.readiness}</span>
      <span style={{ color: THEME.muted, fontSize: '.68rem' }}>
        {readiness.approvedDocuments}/{readiness.documentCount} docs approved
        {readiness.expiredDocuments > 0 ? ` · ${readiness.expiredDocuments} expired` : ''}
        {readiness.rejectedDocuments > 0 ? ` · ${readiness.rejectedDocuments} rejected` : ''}
      </span>
    </div>
  );
}

function ApprovalsContent() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [readinessByCompany, setReadinessByCompany] = useState<Record<string, Readiness>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) { setError('No active session.'); return; }
      const [companiesResponse, readinessResponse] = await Promise.all([
        fetch('/api/super-admin/companies?status=pending&limit=100', { headers: { Authorization: auth } }),
        fetch('/api/super-admin/companies/approval-readiness', { headers: { Authorization: auth } }),
      ]);

      const companiesPayload = await companiesResponse.json().catch(() => ({}));
      if (!companiesResponse.ok) {
        setError((companiesPayload as { error?: string }).error ?? `HTTP ${companiesResponse.status}`);
        return;
      }
      setCompanies((companiesPayload as { companies?: Company[] }).companies ?? []);

      const readinessPayload = await readinessResponse.json().catch(() => ({}));
      if (readinessResponse.ok) {
        setReadinessByCompany((readinessPayload as { readiness?: Record<string, Readiness> }).readiness ?? {});
      } else {
        setReadinessByCompany({});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fetch failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  const summary = useMemo(() => {
    const readinessValues = companies.map((company) => readinessByCompany[company.id]).filter(Boolean);
    return {
      total: companies.length,
      ready: readinessValues.filter((item) => item.readiness === 'ready').length,
      review: readinessValues.filter((item) => item.readiness === 'review').length,
      blocked: readinessValues.filter((item) => item.readiness === 'blocked').length,
    };
  }, [companies, readinessByCompany]);

  const openModal = (company: Company, action: 'approve' | 'reject') => {
    setActionMessage(null);
    setPending({ companyId: company.id, companyName: company.name, action, readiness: readinessByCompany[company.id] });
  };

  const handleConfirm = async (reason: string) => {
    if (!pending) return;
    setSubmitting(true);
    try {
      const auth = await getAuthHeader();
      if (!auth) { setActionMessage('No active session.'); return; }
      const body: Record<string, string> = { action: pending.action };
      if (reason) body.reason = reason;
      const response = await fetch(`/api/super-admin/companies/${pending.companyId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: auth }, body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) setActionMessage((payload as { error?: string }).error ?? `HTTP ${response.status}`);
      else {
        setActionMessage(`Company ${pending.action === 'approve' ? 'approved ✅' : 'rejected ❌'} successfully.`);
        await fetchPending();
      }
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setPending(null);
      setSubmitting(false);
    }
  };

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <>
      <ConfirmModal pending={pending} onConfirm={handleConfirm} onCancel={() => setPending(null)} submitting={submitting} />
      <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>✅</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: THEME.text, margin: 0 }}>Approvals Queue</h1>
                <span style={{ fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: THEME.accent, backgroundColor: 'rgba(245,158,11,.12)', padding: '.15rem .5rem', borderRadius: '4px' }}>Companies</span>
              </div>
              <p style={{ color: THEME.muted, margin: '.25rem 0 0', fontSize: '.85rem' }}>Review company identity and available compliance evidence before granting platform access.</p>
            </div>
          </div>
          <button onClick={fetchPending} disabled={loading} style={{ border: `1px solid ${THEME.cardBorder}`, background: '#172033', color: THEME.text, borderRadius: '8px', padding: '.5rem .85rem', cursor: loading ? 'not-allowed' : 'pointer' }}>↻ Refresh</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: '.75rem', marginBottom: '1rem' }}>
          {[['Pending', summary.total, 'blue'], ['Ready', summary.ready, 'green'], ['Needs review', summary.review, 'amber'], ['Blocked', summary.blocked, 'red']].map(([label, value, tone]) => (
            <div key={String(label)} style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '10px', padding: '.8rem .9rem' }}>
              <div style={{ color: THEME.muted, fontSize: '.69rem', textTransform: 'uppercase', fontWeight: 700 }}>{label}</div>
              <div style={{ color: tone === 'red' ? '#f87171' : tone === 'green' ? '#4ade80' : tone === 'amber' ? '#fbbf24' : '#60a5fa', fontWeight: 800, fontSize: '1.35rem', marginTop: '.2rem' }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ backgroundColor: 'rgba(59,130,246,.08)', border: '1px solid rgba(59,130,246,.35)', borderRadius: '8px', padding: '.65rem .9rem', color: '#bfdbfe', fontSize: '.76rem', marginBottom: '1rem' }}>
          ℹ Readiness uses evidence available in the connected schema (registration/email presence and driver/vehicle document status). It does not claim Companies House, VAT or identity verification unless a verified source exists.
        </div>

        {actionMessage && <div style={{ backgroundColor: 'rgba(245,158,11,.1)', border: `1px solid ${THEME.accent}`, borderRadius: '8px', padding: '.65rem .9rem', color: THEME.accent, fontSize: '.82rem', marginBottom: '1rem' }}>{actionMessage}</div>}
        {error && <div style={{ backgroundColor: 'rgba(239,68,68,.1)', border: `1px solid ${THEME.red}`, borderRadius: '8px', padding: '.65rem .9rem', color: THEME.red, fontSize: '.82rem', marginBottom: '1rem' }}>⚠️ {error}</div>}

        <div style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '12px', overflowX: 'auto' }}>
          {loading ? <div style={{ padding: '2rem', textAlign: 'center', color: THEME.muted }}>Loading approval evidence…</div> : companies.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: THEME.muted }}>No companies pending approval.</div>
          ) : (
            <table style={{ width: '100%', minWidth: 1180, borderCollapse: 'collapse', fontSize: '.8rem' }}>
              <thead><tr style={{ borderBottom: `1px solid ${THEME.cardBorder}` }}>{['Company', 'Registration', 'Email', 'Type', 'Resources', 'Compliance readiness', 'Applied', 'Actions'].map((header) => <th key={header} style={{ padding: '.75rem .8rem', textAlign: 'left', color: THEME.muted, fontWeight: 700, fontSize: '.69rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>{header}</th>)}</tr></thead>
              <tbody>{companies.map((company) => {
                const readiness = readinessByCompany[company.id];
                const acting = submitting && pending?.companyId === company.id;
                return <tr key={company.id} style={{ borderBottom: `1px solid ${THEME.cardBorder}` }}>
                  <td style={{ padding: '.8rem', color: THEME.text, fontWeight: 700 }}>{company.name}</td>
                  <td style={{ padding: '.8rem' }}>{company.company_number ? <span style={badgeStyle('green')}>Provided · {company.company_number}</span> : <span style={badgeStyle('amber')}>Missing</span>}</td>
                  <td style={{ padding: '.8rem', color: THEME.muted }}>{company.email ?? '—'}</td>
                  <td style={{ padding: '.8rem', color: THEME.muted }}>{company.company_type ?? 'standard'}</td>
                  <td style={{ padding: '.8rem', color: THEME.muted }}>{readiness ? `${readiness.driverCount} drivers · ${readiness.vehicleCount} vehicles` : '—'}</td>
                  <td style={{ padding: '.8rem' }}><ReadinessCell readiness={readiness} /></td>
                  <td style={{ padding: '.8rem', color: THEME.muted }}>{fmt(company.created_at)}</td>
                  <td style={{ padding: '.8rem' }}><div style={{ display: 'flex', gap: '.4rem' }}>
                    <button onClick={() => openModal(company, 'approve')} disabled={acting} style={{ padding: '.32rem .65rem', borderRadius: '6px', border: 0, backgroundColor: THEME.green, color: '#fff', fontWeight: 700, cursor: acting ? 'not-allowed' : 'pointer', opacity: acting ? .6 : 1 }}>Approve</button>
                    <button onClick={() => openModal(company, 'reject')} disabled={acting} style={{ padding: '.32rem .65rem', borderRadius: '6px', border: `1px solid ${THEME.red}`, background: 'transparent', color: THEME.red, fontWeight: 700, cursor: acting ? 'not-allowed' : 'pointer', opacity: acting ? .6 : 1 }}>Reject</button>
                  </div></td>
                </tr>;
              })}</tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

export default function Page() {
  return <ProtectedRoute allowedRoles={['owner']}><ApprovalsContent /></ProtectedRoute>;
}
