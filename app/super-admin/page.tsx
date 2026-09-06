'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '../components/ProtectedRoute';
import { ConnectedExchangePanel } from '../components/workspace/ConnectedExchangePanel';
import { supabase } from '../../lib/supabaseClient';

type Severity = 'critical' | 'warning' | 'caution' | 'ok' | 'unknown';
type AttentionIndicator =
  | { count: number | null; label: string; severity: Severity; note?: string }
  | { amountGbp: number; label: string; severity: Severity; invoiceCount?: number; amountPartial?: boolean };
type AttentionIndicators = { p0p1Incidents: AttentionIndicator; jobsAtRisk: AttentionIndicator; blockedAccounts: AttentionIndicator; financialExposure: AttentionIndicator; degradedServices: AttentionIndicator; };
type ActionQueueItem = { id: string; type: string; severity: 'P0' | 'P1' | 'P2'; title: string; description: string; entityType: string; entityId: string; entityName: string; detectedAt: string; ageMinutes: number; href: string; };
type ActionQueue = { derived: boolean; queueNote?: string; total: number; p0: number; p1: number; p2: number; items: ActionQueueItem[]; };
type CommandCentrePayload = { environment: 'PRODUCTION' | 'STAGING' | 'DEVELOPMENT'; refreshedAt: string; partialData?: boolean; queryErrors?: string[]; unavailableSources?: string[]; attentionIndicators: AttentionIndicators; actionQueue: ActionQueue; };
type PlatformStats = { companiesTotal: number; companiesActive: number; companiesSuspended: number; companiesPending: number; driversTotal: number; jobsTotal: number; jobsOpen: number; jobsDelivered: number; invoicesTotal: number; invoicesUnpaid: number; compliancePending: number; };

const X = { navy: '#0B2F6B', blue: '#1D57D8', orange: '#F5A300', white: '#FFFFFF', charcoal: '#1A1F2B', light: '#F4F6F8', border: '#D9E1EA', muted: '#64748B', success: '#16A34A', danger: '#DC2626' } as const;

function fmtAge(minutes: number) {
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60); const mins = minutes % 60;
  return mins ? `${hours}h ${mins}m ago` : `${hours}h ago`;
}

function indicatorValue(indicator: AttentionIndicator) {
  return 'count' in indicator ? (indicator.count === null ? '—' : indicator.count.toLocaleString()) : `£${indicator.amountGbp.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function severityColor(severity: Severity) {
  if (severity === 'critical') return X.danger;
  if (severity === 'warning' || severity === 'caution') return X.orange;
  if (severity === 'ok') return X.success;
  return X.muted;
}

function CommandCentre() {
  const [data, setData] = useState<CommandCentrePayload | null>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) { setError('Session expired. Please sign in again.'); setLoading(false); return; }
    const headers = { Authorization: `Bearer ${session.access_token}` };
    try {
      const [commandResult, statsResult] = await Promise.all([fetch('/api/super-admin/command-centre', { headers }), fetch('/api/super-admin/stats', { headers })]);
      const [commandBody, statsBody] = await Promise.all([commandResult.json().catch(() => null), statsResult.json().catch(() => null)]);
      if (!commandResult.ok) throw new Error('Command Centre is temporarily unavailable.');
      setData(commandBody as CommandCentrePayload);
      if (statsResult.ok && statsBody) setStats(statsBody as PlatformStats);
    } catch { setError('Command Centre is temporarily unavailable. Please retry.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const indicators = data?.attentionIndicators;
  const queue = data?.actionQueue;

  const kpis = stats ? [
    ['Active companies', stats.companiesActive, `${stats.companiesTotal} registered`, '/super-admin/companies/active'],
    ['Open jobs', stats.jobsOpen, `${stats.jobsTotal} total jobs`, '/super-admin/operations/jobs'],
    ['Pending approvals', stats.companiesPending, 'Requires platform review', '/super-admin/companies/approvals'],
    ['Unpaid invoices', stats.invoicesUnpaid, `${stats.invoicesTotal} invoices total`, '/super-admin/finance/invoices'],
  ] as const : [];

  return <div style={{ minHeight: '100vh', background: X.light, color: X.charcoal, padding: '12px' }}>
    <header style={{ minHeight: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}><h1 style={{ margin: 0, color: X.navy, fontSize: '20px', fontWeight: 800 }}>Command Centre</h1>{data && <span style={{ padding: '3px 6px', borderRadius: '4px', border: `1px solid ${data.environment === 'PRODUCTION' ? '#F1B8B8' : X.border}`, color: data.environment === 'PRODUCTION' ? X.danger : X.navy, background: X.white, fontSize: '10px', fontWeight: 800 }}>{data.environment}</span>}</div>
        <p style={{ margin: '4px 0 0', color: X.muted, fontSize: '12px' }}>Platform health, urgent attention and operational workload in one view.</p>
        {data?.refreshedAt && <p style={{ margin: '2px 0 0', color: X.muted, fontSize: '10px' }}>Refreshed {new Date(data.refreshedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>}
      </div>
      <button onClick={() => void load()} disabled={loading} style={{ height: '32px', padding: '0 12px', border: `1px solid ${X.blue}`, borderRadius: '4px', background: X.blue, color: X.white, fontSize: '12px', fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .7 : 1 }}>Refresh</button>
    </header>

    {error && <div role="alert" style={{ marginBottom: '12px', border: '1px solid #F1B8B8', borderLeft: `4px solid ${X.danger}`, borderRadius: '4px', background: X.white, padding: '10px 12px', color: X.danger, fontSize: '12px' }}>{error}</div>}
    {(data?.unavailableSources?.length || data?.queryErrors?.length) ? <div style={{ marginBottom: '12px', border: `1px solid ${X.border}`, borderLeft: `4px solid ${X.orange}`, borderRadius: '4px', background: X.white, padding: '9px 12px', color: X.charcoal, fontSize: '11px' }}>Some platform services are temporarily excluded from totals. Available data remains usable.</div> : null}

    <ConnectedExchangePanel role="super-admin" title="Connected Exchange intelligence" variant="super-admin" />

    <section style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}><div><h2 style={{ margin: 0, color: X.navy, fontSize: '14px', fontWeight: 800 }}>Platform summary</h2><p style={{ margin: '2px 0 0', color: X.muted, fontSize: '11px' }}>Primary operational KPIs only.</p></div><Link href="/super-admin/analytics" style={{ color: X.blue, fontSize: '11px', fontWeight: 800, textDecoration: 'none' }}>Full analytics →</Link></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '12px' }}>
        {(loading || !stats ? Array.from({ length: 4 }, (_, i) => [`Loading ${i}`, '—', 'Loading…', '#'] as const) : kpis).map(([label, value, note, href]) => <Link key={label} href={href} style={{ minHeight: '88px', display: 'block', textDecoration: 'none', background: X.white, border: `1px solid ${X.border}`, borderRadius: '4px', padding: '12px' }}><div style={{ color: X.navy, fontSize: '22px', lineHeight: 1.05, fontWeight: 800 }}>{value}</div><div style={{ marginTop: '7px', color: X.charcoal, fontSize: '12px', fontWeight: 700 }}>{label}</div><div style={{ marginTop: '2px', color: X.muted, fontSize: '10px' }}>{note}</div></Link>)}
      </div>
    </section>

    <section style={{ marginBottom: '12px' }}>
      <h2 style={{ margin: '0 0 8px', color: X.navy, fontSize: '14px', fontWeight: 800 }}>Critical attention</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '12px' }}>
        {(loading || !indicators ? [] : [indicators.p0p1Incidents, indicators.jobsAtRisk, indicators.blockedAccounts, indicators.financialExposure, indicators.degradedServices]).map((indicator, index) => <div key={index} style={{ minHeight: '88px', background: X.white, border: `1px solid ${X.border}`, borderRadius: '4px', padding: '12px' }}><div style={{ color: severityColor(indicator.severity), fontSize: '20px', fontWeight: 800 }}>{indicatorValue(indicator)}</div><div style={{ marginTop: '7px', color: X.charcoal, fontSize: '11px', fontWeight: 700 }}>{indicator.label}</div><div style={{ marginTop: '2px', color: X.muted, fontSize: '10px', textTransform: 'capitalize' }}>{indicator.severity}</div></div>)}
      </div>
    </section>

    <section style={{ marginBottom: '12px', border: `1px solid ${X.border}`, borderRadius: '4px', background: X.white, overflow: 'hidden' }}>
      <div style={{ minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '0 12px', borderBottom: `1px solid ${X.border}`, background: X.light }}><div><h2 style={{ margin: 0, color: X.navy, fontSize: '13px', fontWeight: 800 }}>Operational queue</h2>{queue?.queueNote && <p style={{ margin: '2px 0 0', color: X.muted, fontSize: '10px' }}>{queue.queueNote}</p>}</div><span style={{ color: X.muted, fontSize: '11px', fontWeight: 700 }}>{queue?.total ?? 0} total</span></div>
      {loading ? <div style={{ padding: '18px', textAlign: 'center', color: X.muted, fontSize: '12px' }}>Loading…</div> : !queue?.items.length ? <div style={{ padding: '18px', textAlign: 'center', color: X.muted, fontSize: '12px' }}>No critical actions in currently available sources.</div> : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', minWidth: '720px', borderCollapse: 'collapse' }}><thead><tr style={{ height: '38px', background: X.light, borderBottom: `1px solid ${X.border}` }}>{['Severity','Action','Affected entity','Age',''].map(h => <th key={h} style={{ padding: '0 12px', textAlign: 'left', color: X.navy, fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>{h}</th>)}</tr></thead><tbody>{queue.items.slice(0, 8).map(item => <tr key={item.id} style={{ minHeight: '44px', borderBottom: `1px solid ${X.border}` }}><td style={{ padding: '9px 12px' }}><span style={{ color: item.severity === 'P0' ? X.danger : X.orange, fontSize: '11px', fontWeight: 800 }}>{item.severity}</span></td><td style={{ padding: '9px 12px' }}><div style={{ color: X.charcoal, fontSize: '12px', fontWeight: 700 }}>{item.title}</div><div style={{ color: X.muted, fontSize: '10px', marginTop: '2px' }}>{item.description}</div></td><td style={{ padding: '9px 12px', color: X.charcoal, fontSize: '11px' }}>{item.entityName}</td><td style={{ padding: '9px 12px', color: X.muted, fontSize: '11px', whiteSpace: 'nowrap' }}>{fmtAge(item.ageMinutes)}</td><td style={{ padding: '9px 12px' }}><Link href={item.href} style={{ color: X.blue, fontSize: '11px', fontWeight: 800, textDecoration: 'none' }}>Review →</Link></td></tr>)}</tbody></table></div>}
    </section>

    <section style={{ minHeight: '52px', border: `1px solid ${X.border}`, borderRadius: '4px', background: X.white, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}><div><h2 style={{ margin: 0, color: X.navy, fontSize: '13px', fontWeight: 800 }}>Recent administrative activity</h2><p style={{ margin: '2px 0 0', color: X.muted, fontSize: '11px' }}>Governance decisions and administrative changes remain in the audit trail.</p></div><Link href="/super-admin/settings/audit-logs" style={{ color: X.blue, fontSize: '11px', fontWeight: 800, textDecoration: 'none' }}>Open audit trail →</Link></section>
  </div>;
}

export default function SuperAdminDashboardPage() { return <ProtectedRoute allowedRoles={['owner']}><CommandCentre /></ProtectedRoute>; }
