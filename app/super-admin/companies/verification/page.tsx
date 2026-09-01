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
  blue: '#1D57D8',
  muted: '#64748B',
  accent: '#F5A300',
  green: '#16A34A',
  red: '#DC2626',
  warningBg: '#FFF7E6',
};

type OnboardingRow = {
  id: string;
  user_id: string;
  applicant_name: string;
  email: string;
  account_type: string;
  status: string;
  current_step: string;
  completion_percentage: number;
  risk_status: string;
  company_id: string | null;
  company_name: string;
  missing_documents: string[];
  compliance_check_available: boolean;
  ready_for_approval: boolean;
  approval_blockers: string[];
  last_activity_at: string | null;
};

type Preflight = {
  previewReadOnly?: boolean;
  application?: {
    id: string;
    userId: string;
    recipientEmail: string;
    accountType: string;
    status: string;
    completionPercentage: number;
    currentStep: string;
  };
  missingDocuments?: string[];
  missingCount?: number;
  canRequest?: boolean;
  primaryChannel?: string;
  continuationPath?: string;
  outstandingRequest?: {
    id?: string;
    status?: string;
    requested_documents?: string[];
    reason?: string;
    requested_at?: string;
    last_sent_at?: string;
    reminder_count?: number;
    recipient_email?: string;
  } | null;
  requestRegistryAvailable?: boolean;
  requestRegistryNote?: string | null;
  error?: string;
};

const pretty = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const date = (value: string | null | undefined) => value ? new Date(value).toLocaleString('en-GB') : '—';

const buttonStyle = (primary = false): React.CSSProperties => ({
  minHeight: 32,
  padding: '0 10px',
  backgroundColor: primary ? THEME.blue : THEME.cardBg,
  color: primary ? '#FFFFFF' : THEME.heading,
  border: `1px solid ${primary ? THEME.blue : THEME.cardBorder}`,
  borderRadius: 4,
  fontWeight: 800,
  fontSize: 11,
  cursor: 'pointer',
});

function VerificationContent() {
  const [rows, setRows] = useState<OnboardingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<OnboardingRow | null>(null);
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [reason, setReason] = useState('Please upload or correct the outstanding documents so we can complete your XDrive onboarding review.');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) {
        setError('No active Platform Owner session.');
        return;
      }
      const response = await fetch('/api/super-admin/onboarding', {
        headers: { Authorization: auth },
        cache: 'no-store',
      });
      const body = await response.json().catch(() => ({})) as { rows?: OnboardingRow[]; error?: string };
      if (!response.ok) {
        setError(body.error ?? 'Onboarding verification is unavailable.');
        return;
      }
      setRows(body.rows ?? []);
    } catch {
      setError('Onboarding verification is unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const blocked = useMemo(() => rows.filter((row) => row.missing_documents.length > 0), [rows]);
  const ready = useMemo(() => rows.filter((row) => row.ready_for_approval), [rows]);

  const openRequest = useCallback(async (row: OnboardingRow) => {
    setSelected(row);
    setPreflight(null);
    setSendResult(null);
    setPreflightLoading(true);
    try {
      const auth = await getAuthHeader();
      if (!auth) throw new Error('No active Platform Owner session.');
      const response = await fetch(`/api/super-admin/onboarding/${encodeURIComponent(row.id)}/request-documents`, {
        headers: { Authorization: auth },
        cache: 'no-store',
      });
      const body = await response.json().catch(() => ({})) as Preflight;
      if (!response.ok) throw new Error(body.error ?? 'Document request preflight is unavailable.');
      setPreflight(body);
    } catch (caught) {
      setPreflight({ error: caught instanceof Error ? caught.message : 'Document request preflight is unavailable.' });
    } finally {
      setPreflightLoading(false);
    }
  }, []);

  const send = useCallback(async (reminder: boolean) => {
    if (!selected || !preflight?.canRequest || preflight.previewReadOnly || reason.trim().length < 3) return;
    setSending(true);
    setSendResult(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) throw new Error('No active Platform Owner session.');
      const response = await fetch(`/api/super-admin/onboarding/${encodeURIComponent(selected.id)}/request-documents`, {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim(), reminder }),
      });
      const body = await response.json().catch(() => ({})) as { message?: string; error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Document request could not be queued.');
      setSendResult(body.message ?? 'Document request queued.');
      await openRequest(selected);
      await load();
    } catch (caught) {
      setSendResult(caught instanceof Error ? caught.message : 'Document request could not be queued.');
    } finally {
      setSending(false);
    }
  }, [load, openRequest, preflight?.canRequest, preflight?.previewReadOnly, reason, selected]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, color: THEME.text, padding: 12 }}>
      <header style={{ minHeight: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span aria-hidden="true" style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: 4, background: THEME.heading, color: '#FFFFFF', fontSize: 12 }}>ID</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: THEME.heading, margin: 0 }}>Company Verification</h1>
              <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: THEME.blue, backgroundColor: '#EEF4FF', padding: '3px 6px', borderRadius: 4 }}>Onboarding</span>
              <span style={{ fontSize: 10, color: THEME.muted }}>{loading ? '…' : `${rows.length} in review`}</span>
            </div>
            <p style={{ color: THEME.muted, margin: '4px 0 0', fontSize: 12 }}>Canonical onboarding blockers and missing-document completion requests.</p>
          </div>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} style={{ ...buttonStyle(false), opacity: loading ? 0.55 : 1 }}>Refresh</button>
      </header>

      {error ? <div role="alert" style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.red}`, borderLeft: `4px solid ${THEME.red}`, borderRadius: 4, padding: '9px 12px', color: THEME.red, fontSize: 11, fontWeight: 700, marginBottom: 12 }}>{error}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 12 }}>
        {[
          ['Applications in review', loading ? '—' : String(rows.length), THEME.heading],
          ['Missing required documents', loading ? '—' : String(blocked.length), THEME.accent],
          ['Ready for approval', loading ? '—' : String(ready.length), THEME.green],
        ].map(([label, value, color]) => (
          <div key={label} style={{ background: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: 4, padding: '11px 12px' }}>
            <div style={{ color, fontSize: 20, fontWeight: 850 }}>{value}</div>
            <div style={{ color: THEME.muted, fontSize: 10, fontWeight: 750, marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      <section style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: 4, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 18, textAlign: 'center', color: THEME.muted, fontSize: 12 }}>Loading onboarding applications…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 18, textAlign: 'center', color: THEME.muted, fontSize: 12 }}>No onboarding applications currently require review.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1040, fontSize: 12 }}>
              <thead>
                <tr style={{ height: 38, background: THEME.pageBg, borderBottom: `1px solid ${THEME.cardBorder}` }}>
                  {['Applicant', 'Company / type', 'Progress', 'Required documents', 'Risk', 'Last activity', 'Action'].map((heading) => (
                    <th key={heading} style={{ padding: '0 12px', textAlign: heading === 'Action' ? 'right' : 'left', color: THEME.heading, fontWeight: 800, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} style={{ borderBottom: `1px solid ${THEME.cardBorder}` }}>
                    <td style={{ padding: '9px 12px' }}><strong>{row.applicant_name}</strong><div style={{ marginTop: 3, color: THEME.muted, fontSize: 9 }}>{row.email || 'No email'}</div></td>
                    <td style={{ padding: '9px 12px' }}>{row.company_name}<div style={{ marginTop: 3, color: THEME.muted, fontSize: 9 }}>{pretty(row.account_type)}</div></td>
                    <td style={{ padding: '9px 12px' }}><strong>{row.completion_percentage}%</strong><div style={{ marginTop: 3, color: THEME.muted, fontSize: 9 }}>{pretty(row.current_step || row.status)}</div></td>
                    <td style={{ padding: '9px 12px' }}>
                      {row.missing_documents.length ? (
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          {row.missing_documents.slice(0, 4).map((document) => <span key={document} style={{ fontSize: 9, fontWeight: 750, border: '1px solid #F4D28C', borderRadius: 4, background: THEME.warningBg, color: '#8A5A00', padding: '2px 5px' }}>{pretty(document)}</span>)}
                          {row.missing_documents.length > 4 ? <span style={{ fontSize: 9, color: THEME.muted }}>+{row.missing_documents.length - 4}</span> : null}
                        </div>
                      ) : <span style={{ color: THEME.green, fontWeight: 750 }}>No missing documents</span>}
                    </td>
                    <td style={{ padding: '9px 12px', color: row.risk_status === 'clear' ? THEME.green : THEME.muted }}>{pretty(row.risk_status)}</td>
                    <td style={{ padding: '9px 12px', color: THEME.muted }}>{date(row.last_activity_at)}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                      {row.missing_documents.length ? <button type="button" onClick={() => void openRequest(row)} style={buttonStyle(true)}>Request documents</button> : <span style={{ color: THEME.green, fontSize: 10, fontWeight: 800 }}>Clear</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected ? (
        <section style={{ marginTop: 12, backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: 4, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
            <div>
              <h2 style={{ margin: 0, color: THEME.heading, fontSize: 15 }}>Request documents · {selected.applicant_name}</h2>
              <p style={{ margin: '4px 0 0', color: THEME.muted, fontSize: 10.5 }}>The missing-document set is recalculated server-side. Email is the primary delivery channel.</p>
            </div>
            <button type="button" onClick={() => { setSelected(null); setPreflight(null); setSendResult(null); }} style={buttonStyle(false)}>Close</button>
          </div>

          {preflightLoading ? <div style={{ padding: 10, background: '#EEF4FF', color: THEME.heading, fontSize: 11 }}>Recalculating canonical missing documents and recipient…</div> : null}
          {!preflightLoading && preflight?.error ? <div role="alert" style={{ padding: 10, background: '#FFF1F2', color: THEME.red, fontSize: 11 }}>{preflight.error}</div> : null}

          {!preflightLoading && preflight && !preflight.error ? (
            <>
              {preflight.previewReadOnly ? <div style={{ padding: 10, marginBottom: 10, border: '1px solid #F4D28C', background: THEME.warningBg, color: '#7A4D00', fontSize: 11 }}><strong>Deploy Preview is read-only.</strong> The request can be inspected but cannot be queued or sent here.</div> : null}
              {preflight.requestRegistryNote ? <div style={{ padding: 10, marginBottom: 10, border: '1px solid #F4D28C', background: THEME.warningBg, color: '#7A4D00', fontSize: 11 }}>{preflight.requestRegistryNote}</div> : null}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, marginBottom: 10 }}>
                <div style={{ border: `1px solid ${THEME.cardBorder}`, padding: 9 }}><div style={{ color: THEME.muted, fontSize: 9, fontWeight: 800 }}>Recipient · email primary</div><div style={{ marginTop: 3, color: THEME.heading, fontSize: 11, fontWeight: 750, overflowWrap: 'anywhere' }}>{preflight.application?.recipientEmail ?? '—'}</div></div>
                <div style={{ border: `1px solid ${THEME.cardBorder}`, padding: 9 }}><div style={{ color: THEME.muted, fontSize: 9, fontWeight: 800 }}>Documents still required</div><div style={{ marginTop: 3, color: THEME.accent, fontSize: 17, fontWeight: 850 }}>{preflight.missingCount ?? 0}</div></div>
                <div style={{ border: `1px solid ${THEME.cardBorder}`, padding: 9 }}><div style={{ color: THEME.muted, fontSize: 9, fontWeight: 800 }}>Continuation route</div><div style={{ marginTop: 3, color: THEME.heading, fontSize: 11, fontWeight: 750 }}>{preflight.continuationPath ?? '/onboarding/resume'}</div></div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <strong style={{ display: 'block', color: THEME.heading, fontSize: 10.5, marginBottom: 6 }}>The email will request exactly:</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(preflight.missingDocuments ?? []).map((document) => <span key={document} style={{ fontSize: 9.5, fontWeight: 750, border: '1px solid #F4D28C', borderRadius: 4, background: THEME.warningBg, color: '#8A5A00', padding: '3px 6px' }}>{pretty(document)}</span>)}
                </div>
              </div>

              {preflight.outstandingRequest ? <div style={{ marginBottom: 10, padding: 9, background: '#EEF4FF', color: THEME.heading, fontSize: 10.5 }}><strong>Outstanding request exists.</strong> Last sent {date(preflight.outstandingRequest.last_sent_at)} · reminders {preflight.outstandingRequest.reminder_count ?? 0}.</div> : null}

              <label style={{ display: 'grid', gap: 6, color: THEME.muted, fontSize: 10, fontWeight: 800 }}>
                Message / audit reason
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} style={{ width: '100%', resize: 'vertical', border: `1px solid ${THEME.cardBorder}`, borderRadius: 4, padding: 9, color: THEME.text, fontSize: 11, fontFamily: 'inherit' }} />
              </label>

              {sendResult ? <div style={{ marginTop: 10, padding: 9, background: '#EEF4FF', color: THEME.heading, fontSize: 10.5 }}>{sendResult}</div> : null}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                {preflight.outstandingRequest ? (
                  <button type="button" disabled={sending || preflight.previewReadOnly || !preflight.canRequest || reason.trim().length < 3} onClick={() => void send(true)} style={{ ...buttonStyle(true), opacity: sending || preflight.previewReadOnly || !preflight.canRequest ? 0.5 : 1 }}>
                    {sending ? 'Queuing…' : preflight.previewReadOnly ? 'Preview — sending disabled' : 'Send reminder'}
                  </button>
                ) : (
                  <button type="button" disabled={sending || preflight.previewReadOnly || !preflight.canRequest || reason.trim().length < 3} onClick={() => void send(false)} style={{ ...buttonStyle(true), opacity: sending || preflight.previewReadOnly || !preflight.canRequest ? 0.5 : 1 }}>
                    {sending ? 'Queuing…' : preflight.previewReadOnly ? 'Preview — sending disabled' : 'Send request by email'}
                  </button>
                )}
              </div>
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

export default function Page() {
  return <ProtectedRoute allowedRoles={['owner']}><VerificationContent /></ProtectedRoute>;
}
