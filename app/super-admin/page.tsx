'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  accent: '#f59e0b',
  green: '#22c55e',
  red: '#ef4444',
  orange: '#f97316',
  blue: '#3b82f6',
  yellow: '#fbbf24',
} as const;

const ENV_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  PRODUCTION: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444', border: 'rgba(239,68,68,0.35)' },
  STAGING: { bg: 'rgba(251,191,36,0.12)', text: '#fbbf24', border: 'rgba(251,191,36,0.35)' },
  DEVELOPMENT: { bg: 'rgba(59,130,246,0.12)', text: '#3b82f6', border: 'rgba(59,130,246,0.35)' },
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
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', border: `1px solid ${colors.border}`, borderRadius: '6px', backgroundColor: colors.bg, padding: '0.2rem 0.65rem', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.1em', color: colors.text, textTransform: 'uppercase' }}>
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
    <div style={{ backgroundColor: T.cardBg, border: `1px solid ${T.cardBorder}`, borderTop: `3px solid ${color}`, borderRadius: '10px', padding: '0.9rem' }}>
      <div style={{ color: T.muted, fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>{indicator.label}</div>
      <div style={{ color, fontSize: '1.55rem', fontWeight: 900, lineHeight: 1.1 }}>{value}</div>
      <span style={{ marginTop: '0.4rem', display: 'inline-block', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', color, backgroundColor: `${color}18`, padding: '0.1rem 0.4rem', borderRadius: '3px' }}>{indicator.severity}</span>
      {note && <div style={{ color: T.muted, fontSize: '0.62rem', marginTop: '0.3rem' }}>{note}</div>}
    </div>
  );
}

function KpiCard({ label, value, note, href, tone = T.text }: { label: string; value: string | number; note: string; href: string; tone?: string }) {
  return (
    <Link href={href} style={{ textDecoration: 'none', backgroundColor: T.surface, border: `1px solid ${T.cardBorder}`, borderRadius: '10px', padding: '0.8rem', display: 'block' }}>
      <div style={{ color: tone, fontSize: '1.35rem', fontWeight: 900, lineHeight: 1.1 }}>{value}</div>
      <div style={{ color: T.text, fontSize: '0.72rem', fontWeight: 750, marginTop: '0.35rem' }}>{label}</div>
      <div style={{ color: T.muted, fontSize: '0.64rem', marginTop: '0.18rem' }}>{note}</div>
    </Link>
  );
}

function ControlWidget({ title, value, detail, href, icon, tone = T.text }: { title: string; value: string | number; detail: string; href: string; icon: string; tone?: string }) {
  return (
    <Link href={href} style={{ textDecoration: 'none', backgroundColor: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: '12px', padding: '0.9rem', display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: '0.7rem' }}>
      <span style={{ fontSize: '1.2rem' }}>{icon}</span>
      <div>
        <div style={{ color: T.text, fontSize: '0.78rem', fontWeight: 750 }}>{title}</div>
        <div style={{ color: T.muted, fontSize: '0.66rem', marginTop: '0.15rem' }}>{detail}</div>
      </div>
      <div style={{ color: tone, fontSize: '1.15rem', fontWeight: 900 }}>{value}</div>
    </Link>
  );
}

function SeverityBadge({ sev }: { sev: 'P0' | 'P1' | 'P2' }) {
  const color = SEVERITY_COLORS[sev];
  return <span style={{ display: 'inline-block', minWidth: '2.1rem', textAlign: 'center', padding: '0.15rem 0.45rem', borderRadius: '4px', backgroundColor: `${color}20`, border: `1px solid ${color}50`, color, fontSize: '0.68rem', fontWeight: 800 }}>{sev}</span>;
}

function ActionQueueRow({ item }: { item: ActionQueueItem }) {
  return (
    <tr style={{ borderBottom: `1px solid ${T.cardBorder}` }}>
      <td style={{ padding: '0.6rem 0.9rem' }}><SeverityBadge sev={item.severity} /></td>
      <td style={{ padding: '0.6rem 0.9rem' }}>
        <div style={{ color: T.text, fontSize: '0.8rem', fontWeight: 650 }}>{item.title}</div>
        <div style={{ color: T.muted, fontSize: '0.7rem', marginTop: '0.1rem' }}>{item.description}</div>
      </td>
      <td style={{ padding: '0.6rem 0.9rem' }}>
        <div style={{ color: T.text, fontSize: '0.76rem' }}>{item.entityName}</div>
        <div style={{ color: T.muted, fontSize: '0.66rem', textTransform: 'capitalize' }}>{item.entityType}</div>
      </td>
      <td style={{ padding: '0.6rem 0.9rem', color: T.muted, fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{fmtAge(item.ageMinutes)}</td>
      <td style={{ padding: '0.6rem 0.9rem' }}>
        <Link href={item.href} style={{ display: 'inline-block', padding: '0.25rem 0.6rem', borderRadius: '5px', border: `1px solid ${T.accent}50`, backgroundColor: `${T.accent}12`, color: T.accent, fontSize: '0.7rem', fontWeight: 700, textDecoration: 'none' }}>Review →</Link>
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
  const queueTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of queue?.items ?? []) counts[item.type] = (counts[item.type] ?? 0) + 1;
    return counts;
  }, [queue]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: T.pageBg, padding: '1.35rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1.15rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: T.text }}>Command Centre</h1>
            {data && <EnvBanner env={data.environment} />}
            <span style={{ fontSize: '0.64rem', fontWeight: 700, textTransform: 'uppercase', color: T.accent, backgroundColor: 'rgba(245,158,11,0.12)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>Platform Owner</span>
          </div>
          <p style={{ margin: 0, color: T.muted, fontSize: '0.82rem' }}>Global operational control: platform KPIs, risk, compliance, finance and action queues.</p>
          {data?.refreshedAt && <p style={{ margin: '0.22rem 0 0', color: '#64748b', fontSize: '0.68rem' }}>Refreshed {new Date(data.refreshedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>}
        </div>
        <button onClick={() => void load()} disabled={loading} style={{ padding: '0.42rem 0.9rem', backgroundColor: T.accent, color: '#0f172a', border: 'none', borderRadius: '8px', fontWeight: 800, fontSize: '0.76rem', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>↻ Refresh</button>
      </div>

      {error && <div style={{ marginBottom: '0.9rem', border: `1px solid ${T.red}`, borderRadius: '8px', backgroundColor: 'rgba(239,68,68,0.1)', padding: '0.65rem 0.9rem', color: T.red, fontSize: '0.8rem' }}>⚠ {error}</div>}
      {data?.unavailableSources?.length ? <div style={{ marginBottom: '0.9rem', border: `1px solid ${T.cardBorder}`, borderRadius: '8px', backgroundColor: 'rgba(148,163,184,0.06)', padding: '0.6rem 0.85rem', color: T.muted, fontSize: '0.76rem' }}>Some sources are unavailable and excluded: {data.unavailableSources.join(', ')}.</div> : null}
      {data?.queryErrors?.length ? <div style={{ marginBottom: '0.9rem', border: `1px solid ${T.orange}`, borderRadius: '8px', backgroundColor: 'rgba(249,115,22,0.08)', padding: '0.6rem 0.85rem', color: T.orange, fontSize: '0.76rem' }}>Partial data — one or more sources returned an error.</div> : null}

      <section style={{ marginBottom: '1.1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginBottom: '0.55rem' }}>
          <div><h2 style={{ margin: 0, color: T.text, fontSize: '0.88rem' }}>Platform overview</h2><p style={{ margin: '0.15rem 0 0', color: T.muted, fontSize: '0.66rem' }}>Live totals from the platform stats service.</p></div>
          <Link href="/super-admin/analytics" style={{ color: T.accent, fontSize: '0.7rem', textDecoration: 'none', fontWeight: 700 }}>Full analytics →</Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.55rem' }}>
          {loading || !stats ? Array.from({ length: 8 }).map((_, i) => <div key={i} style={{ minHeight: 74, backgroundColor: T.surface, border: `1px solid ${T.cardBorder}`, borderRadius: 10, padding: '0.8rem', color: T.muted }}>Loading…</div>) : <>
            <KpiCard label="Active companies" value={stats.companiesActive} note={`${stats.companiesTotal} total`} href="/super-admin/companies/active" tone={T.green} />
            <KpiCard label="Pending approvals" value={stats.companiesPending} note="Needs review" href="/super-admin/companies/approvals" tone={stats.companiesPending > 0 ? T.orange : T.green} />
            <KpiCard label="Drivers" value={stats.driversTotal} note="External driver accounts" href="/super-admin/users/drivers" tone={T.blue} />
            <KpiCard label="Open jobs" value={stats.jobsOpen} note={`${stats.jobsTotal} total jobs`} href="/super-admin/operations/jobs" tone={stats.jobsOpen > 0 ? T.accent : T.green} />
            <KpiCard label="Delivered jobs" value={stats.jobsDelivered} note="Completed workload" href="/super-admin/operations/completed-jobs" tone={T.green} />
            <KpiCard label="Unpaid invoices" value={stats.invoicesUnpaid} note={`${stats.invoicesTotal} invoices total`} href="/super-admin/finance/invoices" tone={stats.invoicesUnpaid > 0 ? T.orange : T.green} />
            <KpiCard label="Compliance pending" value={stats.compliancePending} note="Pending or rejected documents" href="/super-admin/compliance/documents" tone={stats.compliancePending > 0 ? T.orange : T.green} />
            <KpiCard label="Suspended companies" value={stats.companiesSuspended} note="Restricted accounts" href="/super-admin/companies/suspended" tone={stats.companiesSuspended > 0 ? T.red : T.green} />
          </>}
        </div>
      </section>

      <section style={{ marginBottom: '1.1rem' }}>
        <h2 style={{ margin: '0 0 0.55rem', color: T.text, fontSize: '0.88rem' }}>Attention indicators</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.6rem' }}>
          {loading || !indicators ? Array.from({ length: 5 }).map((_, i) => <div key={i} style={{ minHeight: 90, backgroundColor: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 10, padding: '0.9rem', color: T.muted }}>Loading…</div>) : <>
            <IndicatorCard indicator={indicators.p0p1Incidents} />
            <IndicatorCard indicator={indicators.jobsAtRisk} />
            <IndicatorCard indicator={indicators.blockedAccounts} />
            <IndicatorCard indicator={indicators.financialExposure} />
            <IndicatorCard indicator={indicators.degradedServices} />
          </>}
        </div>
      </section>

      {!loading && queue && <section style={{ marginBottom: '1.15rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.6rem' }}>
          <ControlWidget title="Company approvals" value={stats?.companiesPending ?? queueTypeCounts.company_pending_approval ?? 0} detail="Applications waiting for platform review" href="/super-admin/companies/approvals" icon="✓" tone={(stats?.companiesPending ?? 0) > 0 ? T.orange : T.green} />
          <ControlWidget title="Allocation pressure" value={queueTypeCounts.job_no_driver ?? 0} detail="Awarded or allocated work without driver" href="/super-admin/operations/allocations" icon="⇄" tone={(queueTypeCounts.job_no_driver ?? 0) > 0 ? T.orange : T.green} />
          <ControlWidget title="Compliance alerts" value={(queueTypeCounts.document_expired ?? 0) + (queueTypeCounts.document_expiring ?? 0)} detail="Expired or soon-to-expire driver documents" href="/super-admin/compliance/expiries" icon="▤" tone={(queueTypeCounts.document_expired ?? 0) > 0 ? T.red : (queueTypeCounts.document_expiring ?? 0) > 0 ? T.orange : T.green} />
          <ControlWidget title="Critical support" value={queueTypeCounts.support_ticket_critical ?? 0} detail="Critical support cases in the action queue" href="/super-admin/support/tickets" icon="?" tone={(queueTypeCounts.support_ticket_critical ?? 0) > 0 ? T.red : T.green} />
          <ControlWidget title="Fraud review" value={queueTypeCounts.fraud_case ?? 0} detail="Open fraud or identity review cases" href="/super-admin/compliance/fraud-cases" icon="!" tone={(queueTypeCounts.fraud_case ?? 0) > 0 ? T.red : T.green} />
          <ControlWidget title="Overdue invoices" value={stats?.invoicesUnpaid ?? queueTypeCounts.invoice_overdue ?? 0} detail="Unpaid finance workload requiring review" href="/super-admin/finance" icon="£" tone={(stats?.invoicesUnpaid ?? 0) > 0 ? T.orange : T.green} />
        </div>
      </section>}

      <section style={{ backgroundColor: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: '12px', overflow: 'hidden', marginBottom: '1.15rem' }}>
        <div style={{ padding: '0.7rem 0.85rem', borderBottom: `1px solid ${T.cardBorder}`, backgroundColor: T.surface, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div><h2 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 750, color: T.text }}>Critical action queue</h2>{queue?.queueNote && <p style={{ margin: '0.15rem 0 0', color: T.muted, fontSize: '0.64rem' }}>{queue.queueNote}</p>}</div>
          <div style={{ display: 'flex', gap: '0.35rem', fontSize: '0.68rem', fontWeight: 800 }}>
            <span style={{ color: T.text }}>{queue?.total ?? 0} total</span>
            {(queue?.p0 ?? 0) > 0 && <span style={{ color: T.red }}>P0 {queue?.p0}</span>}
            {(queue?.p1 ?? 0) > 0 && <span style={{ color: T.orange }}>P1 {queue?.p1}</span>}
            {(queue?.p2 ?? 0) > 0 && <span style={{ color: T.yellow }}>P2 {queue?.p2}</span>}
          </div>
        </div>
        {loading ? <div style={{ padding: '2rem', textAlign: 'center', color: T.muted }}>Loading…</div> : !queue?.items.length ? <div style={{ padding: '1.5rem', textAlign: 'center', color: T.muted, fontSize: '0.8rem' }}>✓ No critical actions in currently available sources.</div> : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}><thead><tr style={{ borderBottom: `1px solid ${T.cardBorder}` }}>{['Severity', 'Action', 'Affected entity', 'Age', ''].map((heading) => <th key={heading} style={{ padding: '0.6rem 0.9rem', textAlign: 'left', color: T.muted, fontSize: '0.68rem', fontWeight: 650, textTransform: 'uppercase' }}>{heading}</th>)}</tr></thead><tbody>{queue.items.slice(0, 12).map((item) => <ActionQueueRow key={item.id} item={item} />)}</tbody></table></div>}
      </section>

      <section>
        <h2 style={{ margin: '0 0 0.55rem', color: T.text, fontSize: '0.88rem' }}>Control areas</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.55rem' }}>
          {[
            ['Marketplace', '/super-admin/marketplace', '▦'],
            ['Operations', '/super-admin/operations/active-jobs', '→'],
            ['Companies', '/super-admin/companies', '◎'],
            ['Finance', '/super-admin/finance', '£'],
            ['Compliance', '/super-admin/compliance/documents', '▤'],
            ['Notifications', '/super-admin/notifications', '!'],
            ['Platform Health', '/super-admin/health', '✓'],
            ['Audit Logs', '/super-admin/settings/audit-logs', '▤'],
          ].map(([label, href, icon]) => <Link key={href} href={href} style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', backgroundColor: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: '9px', padding: '0.65rem 0.8rem', color: T.text, fontSize: '0.76rem', fontWeight: 650, textDecoration: 'none' }}><span>{icon}</span>{label}</Link>)}
        </div>
      </section>
    </div>
  );
}

export default function SuperAdminDashboardPage() {
  return <ProtectedRoute allowedRoles={['owner']}><CommandCentre /></ProtectedRoute>;
}
