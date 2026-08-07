'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '../components/ProtectedRoute';
import { supabase } from '../../lib/supabaseClient';

// ---------------------------------------------------------------------------
// Types — mirrors /api/super-admin/command-centre response shape
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Styling constants
// ---------------------------------------------------------------------------

const T = {
  pageBg:      '#0f172a',
  cardBg:      '#1e293b',
  cardBorder:  '#334155',
  surface:     '#0b1220',
  text:        '#f1f5f9',
  muted:       '#94a3b8',
  accent:      '#f59e0b',
  green:       '#22c55e',
  red:         '#ef4444',
  orange:      '#f97316',
  blue:        '#3b82f6',
  yellow:      '#fbbf24',
} as const;

const ENV_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  PRODUCTION:  { bg: 'rgba(239,68,68,0.12)',   text: '#ef4444', border: 'rgba(239,68,68,0.35)' },
  STAGING:     { bg: 'rgba(251,191,36,0.12)',  text: '#fbbf24', border: 'rgba(251,191,36,0.35)' },
  DEVELOPMENT: { bg: 'rgba(59,130,246,0.12)',  text: '#3b82f6', border: 'rgba(59,130,246,0.35)' },
};

const SEVERITY_COLORS: Record<'P0' | 'P1' | 'P2', string> = {
  P0: T.red,
  P1: T.orange,
  P2: T.yellow,
};

const indicatorSeverityColor = (sev: Severity): string => {
  if (sev === 'critical') return T.red;
  if (sev === 'warning')  return T.orange;
  if (sev === 'caution')  return T.yellow;
  if (sev === 'unknown')  return T.muted;
  return T.green;
};

const fmtAge = (minutes: number): string => {
  if (minutes < 0) {
    const abs = Math.abs(minutes);
    if (abs < 60) return `in ${abs}m`;
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return m > 0 ? `in ${h}h ${m}m` : `in ${h}h`;
  }
  if (minutes < 60) return `${minutes}m ago`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m ago` : `${h}h ago`;
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EnvBanner({ env }: { env: CommandCentrePayload['environment'] }) {
  const colors = ENV_COLORS[env] ?? ENV_COLORS.DEVELOPMENT;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
      border: `1px solid ${colors.border}`, borderRadius: '6px',
      backgroundColor: colors.bg, padding: '0.2rem 0.65rem',
      fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.1em',
      color: colors.text, textTransform: 'uppercase',
    }}>
      {env === 'PRODUCTION' ? '⚠' : env === 'STAGING' ? '⬡' : '⬡'} {env}
    </div>
  );
}

function IndicatorCard({ indicator }: { indicator: AttentionIndicator }) {
  const color = indicatorSeverityColor(indicator.severity);
  let value: string;
  let subNote: string | undefined;
  if ('count' in indicator) {
    value = indicator.count === null ? '—' : indicator.count.toLocaleString();
    subNote = 'note' in indicator ? indicator.note : undefined;
  } else {
    value = `£${indicator.amountGbp.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (indicator.amountPartial) subNote = 'Partial total';
  }
  return (
    <div style={{
      backgroundColor: T.cardBg, border: `1px solid ${T.cardBorder}`,
      borderTop: `3px solid ${color}`, borderRadius: '10px', padding: '1rem',
    }}>
      <div style={{ color: T.muted, fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>{indicator.label}</div>
      <div style={{ color, fontSize: '1.7rem', fontWeight: 900, lineHeight: 1.1 }}>{value}</div>
      <div style={{
        marginTop: '0.45rem', display: 'inline-block', fontSize: '0.65rem',
        fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
        color, backgroundColor: `${color}18`, padding: '0.1rem 0.4rem', borderRadius: '3px',
      }}>
        {indicator.severity}
      </div>
      {subNote && (
        <div style={{ color: T.muted, fontSize: '0.62rem', marginTop: '0.3rem' }}>{subNote}</div>
      )}
    </div>
  );
}

function SeverityBadge({ sev }: { sev: 'P0' | 'P1' | 'P2' }) {
  const c = SEVERITY_COLORS[sev];
  return (
    <span style={{
      display: 'inline-block', minWidth: '2.1rem', textAlign: 'center',
      padding: '0.15rem 0.45rem', borderRadius: '4px',
      backgroundColor: `${c}20`, border: `1px solid ${c}50`,
      color: c, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.06em',
    }}>
      {sev}
    </span>
  );
}

function ActionQueueRow({ item }: { item: ActionQueueItem }) {
  return (
    <tr style={{ borderBottom: `1px solid ${T.cardBorder}` }}>
      <td style={{ padding: '0.6rem 0.9rem', whiteSpace: 'nowrap' }}>
        <SeverityBadge sev={item.severity} />
      </td>
      <td style={{ padding: '0.6rem 0.9rem' }}>
        <div style={{ color: T.text, fontSize: '0.82rem', fontWeight: 600 }}>{item.title}</div>
        <div style={{ color: T.muted, fontSize: '0.72rem', marginTop: '0.1rem' }}>{item.description}</div>
      </td>
      <td style={{ padding: '0.6rem 0.9rem' }}>
        <div style={{ color: T.text, fontSize: '0.78rem', fontWeight: 500 }}>{item.entityName}</div>
        <div style={{ color: T.muted, fontSize: '0.68rem', marginTop: '0.1rem', textTransform: 'capitalize' }}>{item.entityType}</div>
      </td>
      <td style={{ padding: '0.6rem 0.9rem', color: T.muted, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
        {fmtAge(item.ageMinutes)}
      </td>
      <td style={{ padding: '0.6rem 0.9rem', whiteSpace: 'nowrap' }}>
        <Link
          href={item.href}
          style={{
            display: 'inline-block', padding: '0.25rem 0.6rem', borderRadius: '5px',
            border: `1px solid ${T.accent}50`, backgroundColor: `${T.accent}12`,
            color: T.accent, fontSize: '0.72rem', fontWeight: 700, textDecoration: 'none',
          }}
        >
          Review →
        </Link>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function CommandCentre() {
  const [data, setData]       = useState<CommandCentrePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setError('Session expired. Please sign in again.');
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/super-admin/command-centre', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const payload = (await res.json().catch(() => null)) as (CommandCentrePayload & { error?: string }) | null;
      if (!res.ok) {
        setError(payload?.error ?? `HTTP ${res.status}`);
      } else {
        setData(payload);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Command Centre could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const indicators = data?.attentionIndicators;
  const queue      = data?.actionQueue;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: T.pageBg, padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: T.text }}>
              Command Centre
            </h1>
            {data && <EnvBanner env={data.environment} />}
            <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.accent, backgroundColor: 'rgba(245,158,11,0.12)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
              Super Admin
            </span>
          </div>
          <p style={{ margin: 0, color: T.muted, fontSize: '0.85rem' }}>
            On-demand platform snapshot — incidents, jobs at risk, blocked accounts, financial exposure and degraded services. Refreshed on page load or manual refresh.
          </p>
          {data?.refreshedAt && (
            <p style={{ margin: '0.25rem 0 0', color: '#475569', fontSize: '0.72rem' }}>
              Refreshed: {new Date(data.refreshedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          )}
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          style={{
            padding: '0.45rem 1rem', backgroundColor: T.accent, color: '#0f172a',
            border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '0.78rem',
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: '1rem', border: `1px solid ${T.red}`, borderRadius: '8px', backgroundColor: 'rgba(239,68,68,0.1)', padding: '0.65rem 0.9rem', color: T.red, fontSize: '0.82rem' }}>
          ⚠️ {error}
        </div>
      )}

      {data?.unavailableSources && data.unavailableSources.length > 0 && (
        <div style={{ marginBottom: '1rem', border: `1px solid ${T.muted}`, borderRadius: '8px', backgroundColor: 'rgba(148,163,184,0.08)', padding: '0.65rem 0.9rem', color: T.muted, fontSize: '0.82rem' }}>
          ℹ️ Some data sources are not yet available in the live schema and are excluded from this view: {data.unavailableSources.join(', ')}.
        </div>
      )}

      {data?.queryErrors && data.queryErrors.length > 0 && (
        <div style={{ marginBottom: '1rem', border: `1px solid ${T.orange}`, borderRadius: '8px', backgroundColor: 'rgba(249,115,22,0.08)', padding: '0.65rem 0.9rem', color: T.orange, fontSize: '0.82rem' }}>
          ⚠️ Partial data — one or more data sources returned an error. Some indicators may be incomplete.
          <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.2rem', fontSize: '0.75rem', color: T.muted }}>
            {data.queryErrors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* Attention indicators */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {loading || !indicators ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ backgroundColor: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: '10px', padding: '1rem', minHeight: '90px' }}>
              <div style={{ color: T.muted, fontSize: '0.8rem' }}>Loading…</div>
            </div>
          ))
        ) : (
          <>
            <IndicatorCard indicator={indicators.p0p1Incidents} />
            <IndicatorCard indicator={indicators.jobsAtRisk} />
            <IndicatorCard indicator={indicators.blockedAccounts} />
            <IndicatorCard indicator={indicators.financialExposure} />
            <IndicatorCard indicator={indicators.degradedServices} />
          </>
        )}
      </div>

      {/* Queue summary */}
      {!loading && queue && (
        <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div style={{ backgroundColor: T.surface, border: `1px solid ${T.cardBorder}`, borderRadius: '8px', padding: '0.4rem 0.85rem', color: T.text, fontSize: '0.82rem', fontWeight: 600 }}>
            {queue.total} items in queue
          </div>
          {queue.p0 > 0 && (
            <div style={{ backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '0.4rem 0.85rem', color: T.red, fontSize: '0.82rem', fontWeight: 700 }}>
              P0: {queue.p0}
            </div>
          )}
          {queue.p1 > 0 && (
            <div style={{ backgroundColor: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '8px', padding: '0.4rem 0.85rem', color: T.orange, fontSize: '0.82rem', fontWeight: 700 }}>
              P1: {queue.p1}
            </div>
          )}
          {queue.p2 > 0 && (
            <div style={{ backgroundColor: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '8px', padding: '0.4rem 0.85rem', color: T.yellow, fontSize: '0.82rem', fontWeight: 700 }}>
              P2: {queue.p2}
            </div>
          )}
        </div>
      )}

      <div style={{ backgroundColor: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: '12px', overflow: 'hidden', marginBottom: '1.5rem' }}>
        <div style={{ padding: '0.75rem 0.9rem', borderBottom: `1px solid ${T.cardBorder}`, backgroundColor: T.surface, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: T.text }}>
              Derived Action Queue
            </h2>
            {queue?.queueNote && (
              <p style={{ margin: '0.2rem 0 0', color: T.muted, fontSize: '0.68rem' }}>{queue.queueNote}</p>
            )}
          </div>
          <span style={{ color: T.muted, fontSize: '0.72rem' }}>
            {loading ? '…' : `${queue?.items.length ?? 0} of ${queue?.total ?? 0} shown`}
          </span>
        </div>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: T.muted, fontSize: '0.88rem' }}>Loading…</div>
        ) : !queue || queue.items.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: T.muted, fontSize: '0.88rem' }}>
            {(data?.partialData || (data?.queryErrors && data.queryErrors.length > 0))
              ? '⚠️ No critical actions in currently available sources. Some sources returned errors — queue may be incomplete.'
              : data?.unavailableSources && data.unavailableSources.length > 0
              ? '⚠️ No critical actions in available sources. Some sources are not yet active — see notice above.'
              : '✅ No critical actions required. Platform appears to be operating normally.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.cardBorder}` }}>
                  {['Severity', 'Action', 'Affected Entity', 'Age', ''].map((h) => (
                    <th key={h} style={{ padding: '0.65rem 0.9rem', textAlign: 'left', color: T.muted, fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queue.items.map((item) => (
                  <ActionQueueRow key={item.id} item={item} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick navigation */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
        {[
          { label: 'Companies Approval Queue', href: '/super-admin/companies/approvals', icon: '✅' },
          { label: 'Active Operations',        href: '/super-admin/operations/active-jobs', icon: '→' },
          { label: 'Compliance Documents',     href: '/super-admin/compliance/documents', icon: '📄' },
          { label: 'Finance — Invoices',        href: '/super-admin/finance/invoices', icon: '£' },
          { label: 'Support Tickets',          href: '/super-admin/support/tickets', icon: '?' },
          { label: 'Platform Health',          href: '/super-admin/health', icon: '🩺' },
          { label: 'Audit Logs',               href: '/super-admin/settings/audit-logs', icon: '📚' },
          { label: 'Feature Flags',            href: '/super-admin/settings/feature-flags', icon: '🚩' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.6rem',
              backgroundColor: T.cardBg, border: `1px solid ${T.cardBorder}`,
              borderRadius: '10px', padding: '0.75rem 1rem',
              color: T.text, fontSize: '0.82rem', fontWeight: 600,
              textDecoration: 'none', transition: 'border-color 0.15s',
            }}
          >
            <span style={{ fontSize: '1rem' }}>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function SuperAdminDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <CommandCentre />
    </ProtectedRoute>
  );
}
