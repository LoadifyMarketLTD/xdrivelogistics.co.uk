'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

const THEME = {
  pageBg: '#F4F6F8',
  cardBg: '#FFFFFF',
  cardBorder: '#D9E1EA',
  text: '#1A1F2B',
  heading: '#0B2F6B',
  muted: '#64748B',
  accent: '#F5A300',
  green: '#16A34A',
  red: '#DC2626',
  blue: '#1D57D8',
  amber: '#D97706',
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
    green: { fg: '#166534', bg: '#F0FDF4', border: '#BBF7D0' },
    amber: { fg: '#92400E', bg: '#FFFBEB', border: '#FDE68A' },
    red: { fg: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
    blue: { fg: '#1D4ED8', bg: '#EEF4FF', border: '#BFDBFE' },
    slate: { fg: '#475569', bg: '#F8FAFC', border: '#CBD5E1' },
  }[tone];

  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    border: `1px solid ${colors.border}`,
    backgroundColor: colors.bg,
    color: colors.fg,
    borderRadius: '4px',
    padding: '2px 5px',
    fontSize: '10px',
    fontWeight: 800,
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
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(15, 23, 42, .48)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(event) => { if (event.target === event.currentTarget) onCancel(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          backgroundColor: THEME.cardBg,
          border: `1px solid ${THEME.cardBorder}`,
          borderRadius: '6px',
          boxShadow: '0 20px 50px rgba(15, 23, 42, .18)',
          padding: '18px',
          width: '100%',
          maxWidth: '520px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '8px' }}>
          <span
            aria-hidden="true"
            style={{
              width: '28px',
              height: '28px',
              display: 'grid',
              placeItems: 'center',
              borderRadius: '4px',
              background: isReject ? THEME.red : THEME.green,
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 900,
            }}
          >
            {isReject ? '×' : '✓'}
          </span>
          <h2 style={{ margin: 0, fontSize: '17px', color: THEME.heading, fontWeight: 800 }}>
            {isReject ? 'Reject company' : 'Approve company'}
          </h2>
        </div>

        <p style={{ margin: '0 0 14px', color: THEME.muted, fontSize: '12px', lineHeight: 1.55 }}>
          {isReject
            ? <>You are about to reject <strong style={{ color: THEME.text }}>{pending.companyName}</strong>. This action is recorded in the audit log.</>
            : <>You are about to approve <strong style={{ color: THEME.text }}>{pending.companyName}</strong> and grant platform access.</>}
        </p>

        {readiness && (
          <div style={{ border: `1px solid ${THEME.cardBorder}`, borderRadius: '4px', padding: '10px 12px', marginBottom: '14px', backgroundColor: THEME.pageBg }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', marginBottom: '7px', flexWrap: 'wrap' }}>
              <strong style={{ color: THEME.heading, fontSize: '11px' }}>Approval readiness</strong>
              <span style={badgeStyle(hasBlockers ? 'red' : readiness.readiness === 'review' ? 'amber' : 'green')}>
                {readiness.readinessScore}/100 · {readiness.readiness.toUpperCase()}
              </span>
            </div>
            <div style={{ color: THEME.muted, fontSize: '11px', lineHeight: 1.6 }}>
              Registration provided: {readiness.registrationProvided ? 'Yes' : 'No'} · Email provided: {readiness.emailProvided ? 'Yes' : 'No'}<br />
              Documents: {readiness.approvedDocuments} approved, {readiness.pendingDocuments} pending, {readiness.rejectedDocuments} rejected, {readiness.expiredDocuments} expired
            </div>
            {hasBlockers && !isReject && (
              <div style={{ color: THEME.red, fontSize: '11px', marginTop: '7px', fontWeight: 700 }}>
                This company has rejected or expired compliance documents. Approval is still a deliberate owner action, not an automatic decision.
              </div>
            )}
          </div>
        )}

        <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: 700, color: THEME.heading }}>
          {isReject ? 'Reason for rejection (required)' : 'Reason / notes (optional)'}
        </label>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={4}
          placeholder={isReject ? 'Explain why this application is being rejected…' : 'Approval notes (optional)…'}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            backgroundColor: '#FFFFFF',
            border: `1px solid ${THEME.cardBorder}`,
            borderRadius: '4px',
            padding: '8px 10px',
            color: THEME.text,
            fontSize: '12px',
            resize: 'vertical',
            outlineColor: THEME.blue,
          }}
        />
        {isReject && reason.trim().length > 0 && reason.trim().length < 5 && (
          <p style={{ color: THEME.red, fontSize: '10px', margin: '4px 0 0' }}>Reason must be at least 5 characters.</p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '7px', marginTop: '14px', flexWrap: 'wrap' }}>
          <button
            onClick={onCancel}
            disabled={submitting}
            style={{
              height: '32px',
              padding: '0 11px',
              borderRadius: '4px',
              border: `1px solid ${THEME.cardBorder}`,
              background: '#FFFFFF',
              color: THEME.muted,
              fontSize: '11px',
              fontWeight: 800,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason.trim())}
            disabled={isDisabled}
            style={{
              height: '32px',
              padding: '0 11px',
              borderRadius: '4px',
              border: 0,
              backgroundColor: isReject ? THEME.red : THEME.green,
              color: '#FFFFFF',
              fontSize: '11px',
              fontWeight: 800,
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              opacity: isDisabled ? .6 : 1,
            }}
          >
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 155 }}>
      <span style={badgeStyle(tone)}>{readiness.readinessScore}/100 · {readiness.readiness}</span>
      <span style={{ color: THEME.muted, fontSize: '10px' }}>
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
      <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, color: THEME.text, padding: '12px' }}>
        <header style={{ minHeight: '52px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <span
            aria-hidden="true"
            style={{
              width: '28px',
              height: '28px',
              display: 'grid',
              placeItems: 'center',
              borderRadius: '4px',
              background: THEME.heading,
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 900,
            }}
          >
            ✓
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '20px', fontWeight: 800, color: THEME.heading, margin: 0 }}>Approvals Queue</h1>
              <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: THEME.blue, backgroundColor: '#EEF4FF', padding: '3px 6px', borderRadius: '4px' }}>Companies</span>
              <span style={{ fontSize: '10px', color: THEME.muted }}>{loading ? '…' : `${companies.length} pending`}</span>
            </div>
            <p style={{ color: THEME.muted, margin: '4px 0 0', fontSize: '12px' }}>
              Review company identity and available compliance evidence before granting platform access.
            </p>
          </div>
          <button
            onClick={fetchPending}
            disabled={loading}
            style={{
              height: '32px',
              padding: '0 10px',
              borderRadius: '4px',
              border: `1px solid ${THEME.blue}`,
              background: THEME.blue,
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '11px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? .65 : 1,
            }}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', marginBottom: '12px' }}>
          {[
            ['Pending', summary.total, THEME.blue],
            ['Ready', summary.ready, THEME.green],
            ['Needs review', summary.review, THEME.amber],
            ['Blocked', summary.blocked, THEME.red],
          ].map(([label, value, color]) => (
            <div key={String(label)} style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '4px', padding: '9px 12px' }}>
              <div style={{ color: THEME.muted, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 800 }}>{label}</div>
              <div style={{ color: String(color), fontWeight: 800, fontSize: '20px', marginTop: '2px' }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ backgroundColor: '#EEF4FF', border: '1px solid #BFDBFE', borderLeft: `4px solid ${THEME.blue}`, borderRadius: '4px', padding: '9px 12px', color: '#1E40AF', fontSize: '11px', lineHeight: 1.5, marginBottom: '12px' }}>
          Readiness uses evidence available in the connected schema (registration/email presence and driver/vehicle document status). It does not claim Companies House, VAT or identity verification unless a verified source exists.
        </div>

        {actionMessage && (
          <div role="status" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderLeft: `4px solid ${THEME.accent}`, borderRadius: '4px', padding: '9px 12px', color: '#92400E', fontSize: '11px', fontWeight: 700, marginBottom: '12px' }}>
            {actionMessage}
          </div>
        )}
        {error && (
          <div role="alert" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderLeft: `4px solid ${THEME.red}`, borderRadius: '4px', padding: '9px 12px', color: THEME.red, fontSize: '11px', fontWeight: 700, marginBottom: '12px' }}>
            {error}
          </div>
        )}

        <section style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '4px', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '18px', textAlign: 'center', color: THEME.muted, fontSize: '12px' }}>Loading approval evidence…</div>
          ) : companies.length === 0 ? (
            <div style={{ padding: '18px', textAlign: 'center', color: THEME.muted, fontSize: '12px' }}>No companies pending approval.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 1180, borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ height: '38px', background: THEME.pageBg, borderBottom: `1px solid ${THEME.cardBorder}` }}>
                    {['Company', 'Registration', 'Email', 'Type', 'Resources', 'Compliance readiness', 'Applied', 'Actions'].map((header) => (
                      <th key={header} style={{ padding: '0 12px', textAlign: 'left', color: THEME.heading, fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company) => {
                    const readiness = readinessByCompany[company.id];
                    const acting = submitting && pending?.companyId === company.id;
                    return (
                      <tr key={company.id} style={{ borderBottom: `1px solid ${THEME.cardBorder}` }}>
                        <td style={{ padding: '9px 12px', color: THEME.text, fontWeight: 700 }}>{company.name}</td>
                        <td style={{ padding: '9px 12px' }}>
                          {company.company_number
                            ? <span style={badgeStyle('green')}>Provided · {company.company_number}</span>
                            : <span style={badgeStyle('amber')}>Missing</span>}
                        </td>
                        <td style={{ padding: '9px 12px', color: THEME.muted }}>{company.email ?? '—'}</td>
                        <td style={{ padding: '9px 12px', color: THEME.muted }}>{company.company_type ?? 'standard'}</td>
                        <td style={{ padding: '9px 12px', color: THEME.muted }}>{readiness ? `${readiness.driverCount} drivers · ${readiness.vehicleCount} vehicles` : '—'}</td>
                        <td style={{ padding: '9px 12px' }}><ReadinessCell readiness={readiness} /></td>
                        <td style={{ padding: '9px 12px', color: THEME.muted }}>{fmt(company.created_at)}</td>
                        <td style={{ padding: '9px 12px' }}>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <button
                              onClick={() => openModal(company, 'approve')}
                              disabled={acting}
                              style={{
                                height: '28px',
                                padding: '0 9px',
                                borderRadius: '4px',
                                border: `1px solid ${THEME.green}`,
                                backgroundColor: THEME.green,
                                color: '#FFFFFF',
                                fontSize: '10px',
                                fontWeight: 800,
                                cursor: acting ? 'not-allowed' : 'pointer',
                                opacity: acting ? .6 : 1,
                              }}
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => openModal(company, 'reject')}
                              disabled={acting}
                              style={{
                                height: '28px',
                                padding: '0 9px',
                                borderRadius: '4px',
                                border: `1px solid ${THEME.red}`,
                                background: '#FFFFFF',
                                color: THEME.red,
                                fontSize: '10px',
                                fontWeight: 800,
                                cursor: acting ? 'not-allowed' : 'pointer',
                                opacity: acting ? .6 : 1,
                              }}
                            >
                              Reject
                            </button>
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
