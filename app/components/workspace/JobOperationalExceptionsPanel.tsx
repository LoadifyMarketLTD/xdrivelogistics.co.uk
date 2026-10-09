'use client';

import { useCallback, useEffect, useState } from 'react';

import { supabase } from '../../../lib/supabaseClient';
import { ActionButton, AlertBanner, EmptyState, StatusBadge } from './WorkspaceUI';

type ExceptionRow = {
  id: string;
  job_id: string;
  company_id: string;
  category: string;
  severity: 'info' | 'warning' | 'critical';
  status: 'open' | 'monitoring' | 'resolved';
  description: string;
  occurred_at: string;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
};

const CATEGORIES = [
  ['delay', 'Delay'],
  ['breakdown', 'Breakdown'],
  ['collection_failed', 'Collection failed'],
  ['delivery_failed', 'Delivery failed'],
  ['damage', 'Damage'],
  ['access_issue', 'Access issue'],
  ['customer_unavailable', 'Customer unavailable'],
  ['vehicle_issue', 'Vehicle issue'],
  ['other', 'Other'],
] as const;

const human = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const when = (value: string | null | undefined) => value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set';

export function JobOperationalExceptionsPanel({ jobId, companyId }: { jobId: string; companyId: string | null | undefined }) {
  const [rows, setRows] = useState<ExceptionRow[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number][0]>('delay');
  const [severity, setSeverity] = useState<'info' | 'warning' | 'critical'>('warning');
  const [description, setDescription] = useState('');
  const [resolutionNote, setResolutionNote] = useState<Record<string, string>>({});

  const token = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const load = useCallback(async () => {
    if (!companyId) { setRows([]); setCanManage(false); setLoading(false); return; }
    setLoading(true);
    setError('');
    const accessToken = await token();
    if (!accessToken) { setLoading(false); setError('Session expired.'); return; }
    const response = await fetch(`/api/workspace/jobs/${encodeURIComponent(jobId)}/exceptions?companyId=${encodeURIComponent(companyId)}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
    const payload = await response.json().catch(() => ({})) as { exceptions?: ExceptionRow[]; canManage?: boolean; error?: string };
    setLoading(false);
    if (!response.ok) { setError(payload.error ?? 'Operational exceptions could not be loaded.'); return; }
    setRows(payload.exceptions ?? []);
    setCanManage(payload.canManage === true);
  }, [companyId, jobId, token]);

  useEffect(() => { void load(); }, [load]);

  const report = async () => {
    if (!companyId || description.trim().length < 5) return;
    setWorking(true); setError('');
    const accessToken = await token();
    if (!accessToken) { setWorking(false); setError('Session expired.'); return; }
    const response = await fetch(`/api/workspace/jobs/${encodeURIComponent(jobId)}/exceptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, category, severity, description: description.trim() }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    setWorking(false);
    if (!response.ok) { setError(payload.error ?? 'Operational exception could not be recorded.'); return; }
    setDescription('');
    await load();
  };

  const update = async (row: ExceptionRow, action: 'monitor' | 'resolve' | 'reopen') => {
    if (!companyId) return;
    setWorking(true); setError('');
    const accessToken = await token();
    if (!accessToken) { setWorking(false); setError('Session expired.'); return; }
    const response = await fetch(`/api/workspace/jobs/${encodeURIComponent(jobId)}/exceptions`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, exceptionId: row.id, action, resolutionNote: resolutionNote[row.id]?.trim() || null }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    setWorking(false);
    if (!response.ok) { setError(payload.error ?? 'Operational exception could not be updated.'); return; }
    await load();
  };

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <AlertBanner tone="warning"><strong>Operational exceptions are not commercial disputes.</strong> Use this register for execution events such as delay, breakdown, failed collection/delivery, damage or access problems. Use the Dispute tab only for a formal commercial disagreement.</AlertBanner>
      {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}
      {canManage ? <div className="workspace-detail-item" style={{ display: 'grid', gap: 7 }}>
        <strong>Report operational exception</strong>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px,1fr) minmax(130px,.7fr)', gap: 6 }}>
          <label style={{ display: 'grid', gap: 3, fontSize: 11, fontWeight: 700 }}>CATEGORY<select value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>{CATEGORIES.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label style={{ display: 'grid', gap: 3, fontSize: 11, fontWeight: 700 }}>SEVERITY<select value={severity} onChange={(event) => setSeverity(event.target.value as typeof severity)}><option value="info">Info</option><option value="warning">Warning</option><option value="critical">Critical</option></select></label>
        </div>
        <label style={{ display: 'grid', gap: 3, fontSize: 11, fontWeight: 700 }}>WHAT HAPPENED<textarea rows={3} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Operational facts only; commercial claims belong in Disputes." /></label>
        <div><ActionButton tone="warning" disabled={working || description.trim().length < 5} onClick={() => void report()}>{working ? 'Saving…' : 'Report Exception'}</ActionButton></div>
      </div> : null}
      {loading ? <EmptyState compact title="Loading operational exceptions…" /> : rows.length ? <div style={{ display: 'grid', gap: 6 }}>{rows.map((row) => <div key={row.id} className="workspace-detail-item" style={{ display: 'grid', gap: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}><strong>{human(row.category)}</strong><StatusBadge value={row.severity} tone={row.severity === 'critical' ? 'red' : row.severity === 'warning' ? 'orange' : 'blue'} /><StatusBadge value={row.status} tone={row.status === 'resolved' ? 'green' : row.status === 'monitoring' ? 'orange' : 'red'} /><span style={{ marginLeft: 'auto', color: '#64748b', fontSize: 11 }}>{when(row.occurred_at)}</span></div>
        <span>{row.description}</span>
        {row.resolution_note ? <span style={{ color: '#64748b', fontSize: 11 }}>Resolution / note: {row.resolution_note}</span> : null}
        {canManage ? <div style={{ display: 'grid', gap: 5 }}><input value={resolutionNote[row.id] ?? ''} onChange={(event) => setResolutionNote((current) => ({ ...current, [row.id]: event.target.value }))} placeholder="Resolution / monitoring note (optional)" maxLength={2000} /><div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{row.status === 'open' ? <ActionButton tone="secondary" disabled={working} onClick={() => void update(row, 'monitor')}>Monitor</ActionButton> : null}{row.status !== 'resolved' ? <ActionButton tone="success" disabled={working} onClick={() => void update(row, 'resolve')}>Resolve</ActionButton> : <ActionButton tone="secondary" disabled={working} onClick={() => void update(row, 'reopen')}>Reopen</ActionButton>}</div></div> : null}
      </div>)}</div> : <EmptyState compact title="No operational exceptions recorded" description="A clean exception register is separate from the formal Disputes register." />}
    </div>
  );
}
