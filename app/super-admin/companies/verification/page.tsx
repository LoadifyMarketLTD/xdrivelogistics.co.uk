'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Mail, RefreshCw, ShieldCheck } from 'lucide-react';

import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

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
  supplementalChannels?: string[];
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
  delivery?: {
    eventId?: string;
    eventType?: string;
    status?: string;
    queuedAt?: string;
    processedAt?: string | null;
  } | null;
  requestRegistryAvailable?: boolean;
  requestRegistryNote?: string | null;
  error?: string;
};

const pretty = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const date = (value: string | null | undefined) => value ? new Date(value).toLocaleString('en-GB') : '—';

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
    setLoading(true); setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) { setError('No active Platform Owner session.'); return; }
      const response = await fetch('/api/super-admin/onboarding', { headers: { Authorization: auth }, cache: 'no-store' });
      const body = await response.json().catch(() => ({})) as { rows?: OnboardingRow[]; error?: string };
      if (!response.ok) { setError(body.error ?? 'Onboarding verification is unavailable.'); return; }
      setRows(body.rows ?? []);
    } catch { setError('Onboarding verification is unavailable.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const blocked = useMemo(() => rows.filter((row) => row.missing_documents.length > 0), [rows]);

  const openRequest = useCallback(async (row: OnboardingRow) => {
    setSelected(row); setPreflight(null); setSendResult(null); setPreflightLoading(true);
    try {
      const auth = await getAuthHeader();
      if (!auth) throw new Error('No active Platform Owner session.');
      const response = await fetch(`/api/super-admin/onboarding/${encodeURIComponent(row.id)}/request-documents`, {
        headers: { Authorization: auth }, cache: 'no-store',
      });
      const body = await response.json().catch(() => ({})) as Preflight;
      if (!response.ok) throw new Error(body.error ?? 'Document request preflight is unavailable.');
      setPreflight(body);
    } catch (caught) {
      setPreflight({ error: caught instanceof Error ? caught.message : 'Document request preflight is unavailable.' });
    } finally { setPreflightLoading(false); }
  }, []);

  const send = useCallback(async (reminder: boolean) => {
    if (!selected || !preflight?.canRequest || preflight.previewReadOnly) return;
    setSending(true); setSendResult(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) throw new Error('No active Platform Owner session.');
      const response = await fetch(`/api/super-admin/onboarding/${encodeURIComponent(selected.id)}/request-documents`, {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, reminder }),
      });
      const body = await response.json().catch(() => ({})) as { message?: string; error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Document request could not be queued.');
      setSendResult(body.message ?? 'Document request queued.');
      await openRequest(selected);
      await load();
    } catch (caught) { setSendResult(caught instanceof Error ? caught.message : 'Document request could not be queued.'); }
    finally { setSending(false); }
  }, [load, openRequest, preflight?.canRequest, preflight?.previewReadOnly, reason, selected]);

  return <div className="sa-page">
    <header className="sa-page-header">
      <div className="sa-heading-row">
        <span className="sa-page-icon" aria-hidden="true"><ShieldCheck size={18} /></span>
        <div className="sa-page-heading">
          <div className="sa-eyebrow">Platform control plane <span className="sa-section-pill">Companies</span></div>
          <h1 className="sa-page-title">Onboarding & document verification</h1>
          <p className="sa-page-description">Review canonical onboarding blockers, see exactly which required documents are missing, and request completion by email.</p>
        </div>
      </div>
      <div className="sa-page-actions"><button className="sa-secondary-button" type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={14} />Refresh</button></div>
    </header>

    {error ? <div className="sa-state-block" data-tone="danger">{error}</div> : null}

    <div className="sa-metric-grid">
      <div className="sa-metric-card"><div className="sa-metric-value">{loading ? '—' : rows.length}</div><div className="sa-metric-label">Applications in review</div></div>
      <div className="sa-metric-card" data-tone="orange"><div className="sa-metric-value">{loading ? '—' : blocked.length}</div><div className="sa-metric-label">Missing required documents</div></div>
      <div className="sa-metric-card" data-tone="green"><div className="sa-metric-value">{loading ? '—' : rows.filter((row) => row.ready_for_approval).length}</div><div className="sa-metric-label">Ready for approval</div></div>
    </div>

    <section className="sa-panel">
      <div className="sa-panel-header"><div><h2 className="sa-panel-title">Canonical onboarding applications</h2><p className="sa-panel-subtitle">Missing-document status is recalculated server-side from `get_missing_onboarding_documents`.</p></div></div>
      {loading ? <div className="sa-loading">Loading onboarding applications…</div> : rows.length === 0 ? <div className="sa-empty">No applications currently require onboarding review.</div> : <div className="sa-table-scroll">
        <table className="sa-data-table">
          <thead><tr><th>Applicant</th><th>Company / type</th><th>Progress</th><th>Required documents</th><th>Risk</th><th>Last activity</th><th style={{ textAlign: 'right' }}>Action</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id}>
            <td><strong>{row.applicant_name}</strong><div style={{ marginTop: 3, color: '#728198', fontSize: 9 }}>{row.email || 'No email'}</div></td>
            <td>{row.company_name}<div style={{ marginTop: 3, color: '#728198', fontSize: 9 }}>{pretty(row.account_type)}</div></td>
            <td><strong>{row.completion_percentage}%</strong><div style={{ marginTop: 3, color: '#728198', fontSize: 9 }}>{pretty(row.current_step || row.status)}</div></td>
            <td>{row.missing_documents.length ? <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{row.missing_documents.slice(0, 4).map((doc) => <span key={doc} className="sa-section-pill">{pretty(doc)}</span>)}{row.missing_documents.length > 4 ? <span className="sa-section-pill">+{row.missing_documents.length - 4}</span> : null}</div> : <span style={{ color: '#168553', fontWeight: 750 }}>No missing documents</span>}</td>
            <td>{pretty(row.risk_status)}</td><td>{date(row.last_activity_at)}</td>
            <td style={{ textAlign: 'right' }}>{row.missing_documents.length ? <button className="sa-primary-button" type="button" onClick={() => void openRequest(row)}><Mail size={13} />Request documents</button> : <span style={{ color: '#168553', fontSize: 9.5, fontWeight: 800 }}>Clear</span>}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>

    {selected ? <section className="sa-panel" style={{ marginTop: 14 }}>
      <div className="sa-panel-header"><div><h2 className="sa-panel-title">Request documents · {selected.applicant_name}</h2><p className="sa-panel-subtitle">Email is the primary channel. In-platform and push are supplemental only when available.</p></div><button className="sa-secondary-button" type="button" onClick={() => { setSelected(null); setPreflight(null); }}>Close</button></div>
      <div style={{ padding: 14 }}>
        {preflightLoading ? <div className="sa-state-block" data-tone="info">Recalculating canonical missing documents and recipient…</div> : preflight?.error ? <div className="sa-state-block" data-tone="danger">{preflight.error}</div> : preflight ? <>
          {preflight.previewReadOnly ? <div className="sa-state-block" data-tone="warning"><strong>Deploy Preview is read-only.</strong> You can inspect the exact request that would be sent, but this preview cannot queue or send it.</div> : null}
          {preflight.requestRegistryNote ? <div className="sa-state-block" data-tone="warning">{preflight.requestRegistryNote}</div> : null}
          <div className="sa-metric-grid">
            <div className="sa-metric-card"><div className="sa-metric-value" style={{ fontSize: 15 }}>{preflight.application?.recipientEmail ?? '—'}</div><div className="sa-metric-label">Recipient · email primary</div></div>
            <div className="sa-metric-card" data-tone="orange"><div className="sa-metric-value">{preflight.missingCount ?? 0}</div><div className="sa-metric-label">Documents still required</div></div>
            <div className="sa-metric-card"><div className="sa-metric-value" style={{ fontSize: 15 }}>{preflight.continuationPath ?? '/onboarding/resume'}</div><div className="sa-metric-label">Secure continuation route</div></div>
          </div>
          <div style={{ marginBottom: 12 }}><strong style={{ display: 'block', color: '#17305a', fontSize: 10.5, marginBottom: 7 }}>The email will request exactly:</strong><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{(preflight.missingDocuments ?? []).map((doc) => <span className="sa-section-pill" key={doc}>{pretty(doc)}</span>)}</div></div>
          {preflight.outstandingRequest ? <div className="sa-state-block" data-tone={preflight.delivery?.status === 'failed' ? 'danger' : 'info'}>
            <strong>Outstanding request exists.</strong> Last sent {date(preflight.outstandingRequest.last_sent_at)} · reminders {preflight.outstandingRequest.reminder_count ?? 0}.
            <div style={{ marginTop: 4 }}>
              Delivery: <strong>{preflight.delivery?.status ? pretty(preflight.delivery.status) : 'Queue status unavailable'}</strong>
              {preflight.delivery?.processedAt ? ` · processed ${date(preflight.delivery.processedAt)}` : preflight.delivery?.queuedAt ? ` · queued ${date(preflight.delivery.queuedAt)}` : ''}
            </div>
          </div> : null}
          <label style={{ display: 'grid', gap: 6, color: '#53647b', fontSize: 9.5, fontWeight: 800 }}>Message / audit reason
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} style={{ width: '100%', resize: 'vertical', border: '1px solid #dde4ed', borderRadius: 8, padding: 10, color: '#263750', fontSize: 10.5, fontFamily: 'inherit' }} />
          </label>
          {sendResult ? <div className="sa-state-block" data-tone="info" style={{ marginTop: 10 }}>{sendResult}</div> : null}
          <div className="sa-page-actions" style={{ marginTop: 12 }}>
            {preflight.outstandingRequest ? <button className="sa-secondary-button" type="button" disabled={sending || preflight.previewReadOnly || !preflight.canRequest} onClick={() => void send(true)}>Send reminder</button> : null}
            <button className="sa-primary-button" type="button" disabled={sending || preflight.previewReadOnly || !preflight.canRequest || reason.trim().length < 3} onClick={() => void send(false)}><Mail size={13} />{sending ? 'Queuing…' : preflight.previewReadOnly ? 'Preview — sending disabled' : 'Send request by email'}</button>
          </div>
        </> : null}
      </div>
    </section> : null}
  </div>;
}

export default function Page() {
  return <ProtectedRoute allowedRoles={['owner']}><VerificationContent /></ProtectedRoute>;
}
