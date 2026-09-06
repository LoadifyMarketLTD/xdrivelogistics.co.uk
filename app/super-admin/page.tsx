'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '../components/ProtectedRoute';
import { ConnectedExchangePanel } from '../components/workspace/ConnectedExchangePanel';
import { supabase } from '../../lib/supabaseClient';

type Severity = 'critical' | 'warning' | 'caution' | 'ok' | 'unknown';
type AttentionIndicator =
  | { count: number | null; label: string; severity: Severity; note?: string }
  | { amountGbp: number; label: string; severity: Severity; invoiceCount?: number; amountPartial?: boolean; note?: string };
type AttentionIndicators = { p0p1Incidents: AttentionIndicator; jobsAtRisk: AttentionIndicator; blockedAccounts: AttentionIndicator; financialExposure: AttentionIndicator; degradedServices: AttentionIndicator; };
type ActionQueueItem = { id: string; type: string; severity: 'P0' | 'P1' | 'P2'; title: string; description: string; entityType: string; entityId: string; entityName: string; detectedAt: string; ageMinutes: number; href: string; };
type ActionQueue = { derived: boolean; queueNote?: string; total: number; p0: number; p1: number; p2: number; items: ActionQueueItem[]; };
type CommandCentrePayload = { environment: 'PRODUCTION' | 'STAGING' | 'DEVELOPMENT'; refreshedAt: string; partialData?: boolean; queryErrors?: string[]; unavailableSources?: string[]; attentionIndicators: AttentionIndicators; actionQueue: ActionQueue; };
type PlatformStats = { refreshedAt?: string; companiesTotal: number; companiesActive: number; companiesSuspended: number; companiesPending: number; driversTotal: number; jobsTotal: number; jobsOpen: number; jobsDelivered: number; invoicesTotal: number; invoicesUnpaid: number; compliancePending: number; };

const X = { navy: '#0B2F6B', blue: '#1D57D8', orange: '#F5A300', white: '#FFFFFF', charcoal: '#1A1F2B', light: '#F4F6F8', border: '#D9E1EA', muted: '#64748B', success: '#16A34A', danger: '#DC2626' } as const;
const REQUEST_TIMEOUT_MS = 12_000;
const KPI_META = [
  ['Active companies', '/super-admin/companies/active'],
  ['Open jobs', '/super-admin/operations/jobs'],
  ['Pending approvals', '/super-admin/companies/approvals'],
  ['Unpaid invoices', '/super-admin/finance/invoices'],
] as const;
const ATTENTION_LABELS = ['P0/P1 incidents', 'Jobs at risk', 'Blocked accounts', 'Financial exposure', 'Degraded services'] as const;

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

async function fetchJsonWithTimeout<T>(url: string, headers: HeadersInit): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers, signal: controller.signal, cache: 'no-store' });
    const body = await response.json().catch(() => null) as T | { error?: string } | null;
    if (!response.ok) {
      const detail = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : `HTTP ${response.status}`;
      if (response.status === 401) throw new Error(`Authentication required (401). ${detail}`);
      if (response.status === 403) throw new Error(`Owner access denied (403). ${detail}`);
      throw new Error(`Service unavailable (${response.status}). ${detail}`);
    }
    if (!body || typeof body !== 'object') throw new Error('Service returned no usable data.');
    return body as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s.`);
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

function CommandCentre() {
  const [data, setData] = useState<CommandCentrePayload | null>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [refreshCompletedAt, setRefreshCompletedAt] = useState<string | null>(null);
  const refreshGeneration = useRef(0);

  const load = useCallback(async () => {
    const generation = ++refreshGeneration.current;
    setLoading(true);
    setPageError(null);
    setCommandError(null);
    setStatsError(null);
    setRefreshCompletedAt(null);
    // Fail closed while a new refresh is in flight. Never mix an old snapshot with a new one.
    setData(null);
    setStats(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        if (generation !== refreshGeneration.current) return;
        setPageError('Session expired. Please sign in again.');
        return;
      }

      const headers = { Authorization: `Bearer ${session.access_token}` };
      const [commandResult, statsResult] = await Promise.allSettled([
        fetchJsonWithTimeout<CommandCentrePayload>('/api/super-admin/command-centre', headers),
        fetchJsonWithTimeout<PlatformStats>('/api/super-admin/stats', headers),
      ]);

      if (generation !== refreshGeneration.current) return;

      if (commandResult.status === 'fulfilled') setData(commandResult.value);
      else setCommandError(commandResult.reason instanceof Error ? commandResult.reason.message : 'Command Centre data is unavailable.');

      if (statsResult.status === 'fulfilled') setStats(statsResult.value);
      else setStatsError(statsResult.reason instanceof Error ? statsResult.reason.message : 'Platform summary data is unavailable.');

      setRefreshCompletedAt(new Date().toISOString());
    } catch {
      if (generation !== refreshGeneration.current) return;
      setPageError('Command Centre refresh failed before data could be verified. Please retry.');
    } finally {
      if (generation === refreshGeneration.current) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const indicators = data?.attentionIndicators;
  const queue = data?.actionQueue;
  const commandPartial = Boolean(data?.partialData || data?.queryErrors?.length || data?.unavailableSources?.length);

  const kpis = stats ? [
    ['Active companies', stats.companiesActive, `${stats.companiesTotal} registered`, '/super-admin/companies/active'],
    ['Open jobs', stats.jobsOpen, `${stats.jobsTotal} total jobs`, '/super-admin/operations/jobs'],
    ['Pending approvals', stats.companiesPending, 'Requires platform review', '/super-admin/companies/approvals'],
    ['Unpaid invoices', stats.invoicesUnpaid, `${stats.invoicesTotal} invoices total`, '/super-admin/finance/invoices'],
  ] as const : [];

  const attentionList = indicators
    ? [indicators.p0p1Incidents, indicators.jobsAtRisk, indicators.blockedAccounts, indicators.financialExposure, indicators.degradedServices]
    : [];

  return <div style={{ minHeight: '100vh', background: X.light, color: X.charcoal, padding: '12px' }}>
    <header style={{ minHeight: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}><h1 style={{ margin: 0, color: X.navy, fontSize: '20px', fontWeight: 800 }}>Command Centre</h1>{data && <span style={{ padding: '3px 6px', borderRadius: '4px', border: `1px solid ${data.environment === 'PRODUCTION' ? '#F1B8B8' : X.border}`, color: data.environment === 'PRODUCTION' ? X.danger : X.navy, background: X.white, fontSize: '10px', fontWeight: 800 }}>{data.environment}</span>}</div>
        <p style={{ margin: '4px 0 0', color: X.muted, fontSize: '12px' }}>Platform health, urgent attention and operational workload in one view.</p>
        {refreshCompletedAt && <p style={{ margin: '2px 0 0', color: (commandError || statsError || commandPartial) ? X.orange : X.muted, fontSize: '10px' }}>{commandError || statsError || commandPartial ? 'Refresh incomplete' : 'Refresh completed'} {new Date(refreshCompletedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>}
      </div>
      <button onClick={() => void load()} disabled={loading} style={{ height: '32px', padding: '0 12px', border: `1px solid ${X.blue}`, borderRadius: '4px', background: X.blue, color: X.white, fontSize: '12px', fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .7 : 1 }}>{loading ? 'Refreshing…' : 'Refresh'}</button>
    </header>

    {pageError && <div role="alert" style={{ marginBottom: '12px', border: '1px solid #F1B8B8', borderLeft: `4px solid ${X.danger}`, borderRadius: '4px', background: X.white, padding: '10px 12px', color: X.danger, fontSize: '12px', fontWeight: 700 }}>{pageError}</div>}
    {commandError && <div role="alert" data-testid="command-centre-unavailable" style={{ marginBottom: '12px', border: '1px solid #F1B8B8', borderLeft: `4px solid ${X.danger}`, borderRadius: '4px', background: X.white, padding: '10px 12px', color: X.danger, fontSize: '12px' }}><strong>Command Centre data unavailable.</strong> {commandError}</div>}
    {statsError && <div role="alert" data-testid="platform-summary-unavailable" style={{ marginBottom: '12px', border: `1px solid ${X.border}`, borderLeft: `4px solid ${X.orange}`, borderRadius: '4px', background: X.white, padding: '10px 12px', color: X.charcoal, fontSize: '12px' }}><strong>Platform summary unavailable.</strong> {statsError}</div>}
    {commandPartial ? <div data-testid="partial-data-warning" style={{ marginBottom: '12px', border: `1px solid ${X.border}`, borderLeft: `4px solid ${X.orange}`, borderRadius: '4px', background: X.white, padding: '9px 12px', color: X.charcoal, fontSize: '11px' }}>Some platform services are temporarily excluded from totals. Available data remains usable; unavailable sources are not treated as zero.</div> : null}

    <ConnectedExchangePanel role="super-admin" title="Connected Exchange intelligence" variant="super-admin" />

    <section style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}><div><h2 style={{ margin: 0, color: X.navy, fontSize: '14px', fontWeight: 800 }}>Platform summary</h2><p style={{ margin: '2px 0 0', color: X.muted, fontSize: '11px' }}>Primary operational KPIs only.</p></div><Link href="/super-admin/analytics" style={{ color: X.blue, fontSize: '11px', fontWeight: 800, textDecoration: 'none' }}>Full analytics →</Link></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '12px' }}>
        {loading ? KPI_META.map(([label]) => <div key={label} data-testid="kpi-loading" style={{ minHeight: '88px', background: X.white, border: `1px solid ${X.border}`, borderRadius: '4px', padding: '12px' }}><div style={{ color: X.navy, fontSize: '22px', lineHeight: 1.05, fontWeight: 800 }}>—</div><div style={{ marginTop: '7px', color: X.charcoal, fontSize: '12px', fontWeight: 700 }}>{label}</div><div style={{ marginTop: '2px', color: X.muted, fontSize: '10px' }}>Loading…</div></div>)
          : stats ? kpis.map(([label, value, note, href]) => <Link key={label} href={href} style={{ minHeight: '88px', display: 'block', textDecoration: 'none', background: X.white, border: `1px solid ${X.border}`, borderRadius: '4px', padding: '12px' }}><div style={{ color: X.navy, fontSize: '22px', lineHeight: 1.05, fontWeight: 800 }}>{value}</div><div style={{ marginTop: '7px', color: X.charcoal, fontSize: '12px', fontWeight: 700 }}>{label}</div><div style={{ marginTop: '2px', color: X.muted, fontSize: '10px' }}>{note}</div></Link>)
          : KPI_META.map(([label]) => <div key={label} data-testid="kpi-unavailable" style={{ minHeight: '88px', background: X.white, border: `1px solid ${X.border}`, borderRadius: '4px', padding: '12px' }}><div style={{ color: X.muted, fontSize: '22px', lineHeight: 1.05, fontWeight: 800 }}>—</div><div style={{ marginTop: '7px', color: X.charcoal, fontSize: '12px', fontWeight: 700 }}>{label}</div><div style={{ marginTop: '2px', color: X.orange, fontSize: '10px', fontWeight: 700 }}>Unavailable — not reported as zero</div></div>)}
      </div>
    </section>

    <section style={{ marginBottom: '12px' }}>
      <h2 style={{ margin: '0 0 8px', color: X.navy, fontSize: '14px', fontWeight: 800 }}>Critical attention</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '12px' }}>
        {loading ? ATTENTION_LABELS.map((label) => <div key={label} data-testid="attention-loading" style={{ minHeight: '88px', background: X.white, border: `1px solid ${X.border}`, borderRadius: '4px', padding: '12px' }}><div style={{ color: X.muted, fontSize: '20px', fontWeight: 800 }}>—</div><div style={{ marginTop: '7px', color: X.charcoal, fontSize: '11px', fontWeight: 700 }}>{label}</div><div style={{ marginTop: '2px', color: X.muted, fontSize: '10px' }}>Loading…</div></div>)
          : indicators ? attentionList.map((indicator, index) => <div key={index} style={{ minHeight: '88px', background: X.white, border: `1px solid ${X.border}`, borderRadius: '4px', padding: '12px' }}><div style={{ color: severityColor(indicator.severity), fontSize: '20px', fontWeight: 800 }}>{indicatorValue(indicator)}</div><div style={{ marginTop: '7px', color: X.charcoal, fontSize: '11px', fontWeight: 700 }}>{indicator.label}</div><div style={{ marginTop: '2px', color: X.muted, fontSize: '10px' }}>{indicator.note ?? indicator.severity}</div></div>)
          : ATTENTION_LABELS.map((label) => <div key={label} data-testid="attention-unavailable" style={{ minHeight: '88px', background: X.white, border: `1px solid ${X.border}`, borderRadius: '4px', padding: '12px' }}><div style={{ color: X.muted, fontSize: '20px', fontWeight: 800 }}>—</div><div style={{ marginTop: '7px', color: X.charcoal, fontSize: '11px', fontWeight: 700 }}>{label}</div><div style={{ marginTop: '2px', color: X.orange, fontSize: '10px', fontWeight: 700 }}>Unavailable — not reported as healthy</div></div>)}
      </div>
    </section>

    <section style={{ marginBottom: '12px', border: `1px solid ${X.border}`, borderRadius: '4px', background: X.white, overflow: 'hidden' }}>
      <div style={{ minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '0 12px', borderBottom: `1px solid ${X.border}`, background: X.light }}><div><h2 style={{ margin: 0, color: X.navy, fontSize: '13px', fontWeight: 800 }}>Operational queue</h2>{queue?.queueNote && <p style={{ margin: '2px 0 0', color: X.muted, fontSize: '10px' }}>{queue.queueNote}</p>}</div><span data-testid="operational-queue-total" style={{ color: queue && !commandPartial ? X.muted : X.orange, fontSize: '11px', fontWeight: 700 }}>{loading ? 'Loading…' : queue ? (commandPartial ? `${queue.total} verified · partial` : `${queue.total} total`) : 'Unavailable'}</span></div>
      {loading ? <div style={{ padding: '18px', textAlign: 'center', color: X.muted, fontSize: '12px' }}>Loading…</div>
        : !queue ? <div data-testid="operational-queue-unavailable" style={{ padding: '18px', textAlign: 'center', color: X.orange, fontSize: '12px', fontWeight: 700 }}>Operational queue unavailable. No zero or healthy state has been inferred.</div>
        : !queue.items.length ? <div data-testid={commandPartial ? 'operational-queue-partial-empty' : undefined} style={{ padding: '18px', textAlign: 'center', color: commandPartial ? X.orange : X.muted, fontSize: '12px', fontWeight: commandPartial ? 700 : 400 }}>{commandPartial ? 'No actions found in currently available sources. Platform-wide zero has not been established.' : 'No critical actions in currently available sources.'}</div>
        : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', minWidth: '720px', borderCollapse: 'collapse' }}><thead><tr style={{ height: '38px', background: X.light, borderBottom: `1px solid ${X.border}` }}>{['Severity','Action','Affected entity','Age',''].map(h => <th key={h} style={{ padding: '0 12px', textAlign: 'left', color: X.navy, fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>{h}</th>)}</tr></thead><tbody>{queue.items.slice(0, 8).map(item => <tr key={item.id} style={{ minHeight: '44px', borderBottom: `1px solid ${X.border}` }}><td style={{ padding: '9px 12px' }}><span style={{ color: item.severity === 'P0' ? X.danger : X.orange, fontSize: '11px', fontWeight: 800 }}>{item.severity}</span></td><td style={{ padding: '9px 12px' }}><div style={{ color: X.charcoal, fontSize: '12px', fontWeight: 700 }}>{item.title}</div><div style={{ color: X.muted, fontSize: '10px', marginTop: '2px' }}>{item.description}</div></td><td style={{ padding: '9px 12px', color: X.charcoal, fontSize: '11px' }}>{item.entityName}</td><td style={{ padding: '9px 12px', color: X.muted, fontSize: '11px', whiteSpace: 'nowrap' }}>{fmtAge(item.ageMinutes)}</td><td style={{ padding: '9px 12px' }}><Link href={item.href} style={{ color: X.blue, fontSize: '11px', fontWeight: 800, textDecoration: 'none' }}>Review →</Link></td></tr>)}</tbody></table></div>}
    </section>

    <section style={{ minHeight: '52px', border: `1px solid ${X.border}`, borderRadius: '4px', background: X.white, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}><div><h2 style={{ margin: 0, color: X.navy, fontSize: '13px', fontWeight: 800 }}>Recent administrative activity</h2><p style={{ margin: '2px 0 0', color: X.muted, fontSize: '11px' }}>Governance decisions and administrative changes remain in the audit trail.</p></div><Link href="/super-admin/settings/audit-logs" style={{ color: X.blue, fontSize: '11px', fontWeight: 800, textDecoration: 'none' }}>Open audit trail →</Link></section>
  </div>;
}

export default function SuperAdminDashboardPage() { return <ProtectedRoute allowedRoles={['owner']}><CommandCentre /></ProtectedRoute>; }
