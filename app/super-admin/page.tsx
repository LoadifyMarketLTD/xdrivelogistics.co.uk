'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import ProtectedRoute from '../components/ProtectedRoute';
import { PlatformEntityLink, type PlatformEntityType } from './_components/control-plane';
import { getAuthHeader } from './_lib/getAuthHeader';

type Severity = 'critical' | 'warning' | 'caution' | 'ok' | 'unknown';
type AttentionIndicator = { label: string; severity: Severity; note?: string } & (
  | { count: number | null }
  | { amountGbp: number; invoiceCount?: number; amountPartial?: boolean }
);
type AttentionIndicators = { p0p1Incidents: AttentionIndicator; jobsAtRisk: AttentionIndicator; blockedAccounts: AttentionIndicator; financialExposure: AttentionIndicator; degradedServices: AttentionIndicator; };
type ActionQueueItem = { id: string; type: string; severity: 'P0' | 'P1' | 'P2'; title: string; description: string; entityType: string; entityId: string; entityName: string; detectedAt: string; ageMinutes: number; href: string; };
type ActionQueue = { derived: boolean; queueNote?: string; total: number; p0: number; p1: number; p2: number; items: ActionQueueItem[]; };
type CommandCentrePayload = { environment: 'PRODUCTION' | 'STAGING' | 'DEVELOPMENT'; refreshedAt: string; partialData?: boolean; queryErrors?: string[]; unavailableSources?: string[]; attentionIndicators: AttentionIndicators; actionQueue: ActionQueue; };
type PlatformStats = { companiesTotal: number; companiesActive: number; companiesSuspended: number; companiesPending: number; driversTotal: number; jobsTotal: number; jobsOpen: number; jobsDelivered: number; invoicesTotal: number; invoicesUnpaid: number; compliancePending: number; };
type HealthPayload = { checkedAt?: string; summary?: { totalChecks?: number; healthyChecks?: number; degradedChecks?: number; failedChecks?: number; degradedServices?: number; configuredIntegrations?: number; totalIntegrations?: number; integrationConfigurationGaps?: number }; error?: string };
type PlatformCaseRow = { id: string; reference: string; source: string; case_type: string; severity: string; status: string; title: string; entity_type: string; entity_id: string; entity_label: string; updated_at: string };
type CasesPayload = { available?: boolean; rows?: PlatformCaseRow[]; note?: string; pagination?: { total?: number }; error?: string };

const X = { navy: '#0B2F6B', blue: '#1D57D8', orange: '#F5A300', white: '#FFFFFF', charcoal: '#1A1F2B', light: '#F4F6F8', border: '#D9E1EA', muted: '#64748B', success: '#16A34A', danger: '#DC2626' } as const;
const INSPECTABLE_TYPES = new Set<PlatformEntityType>(['job', 'company', 'user', 'driver', 'vehicle', 'invoice', 'pod', 'ticket', 'dispute', 'case']);

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

function inspectableType(value: string): PlatformEntityType | null {
  return INSPECTABLE_TYPES.has(value as PlatformEntityType) ? value as PlatformEntityType : null;
}

function CommandCentre() {
  const [data, setData] = useState<CommandCentrePayload | null>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [cases, setCases] = useState<CasesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState(false);
  const [healthError, setHealthError] = useState(false);
  const [casesError, setCasesError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null); setStatsError(false); setHealthError(false); setCasesError(false);
    const auth = await getAuthHeader();
    if (!auth) { setError('Session expired. Please sign in again.'); setLoading(false); return; }
    const headers = { Authorization: auth };
    try {
      const [commandResult, statsResult, healthResult, casesResult] = await Promise.all([
        fetch('/api/super-admin/command-centre', { headers, cache: 'no-store' }),
        fetch('/api/super-admin/stats', { headers, cache: 'no-store' }),
        fetch('/api/super-admin/health', { headers, cache: 'no-store' }),
        fetch('/api/super-admin/cases?status=active&limit=8', { headers, cache: 'no-store' }),
      ]);
      const [commandBody, statsBody, healthBody, casesBody] = await Promise.all([
        commandResult.json().catch(() => null),
        statsResult.json().catch(() => null),
        healthResult.json().catch(() => null),
        casesResult.json().catch(() => null),
      ]);
      if (!commandResult.ok || !commandBody) throw new Error('Command Centre is temporarily unavailable.');
      setData(commandBody as CommandCentrePayload);
      if (statsResult.ok && statsBody) setStats(statsBody as PlatformStats); else { setStats(null); setStatsError(true); }
      if (healthResult.ok && healthBody) setHealth(healthBody as HealthPayload); else { setHealth(null); setHealthError(true); }
      if (casesResult.ok && casesBody) setCases(casesBody as CasesPayload); else { setCases(null); setCasesError(true); }
    } catch {
      setError('Command Centre is temporarily unavailable. Please retry.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const queue = data?.actionQueue;

  const indicators = useMemo(() => {
    if (!data?.attentionIndicators) return null;
    const degradedCount = health?.summary?.degradedServices;
    const degradedServices: AttentionIndicator = healthError || degradedCount === undefined
      ? { count: null, label: 'Degraded core services', severity: 'unknown', note: 'Live health summary unavailable.' }
      : { count: degradedCount, label: 'Degraded core services', severity: degradedCount > 0 ? 'warning' : 'ok', note: `${health?.summary?.healthyChecks ?? 0}/${health?.summary?.totalChecks ?? 0} core checks healthy.` };
    return { ...data.attentionIndicators, degradedServices };
  }, [data?.attentionIndicators, health, healthError]);

  const kpis = stats ? [
    ['Active companies', stats.companiesActive, `${stats.companiesTotal} registered`, '/super-admin/companies/active'],
    ['Open jobs', stats.jobsOpen, `${stats.jobsTotal} total jobs`, '/super-admin/operations/jobs'],
    ['Pending approvals', stats.companiesPending, 'Requires platform review', '/super-admin/companies/approvals'],
    ['Unpaid invoices', stats.invoicesUnpaid, `${stats.invoicesTotal} invoices total`, '/super-admin/finance/invoices'],
  ] as const : [];

  const activeCases = cases?.available === true ? cases.rows ?? [] : [];
  const caseTotal = cases?.available === true ? cases.pagination?.total : undefined;

  return <div style={{ minHeight: '100vh', background: X.light, color: X.charcoal, padding: '12px' }}>
    <header style={{ minHeight: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}><h1 style={{ margin: 0, color: X.navy, fontSize: '20px', fontWeight: 800 }}>Command Centre</h1>{data && <span style={{ padding: '3px 6px', borderRadius: '4px', border: `1px solid ${data.environment === 'PRODUCTION' ? '#F1B8B8' : X.border}`, color: data.environment === 'PRODUCTION' ? X.danger : X.navy, background: X.white, fontSize: '10px', fontWeight: 800 }}>{data.environment}</span>}</div>
        <p style={{ margin: '4px 0 0', color: X.muted, fontSize: '12px' }}>Detect → inspect → investigate → act → audit from one Platform Owner control plane.</p>
        {data?.refreshedAt && <p style={{ margin: '2px 0 0', color: X.muted, fontSize: '10px' }}>Refreshed {new Date(data.refreshedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>}
      </div>
      <button onClick={() => void load()} disabled={loading} style={{ height: '32px', padding: '0 12px', border: `1px solid ${X.blue}`, borderRadius: '4px', background: X.blue, color: X.white, fontSize: '12px', fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .7 : 1 }}>Refresh</button>
    </header>

    {error && <div role="alert" style={{ marginBottom: '12px', border: '1px solid #F1B8B8', borderLeft: `4px solid ${X.danger}`, borderRadius: '4px', background: X.white, padding: '10px 12px', color: X.danger, fontSize: '12px' }}>{error}</div>}
    {(data?.unavailableSources?.length || data?.queryErrors?.length) ? <div style={{ marginBottom: '12px', border: `1px solid ${X.border}`, borderLeft: `4px solid ${X.orange}`, borderRadius: '4px', background: X.white, padding: '9px 12px', color: X.charcoal, fontSize: '11px' }}>Some derived-queue sources are unavailable or partial. Their absence is excluded from totals rather than represented as healthy zero.</div> : null}

    <section style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}><div><h2 style={{ margin: 0, color: X.navy, fontSize: '14px', fontWeight: 800 }}>Platform summary</h2><p style={{ margin: '2px 0 0', color: X.muted, fontSize: '11px' }}>Primary operational KPIs only.</p></div><Link href="/super-admin/analytics" style={{ color: X.blue, fontSize: '11px', fontWeight: 800, textDecoration: 'none' }}>Full analytics →</Link></div>
      {loading ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '12px' }}>{Array.from({ length: 4 }, (_, index) => <div key={index} style={{ minHeight: '88px', background: X.white, border: `1px solid ${X.border}`, borderRadius: '4px', padding: '12px', color: X.muted, fontSize: '11px' }}>Loading…</div>)}</div> : statsError || !stats ? <div style={{ border: `1px solid ${X.border}`, borderLeft: `4px solid ${X.orange}`, borderRadius: '4px', background: X.white, padding: '12px', color: X.muted, fontSize: '11px' }}>Platform KPI source unavailable. No zero values are fabricated.</div> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '12px' }}>{kpis.map(([label, value, note, href]) => <Link key={label} href={href} style={{ minHeight: '88px', display: 'block', textDecoration: 'none', background: X.white, border: `1px solid ${X.border}`, borderRadius: '4px', padding: '12px' }}><div style={{ color: X.navy, fontSize: '22px', lineHeight: 1.05, fontWeight: 800 }}>{value}</div><div style={{ marginTop: '7px', color: X.charcoal, fontSize: '12px', fontWeight: 700 }}>{label}</div><div style={{ marginTop: '2px', color: X.muted, fontSize: '10px' }}>{note}</div></Link>)}</div>}
    </section>

    <section style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}><h2 style={{ margin: 0, color: X.navy, fontSize: '14px', fontWeight: 800 }}>Critical attention</h2><Link href="/super-admin/health" style={{ color: X.blue, fontSize: '11px', fontWeight: 800, textDecoration: 'none' }}>Platform health →</Link></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '12px' }}>
        {(loading || !indicators ? [] : [indicators.p0p1Incidents, indicators.jobsAtRisk, indicators.blockedAccounts, indicators.financialExposure, indicators.degradedServices]).map((indicator, index) => <div key={index} style={{ minHeight: '88px', background: X.white, border: `1px solid ${X.border}`, borderRadius: '4px', padding: '12px' }}><div style={{ color: severityColor(indicator.severity), fontSize: '20px', fontWeight: 800 }}>{indicatorValue(indicator)}</div><div style={{ marginTop: '7px', color: X.charcoal, fontSize: '11px', fontWeight: 700 }}>{indicator.label}</div><div style={{ marginTop: '2px', color: X.muted, fontSize: '10px' }}>{indicator.note ?? indicator.severity}</div></div>)}
      </div>
    </section>

    <section style={{ marginBottom: '12px', border: `1px solid ${X.border}`, borderRadius: '4px', background: X.white, overflow: 'hidden' }}>
      <div style={{ minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '0 12px', borderBottom: `1px solid ${X.border}`, background: X.light }}><div><h2 style={{ margin: 0, color: X.navy, fontSize: '13px', fontWeight: 800 }}>Derived detection queue</h2>{queue?.queueNote && <p style={{ margin: '2px 0 0', color: X.muted, fontSize: '10px' }}>{queue.queueNote}</p>}</div><span style={{ color: X.muted, fontSize: '11px', fontWeight: 700 }}>{queue ? `${queue.total} from available sources` : '—'}</span></div>
      {loading ? <div style={{ padding: '18px', textAlign: 'center', color: X.muted, fontSize: '12px' }}>Loading…</div> : !queue?.items.length ? <div style={{ padding: '18px', textAlign: 'center', color: X.muted, fontSize: '12px' }}>No critical actions detected in currently available sources.</div> : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse' }}><thead><tr style={{ height: '38px', background: X.light, borderBottom: `1px solid ${X.border}` }}>{['Severity','Detection','Affected entity','Age','Inspect'].map(h => <th key={h} style={{ padding: '0 12px', textAlign: 'left', color: X.navy, fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>{h}</th>)}</tr></thead><tbody>{queue.items.slice(0, 8).map(item => { const entityType = inspectableType(item.entityType); return <tr key={item.id} style={{ minHeight: '44px', borderBottom: `1px solid ${X.border}` }}><td style={{ padding: '9px 12px' }}><span style={{ color: item.severity === 'P0' ? X.danger : X.orange, fontSize: '11px', fontWeight: 800 }}>{item.severity}</span></td><td style={{ padding: '9px 12px' }}><div style={{ color: X.charcoal, fontSize: '12px', fontWeight: 700 }}>{item.title}</div><div style={{ color: X.muted, fontSize: '10px', marginTop: '2px' }}>{item.description}</div></td><td style={{ padding: '9px 12px', color: X.charcoal, fontSize: '11px' }}>{item.entityName}</td><td style={{ padding: '9px 12px', color: X.muted, fontSize: '11px', whiteSpace: 'nowrap' }}>{fmtAge(item.ageMinutes)}</td><td style={{ padding: '9px 12px' }}>{entityType ? <PlatformEntityLink entityType={entityType} entityId={item.entityId} compact>Inspect</PlatformEntityLink> : <span style={{ color: X.muted, fontSize: '10px' }}>No canonical inspector</span>}</td></tr>;})}</tbody></table></div>}
    </section>

    <section style={{ marginBottom: '12px', border: `1px solid ${X.border}`, borderRadius: '4px', background: X.white, overflow: 'hidden' }}>
      <div style={{ minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '0 12px', borderBottom: `1px solid ${X.border}`, background: X.light }}><div><h2 style={{ margin: 0, color: X.navy, fontSize: '13px', fontWeight: 800 }}>Persistent Platform Cases</h2><p style={{ margin: '2px 0 0', color: X.muted, fontSize: '10px' }}>Durable investigations are separate from the re-derived detection queue.</p></div><Link href="/super-admin/cases" style={{ color: X.blue, fontSize: '11px', fontWeight: 800, textDecoration: 'none' }}>Case Centre →</Link></div>
      {loading ? <div style={{ padding: '14px', color: X.muted, fontSize: '11px' }}>Loading Case Centre state…</div> : casesError || !cases ? <div style={{ padding: '14px', color: X.orange, fontSize: '11px' }}>Case Centre state is unavailable. No case count is inferred.</div> : cases.available === false ? <div style={{ padding: '14px', color: X.orange, fontSize: '11px' }}>{cases.note ?? 'Platform Case Centre schema is not applied in this environment.'}</div> : <div><div style={{ padding: '8px 12px', color: X.muted, fontSize: '10px' }}>{caseTotal ?? activeCases.length} active case{(caseTotal ?? activeCases.length) === 1 ? '' : 's'}</div>{activeCases.length === 0 ? <div style={{ padding: '14px', color: X.muted, fontSize: '11px' }}>No active persistent Platform Cases.</div> : <div style={{ display: 'grid', gap: '1px', background: X.border }}>{activeCases.map(caseRow => <div key={caseRow.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: '8px', alignItems: 'center', background: X.white, padding: '8px 12px' }}><div><div style={{ color: X.navy, fontSize: '11px', fontWeight: 800 }}>{caseRow.reference} · {caseRow.severity} · {caseRow.status}</div><div style={{ marginTop: '2px', color: X.charcoal, fontSize: '11px' }}>{caseRow.title}</div><div style={{ marginTop: '2px', color: X.muted, fontSize: '9px' }}>{caseRow.source} · {caseRow.entity_label}</div></div><PlatformEntityLink entityType="case" entityId={caseRow.id} compact>Open case</PlatformEntityLink></div>)}</div>}</div>}
    </section>

    <section style={{ minHeight: '52px', border: `1px solid ${X.border}`, borderRadius: '4px', background: X.white, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}><div><h2 style={{ margin: 0, color: X.navy, fontSize: '13px', fontWeight: 800 }}>Recent administrative activity</h2><p style={{ margin: '2px 0 0', color: X.muted, fontSize: '11px' }}>Governance decisions and administrative changes remain in the audit trail.</p></div><Link href="/super-admin/settings/audit-logs" style={{ color: X.blue, fontSize: '11px', fontWeight: 800, textDecoration: 'none' }}>Open audit trail →</Link></section>
  </div>;
}

export default function SuperAdminDashboardPage() { return <ProtectedRoute allowedRoles={['owner']}><CommandCentre /></ProtectedRoute>; }
