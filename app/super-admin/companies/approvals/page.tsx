'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

const THEME = {
  pageBg: '#F5F7FA',
  cardBg: '#FFFFFF',
  cardBorder: '#E0E3E7',
  text: '#4A4A4A',
  heading: '#1A73E8',
  muted: '#4A4A4A',
  accent: '#FBBC05',
  green: '#34A853',
  red: '#EA4335',
  blue: '#1A73E8',
  amber: '#FBBC05',
  shadow: '0px 2px 6px rgba(0,0,0,0.08)',
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

const titleStyle = {
  fontFamily: 'Inter, Roboto, Arial, sans-serif',
  fontSize: '20px',
  fontWeight: 700,
  color: THEME.heading,
} as const;

const badgeStyle = (tone: 'green' | 'amber' | 'red' | 'blue' | 'slate') => {
  const colors = {
    green: { fg: '#1F6E34', bg: '#F2FBF4', border: THEME.green },
    amber: { fg: '#6A5100', bg: '#FFFBEA', border: THEME.amber },
    red: { fg: '#9C2E26', bg: '#FFF3F2', border: THEME.red },
    blue: { fg: THEME.blue, bg: '#F1F7FF', border: THEME.blue },
    slate: { fg: THEME.text, bg: THEME.pageBg, border: THEME.cardBorder },
  }[tone];

  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    border: `1px solid ${colors.border}`,
    backgroundColor: colors.bg,
    color: colors.fg,
    borderRadius: '8px',
    padding: '4px 8px',
    fontFamily: 'Inter, Roboto, Arial, sans-serif',
    fontSize: '14px',
    fontWeight: 700,
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
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(15, 23, 42, .48)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
      }}
      onClick={(event) => { if (event.target === event.currentTarget) onCancel(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          backgroundColor: THEME.cardBg,
          border: `1px solid ${THEME.cardBorder}`,
          borderRadius: '8px',
          boxShadow: THEME.shadow,
          padding: '24px',
          width: '100%',
          maxWidth: '520px',
          color: THEME.text,
          fontFamily: 'Roboto, Inter, Arial, sans-serif',
          fontSize: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <span aria-hidden="true" style={{ width: '24px', height: '24px', display: 'grid', placeItems: 'center', borderRadius: '8px', background: isReject ? THEME.red : THEME.green, color: '#FFFFFF', fontSize: '14px', fontWeight: 700 }}>
            {isReject ? '×' : '✓'}
          </span>
          <h2 style={{ ...titleStyle, margin: 0 }}>{isReject ? 'Reject company' : 'Approve company'}</h2>
        </div>

        <p style={{ margin: '0 0 16px', color: THEME.text, fontSize: '14px', lineHeight: 1.5 }}>
          {isReject
            ? <>You are about to reject <strong>{pending.companyName}</strong>. This action is recorded in the audit log.</>
            : <>You are about to approve <strong>{pending.companyName}</strong> and grant platform access.</>}
        </p>

        {readiness && (
          <div style={{ border: `1px solid ${THEME.cardBorder}`, borderRadius: '8px', padding: '24px', marginBottom: '16px', backgroundColor: THEME.pageBg, boxShadow: THEME.shadow }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
              <strong style={titleStyle}>Approval readiness</strong>
              <span style={badgeStyle(hasBlockers ? 'red' : readiness.readiness === 'review' ? 'amber' : 'green')}>
                {readiness.readinessScore}/100 · {readiness.readiness.toUpperCase()}
              </span>
            </div>
            <div style={{ color: THEME.text, fontSize: '14px', lineHeight: 1.6 }}>
              Registration provided: {readiness.registrationProvided ? 'Yes' : 'No'} · Email provided: {readiness.emailProvided ? 'Yes' : 'No'}<br />
              Documents: {readiness.approvedDocuments} approved, {readiness.pendingDocuments} pending, {readiness.rejectedDocuments} rejected, {readiness.expiredDocuments} expired
            </div>
            {hasBlockers && !isReject && (
              <div style={{ color: THEME.red, fontSize: '14px', marginTop: '12px', fontWeight: 700 }}>
                This company has rejected or expired compliance documents. Approval is still a deliberate owner action, not an automatic decision.
              </div>
            )}
          </div>
        )}

        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 700, color: THEME.text }}>
          {isReject ? 'Reason for rejection (required)' : 'Reason / notes (optional)'}
        </label>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={4}
          placeholder={isReject ? 'Explain why this application is being rejected…' : 'Approval notes (optional)…'}
          style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#FFFFFF', border: `1px solid ${THEME.cardBorder}`, borderRadius: '8px', padding: '24px', color: THEME.text, fontSize: '14px', resize: 'vertical', outlineColor: THEME.blue }}
        />
        {isReject && reason.trim().length > 0 && reason.trim().length < 5 && (
          <p style={{ color: THEME.red, fontSize: '14px', margin: '8px 0 0' }}>Reason must be at least 5 characters.</p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
          <button onClick={onCancel} disabled={submitting} style={{ minHeight: '40px', padding: '0 14px', borderRadius: '8px', border: `1px solid ${THEME.cardBorder}`, background: '#FFFFFF', color: THEME.text, fontFamily: 'Inter, Roboto, Arial, sans-serif', fontSize: '14px', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}>
            Cancel
          </button>
          <button onClick={() => onConfirm(reason.trim())} disabled={isDisabled} style={{ minHeight: '40px', padding: '0 14px', borderRadius: '8px', border: 0, backgroundColor: isReject ? THEME.red : THEME.green, color: '#FFFFFF', fontFamily: 'Inter, Roboto, Arial, sans-serif', fontSize: '14px', fontWeight: 700, cursor: isDisabled ? 'not-allowed' : 'pointer', opacity: isDisabled ? .6 : 1 }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 155 }}>
      <span style={badgeStyle(tone)}>{readiness.readinessScore}/100 · {readiness.readiness}</span>
      <span style={{ color: THEME.text, fontSize: '14px' }}>
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
      <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, color: THEME.text, padding: '24px', fontFamily: 'Roboto, Inter, Arial, sans-serif', fontSize: '14px' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <span aria-hidden="true" style={{ width: '24px', height: '24px', display: 'grid', placeItems: 'center', borderRadius: '8px', background: THEME.heading, color: '#FFFFFF', fontSize: '14px', fontWeight: 700 }}>✓</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h1 style={{ ...titleStyle, margin: 0 }}>Approvals Queue</h1>
              <span style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', color: THEME.blue, backgroundColor: '#F1F7FF', padding: '4px 8px', borderRadius: '8px' }}>Companies</span>
              <span style={{ fontSize: '14px', color: THEME.text }}>{loading ? '…' : `${companies.length} pending`}</span>
            </div>
            <p style={{ color: THEME.text, margin: '6px 0 0', fontSize: '14px' }}>Review company identity and available compliance evidence before granting platform access.</p>
          </div>
          <button onClick={fetchPending} disabled={loading} style={{ minHeight: '40px', padding: '0 14px', borderRadius: '8px', border: `1px solid ${THEME.blue}`, background: THEME.blue, color: '#FFFFFF', fontFamily: 'Inter, Roboto, Arial, sans-serif', fontWeight: 700, fontSize: '14px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .65 : 1 }}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(150px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {[
            ['Pending', summary.total, THEME.blue],
            ['Ready', summary.ready, THEME.green],
            ['Blocked', summary.blocked, THEME.red],
            ['Needs Review', summary.review, THEME.amber],
          ].map(([label, value, color]) => (
            <div key={String(label)} style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '8px', padding: '24px', boxShadow: THEME.shadow }}>
              <div style={{ ...titleStyle, color: THEME.text }}>{label}</div>
              <div style={{ color: String(color), fontFamily: 'Inter, Roboto, Arial, sans-serif', fontWeight: 700, fontSize: '20px', marginTop: '8px' }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ backgroundColor: '#F1F7FF', border: `1px solid ${THEME.blue}`, borderLeft: `4px solid ${THEME.blue}`, borderRadius: '8px', padding: '24px', color: THEME.text, fontSize: '14px', lineHeight: 1.5, marginBottom: '24px', boxShadow: THEME.shadow }}>
          Readiness uses evidence available in the connected schema (registration/email presence and driver/vehicle document status). It does not claim Companies House, VAT or identity verification unless a verified source exists.
        </div>

        {actionMessage && <div role="status" style={{ backgroundColor: '#FFFBEA', border: `1px solid ${THEME.amber}`, borderLeft: `4px solid ${THEME.amber}`, borderRadius: '8px', padding: '24px', color: THEME.text, fontSize: '14px', fontWeight: 700, marginBottom: '24px', boxShadow: THEME.shadow }}>{actionMessage}</div>}
        {error && <div role="alert" style={{ backgroundColor: '#FFF3F2', border: `1px solid ${THEME.red}`, borderLeft: `4px solid ${THEME.red}`, borderRadius: '8px', padding: '24px', color: THEME.red, fontSize: '14px', fontWeight: 700, marginBottom: '24px', boxShadow: THEME.shadow }}>{error}</div>}

        <section style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '8px', overflow: 'hidden', boxShadow: THEME.shadow }}>
          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: THEME.text, fontSize: '14px' }}>Loading approval evidence…</div>
          ) : companies.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: THEME.text, fontSize: '14px' }}>No companies pending approval.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 1180, borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: THEME.pageBg, borderBottom: `1px solid ${THEME.cardBorder}` }}>
                    {['Company', 'Registration', 'Email', 'Type', 'Resources', 'Compliance Readiness', 'Applied', 'Actions'].map((header) => (
                      <th key={header} style={{ padding: '24px', textAlign: 'left', color: THEME.heading, fontFamily: 'Inter, Roboto, Arial, sans-serif', fontWeight: 700, fontSize: '14px', whiteSpace: 'nowrap' }}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company) => {
                    const readiness = readinessByCompany[company.id];
                    const acting = submitting && pending?.companyId === company.id;
                    return (
                      <tr key={company.id} style={{ borderBottom: `1px solid ${THEME.cardBorder}` }}>
                        <td style={{ padding: '24px', color: THEME.text, fontWeight: 700 }}>{company.name}</td>
                        <td style={{ padding: '24px' }}>{company.company_number ? <span style={badgeStyle('green')}>Provided · {company.company_number}</span> : <span style={badgeStyle('amber')}>Missing</span>}</td>
                        <td style={{ padding: '24px', color: THEME.text }}>{company.email ?? '—'}</td>
                        <td style={{ padding: '24px', color: THEME.text }}>{company.company_type ?? 'standard'}</td>
                        <td style={{ padding: '24px', color: THEME.text }}>{readiness ? `${readiness.driverCount} drivers · ${readiness.vehicleCount} vehicles` : '—'}</td>
                        <td style={{ padding: '24px' }}><ReadinessCell readiness={readiness} /></td>
                        <td style={{ padding: '24px', color: THEME.text }}>{fmt(company.created_at)}</td>
                        <td style={{ padding: '24px' }}>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button onClick={() => openModal(company, 'approve')} disabled={acting} style={{ minHeight: '40px', padding: '0 14px', borderRadius: '8px', border: `1px solid ${THEME.green}`, backgroundColor: THEME.green, color: '#FFFFFF', fontFamily: 'Inter, Roboto, Arial, sans-serif', fontSize: '14px', fontWeight: 700, cursor: acting ? 'not-allowed' : 'pointer', opacity: acting ? .6 : 1 }}>Approve</button>
                            <button onClick={() => openModal(company, 'reject')} disabled={acting} style={{ minHeight: '40px', padding: '0 14px', borderRadius: '8px', border: `1px solid ${THEME.red}`, background: '#FFFFFF', color: THEME.red, fontFamily: 'Inter, Roboto, Arial, sans-serif', fontSize: '14px', fontWeight: 700, cursor: acting ? 'not-allowed' : 'pointer', opacity: acting ? .6 : 1 }}>Reject</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export default function Page() {
  return <ProtectedRoute allowedRoles={['owner']}><ApprovalsContent /></ProtectedRoute>;
}
