'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '../components/ProtectedRoute';
import { supabase } from '../../lib/supabaseClient';

type Severity = 'critical' | 'warning' | 'caution' | 'ok' | 'unknown';
type AttentionIndicator =
  | { count: number | null; label: string; severity: Severity; note?: string }
  | { amountGbp: number; label: string; severity: Severity; invoiceCount?: number; amountPartial?: boolean };

type AttentionIndicators = {
  p0p1Incidents: AttentionIndicator;
  jobsAtRisk: AttentionIndicator;
  blockedAccounts: AttentionIndicator;
  financialExposure: AttentionIndicator;
  degradedServices: AttentionIndicator;
};

type ActionQueueItem = {
  id: string;
  type: string;
  severity: 'P0' | 'P1' | 'P2';
  title: string;
  description: string;
  entityType: string;
  entityId: string;
  entityName: string;
  detectedAt: string;
  ageMinutes: number;
  href: string;
};

type ActionQueue = {
  derived: boolean;
  queueNote?: string;
  total: number;
  p0: number;
  p1: number;
  p2: number;
  items: ActionQueueItem[];
};

type CommandCentrePayload = {
  environment: 'PRODUCTION' | 'STAGING' | 'DEVELOPMENT';
  refreshedAt: string;
  partialData?: boolean;
  queryErrors?: string[];
  unavailableSources?: string[];
  attentionIndicators: AttentionIndicators;
  actionQueue: ActionQueue;
};

type PlatformStats = {
  companiesTotal: number;
  companiesActive: number;
  companiesSuspended: number;
  companiesPending: number;
  driversTotal: number;
  jobsTotal: number;
  jobsOpen: number;
  jobsDelivered: number;
  invoicesTotal: number;
  invoicesUnpaid: number;
  compliancePending: number;
};

const T = {
  pageBg: '#0f172a',
  cardBg: '#1e293b',
  cardBorder: '#334155',
  surface: '#0b1220',
  text: '#f1f5f9',
  muted: '#94a3b8',
  accent: '#f5a300',
  green: '#22c55e',
  red: '#ef4444',
  orange: '#f97316',
  blue: '#60a5fa',
  yellow: '#fbbf24',
} as const;

const ENV_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  PRODUCTION: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444', border: 'rgba(239,68,68,0.35)' },
  STAGING: { bg: 'rgba(251,191,36,0.12)', text: '#fbbf24', border: 'rgba(251,191,36,0.35)' },
  DEVELOPMENT: { bg: 'rgba(96,165,250,0.12)', text: '#60a5fa', border: 'rgba(96,165,250,0.35)' },
};

const SEVERITY_COLORS: Record<'P0' | 'P1' | 'P2', string> = { P0: T.red, P1: T.orange, P2: T.yellow };

function indicatorSeverityColor(severity: Severity): string {
  if (severity === 'critical') return T.red;
  if (severity === 'warning') return T.orange;
  if (severity === 'caution') return T.yellow;
  if (severity === 'unknown') return T.muted;
  return T.green;
}

function fmtAge(minutes: number): string {
  if (minutes < 0) {
    const abs = Math.abs(minutes);
    if (abs < 60) return `in ${abs}m`;
    const hours = Math.floor(abs / 60);
    const mins = abs % 60;
    return mins > 0 ? `in ${hours}h ${mins}m` : `in ${hours}h`;
  }
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m ago` : `${hours}h ago`;
}

function EnvBanner({ env }: { env: CommandCentrePayload['environment'] }) {
  const colors = ENV_COLORS[env] ?? ENV_COLORS.DEVELOPMENT;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', border: `1px solid ${colors.border}`, borderRadius: '4px', backgroundColor: colors.bg, padding: '0.16rem 0.48rem', fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.08em', color: colors.text, textTransform: 'uppercase' }}>
      {env === 'PRODUCTION' ? '⚠' : '⬡'} {env}
    </span>
  );
}

function IndicatorCard({ indicator }: { indicator: AttentionIndicator }) {
  const color = indicatorSeverityColor(indicator.severity);
  const value = 'count' in indicator
    ? (indicator.count === null ? '—' : indicator.count.toLocaleString())
    : `£${indicator.amountGbp.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const note = 'count' in indicator ? indicator.note : indicator.amountPartial ? 'Partial total' : undefined;
  return (
    <div style={{ backgroundColor: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: '7px', padding: '0.72rem' }}>
      <div style={{ color: T.muted, fontSize: '0.64rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.28rem' }}>{indicator.label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.45rem' }}>
        <div style={{ color, fontSize: '1.25rem', fontWeight: 900, lineHeight: 1.1 }}>{value}</div>
        <span style={{ fontSize: '0.58rem', fontWeight: 800, textTransform: 'uppercase', color }}>{indicator.severity}</span>
      </div>
      {note && <div style={{ color: T.muted, fontSize: '0.6rem', marginTop: '0.28rem' }}>{note}</div>}
    </div>
  );
}

function KpiCard({ label, value, note, href, tone = T.text }: { label: string; value: string | number; note: string; href: string; tone?: string }) {
  return (
    <Link href={href} style={{ textDecoration: 'none', backgroundColor: T.surface, border: `1px solid ${T.cardBorder}`, borderRadius: '7px', padding: '0.75rem', display: 'block' }}>
      <div style={{ color: tone, fontSize: '1.28rem', fontWeight: 900, lineHeight: 1.1 }}>{value}</div>
      <div style={{ color: T.text, fontSize: '0.72rem', fontWeight: 750, marginTop: '0.28rem' }}>{label}</div>
      <div style={{ color: T.muted, fontSize: '0.62rem', marginTop: '0.12rem' }}>{note}</div>
    </Link>
  );
}

function SeverityBadge({ sev }: { sev: 'P0' | 'P1' | 'P2' }) {
  const color = SEVERITY_COLORS[sev];
  return <span style={{ display: 'inline-block', minWidth: '2rem', textAlign: 'center', padding: '0.12rem 0.38rem', borderRadius: '4px', backgroundColor: `${color}18`, border: `1px solid ${color}40`, color, fontSize: '0.64rem', fontWeight: 800 }}>{sev}</span>;
}

function ActionQueueRow({ item }: { item: ActionQueueItem }) {
  return (
    <tr style={{ borderBottom: `1px solid ${T.cardBorder}` }}>
      <td style={{ padding: '0.48rem 0.75rem' }}><SeverityBadge sev={item.severity} /></td>
      <td style={{ padding: '0.48rem 0.75rem' }}>
        <div style={{ color: T.text, fontSize: '0.76rem', fontWeight: 700 }}>{item.title}</div>
        <div style={{ color: T.muted, fontSize: '0.66rem', marginTop: '0.08rem' }}>{item.description}</div>
      </td>
      <td style={{ padding: '0.48rem 0.75rem' }}>
        <div style={{ color: T.text, fontSize: '0.72rem' }}>{item.entityName}</div>
        <div style={{ color: T.muted, fontSize: '0.62rem', textTransform: 'capitalize' }}>{item.entityType}</div>
      </td>
      <td style={{ padding: '0.48rem 0.75rem', color: T.muted, fontSize: '0.68rem', whiteSpace: 'nowrap' }}>{fmtAge(item.ageMinutes)}</td>
      <td style={{ padding: '0.48rem 0.75rem' }}>
        <Link href={item.href} style={{ display: 'inline-block', padding: '0.22rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(245,163,0,.35)', backgroundColor: 'rgba(245,163,0,.08)', color: T.accent, fontSize: '0.66rem', fontWeight: 800, textDecoration: 'none' }}>Review →</Link>
      </td>
    </tr>
  );
}

function CommandCentre() {
  const [data, setData] = useState<CommandCentrePayload | null>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setError('Session expired. Please sign in again.');
      setLoading(false);
      return;
    }

    const headers = { Authorization: `Bearer ${session.access_token}` };
    try {
      const [commandResult, statsResult] = await Promise.allSettled([
        fetch('/api/super-admin/command-centre', { headers }),
        fetch('/api/super-admin/stats', { headers }),
      ]);

      if (commandResult.status === 'rejected') throw commandResult.reason;
      const commandBody = (await commandResult.value.json().catch(() => null)) as (CommandCentrePayload & { error?: string }) | null;
      if (!commandResult.value.ok) throw new Error(commandBody?.error ?? `Command Centre HTTP ${commandResult.value.status}`);
      setData(commandBody);

      if (statsResult.status === 'fulfilled') {
        const statsBody = (await statsResult.value.json().catch(() => null)) as (PlatformStats & { error?: string }) | null;
        if (statsResult.value.ok && statsBody) setStats(statsBody);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Command Centre could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const indicators = data?.attentionIndicators;
  const queue = data?.actionQueue;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: T.pageBg, padding: '1.2rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.24rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: T.text }}>Command Centre</h1>
            {data && <EnvBanner env={data.environment} />}
          </div>
          <p style={{ margin: 0, color: T.muted, fontSize: '0.78rem' }}>Platform health, urgent attention and operational workload in one view.</p>
          {data?.refreshedAt && <p style={{ margin: '0.18rem 0 0', color: '#64748b', fontSize: '0.64rem' }}>Refreshed {new Date(data.refreshedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>}
        </div>
        <button onClick={() => void load()} disabled={loading} style={{ height: '32px', padding: '0 0.75rem', backgroundColor: T.accent, color: '#0f172a', border: 'none', borderRadius: '5px', fontWeight: 800, fontSize: '0.72rem', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>↻ Refresh</button>
      </div>

      {error && <div style={{ marginBottom: '0.8rem', border: `1px solid ${T.red}`, borderRadius: '6px', backgroundColor: 'rgba(239,68,68,0.08)', padding: '0.55rem 0.75rem', color: '#fca5a5', fontSize: '0.74rem' }}>Command Centre is temporarily unavailable. Please retry.</div>}
      {data?.unavailableSources?.length ? <div style={{ marginBottom: '0.8rem', border: `1px solid ${T.cardBorder}`, borderRadius: '6px', backgroundColor: 'rgba(148,163,184,0.05)', padding: '0.52rem 0.72rem', color: T.muted, fontSize: '0.7rem' }}>Some platform services are currently excluded from totals.</div> : null}
      {data?.queryErrors?.length ? <div style={{ marginBottom: '0.8rem', border: `1px solid ${T.orange}`, borderRadius: '6px', backgroundColor: 'rgba(249,115,22,0.06)', padding: '0.52rem 0.72rem', color: '#fdba74', fontSize: '0.7rem' }}>Partial data is being shown because one or more services did not respond.</div> : null}

      <section style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginBottom: '0.5rem' }}>
          <div><h2 style={{ margin: 0, color: T.text, fontSize: '0.84rem' }}>Platform summary</h2><p style={{ margin: '0.12rem 0 0', color: T.muted, fontSize: '0.64rem' }}>Only the primary operational KPIs are shown here.</p></div>
          <Link href="/super-admin/analytics" style={{ color: '#93c5fd', fontSize: '0.68rem', textDecoration: 'none', fontWeight: 700 }}>Full analytics →</Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.55rem' }}>
          {loading || !stats ? Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ minHeight: 76, backgroundColor: T.surface, border: `1px solid ${T.cardBorder}`, borderRadius: 7, padding: '0.75rem', color: T.muted }}>Loading…</div>) : <>
            <KpiCard label="Active companies" value={stats.companiesActive} note={`${stats.companiesTotal} registered`} href="/super-admin/companies/active" tone={T.green} />
            <KpiCard label="Open jobs" value={stats.jobsOpen} note={`${stats.jobsTotal} total jobs`} href="/super-admin/operations/jobs" tone={stats.jobsOpen > 0 ? T.accent : T.green} />
            <KpiCard label="Pending approvals" value={stats.companiesPending} note="Requires platform review" href="/super-admin/companies/approvals" tone={stats.companiesPending > 0 ? T.orange : T.green} />
            <KpiCard label="Unpaid invoices" value={stats.invoicesUnpaid} note={`${stats.invoicesTotal} invoices total`} href="/super-admin/finance/invoices" tone={stats.invoicesUnpaid > 0 ? T.orange : T.green} />
          </>}
        </div>
      </section>

      <section style={{ marginBottom: '1rem' }}>
        <h2 style={{ margin: '0 0 0.5rem', color: T.text, fontSize: '0.84rem' }}>Critical attention</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '0.55rem' }}>
          {loading || !indicators ? Array.from({ length: 5 }).map((_, i) => <div key={i} style={{ minHeight: 78, backgroundColor: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 7, padding: '0.72rem', color: T.muted }}>Loading…</div>) : <>
            <IndicatorCard indicator={indicators.p0p1Incidents} />
            <IndicatorCard indicator={indicators.jobsAtRisk} />
            <IndicatorCard indicator={indicators.blockedAccounts} />
            <IndicatorCard indicator={indicators.financialExposure} />
            <IndicatorCard indicator={indicators.degradedServices} />
          </>}
        </div>
      </section>

      <section style={{ backgroundColor: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: '8px', overflow: 'hidden', marginBottom: '1rem' }}>
        <div style={{ padding: '0.62rem 0.75rem', borderBottom: `1px solid ${T.cardBorder}`, backgroundColor: T.surface, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div><h2 style={{ margin: 0, fontSize: '0.84rem', fontWeight: 800, color: T.text }}>Operational queue</h2>{queue?.queueNote && <p style={{ margin: '0.12rem 0 0', color: T.muted, fontSize: '0.6rem' }}>{queue.queueNote}</p>}</div>
          <div style={{ display: 'flex', gap: '0.35rem', fontSize: '0.64rem', fontWeight: 800 }}>
            <span style={{ color: T.text }}>{queue?.total ?? 0} total</span>
            {(queue?.p0 ?? 0) > 0 && <span style={{ color: T.red }}>P0 {queue?.p0}</span>}
            {(queue?.p1 ?? 0) > 0 && <span style={{ color: T.orange }}>P1 {queue?.p1}</span>}
            {(queue?.p2 ?? 0) > 0 && <span style={{ color: T.yellow }}>P2 {queue?.p2}</span>}
          </div>
        </div>
        {loading ? <div style={{ padding: '1.5rem', textAlign: 'center', color: T.muted }}>Loading…</div> : !queue?.items.length ? <div style={{ padding: '1.1rem', textAlign: 'center', color: T.muted, fontSize: '0.76rem' }}>✓ No critical actions in currently available sources.</div> : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}><thead><tr style={{ borderBottom: `1px solid ${T.cardBorder}` }}>{['Severity', 'Action', 'Affected entity', 'Age', ''].map((heading) => <th key={heading} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: T.muted, fontSize: '0.64rem', fontWeight: 700, textTransform: 'uppercase' }}>{heading}</th>)}</tr></thead><tbody>{queue.items.slice(0, 8).map((item) => <ActionQueueRow key={item.id} item={item} />)}</tbody></table></div>}
      </section>

      <section style={{ border: `1px solid ${T.cardBorder}`, borderRadius: '8px', backgroundColor: T.surface, padding: '0.7rem 0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, color: T.text, fontSize: '0.8rem' }}>Recent administrative activity</h2>
          <p style={{ margin: '0.14rem 0 0', color: T.muted, fontSize: '0.66rem' }}>Administrative changes and governance decisions are recorded in the platform audit trail.</p>
        </div>
        <Link href="/super-admin/settings/audit-logs" style={{ color: '#93c5fd', fontSize: '0.68rem', fontWeight: 800, textDecoration: 'none' }}>Open audit trail →</Link>
      </section>
    </div>
  );
}

export default function SuperAdminDashboardPage() {
  return <ProtectedRoute allowedRoles={['owner']}><CommandCentre /></ProtectedRoute>;
}
