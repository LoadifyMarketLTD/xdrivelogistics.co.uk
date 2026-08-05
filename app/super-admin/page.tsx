'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../components/ProtectedRoute';
import {
  ActionButton,
  AlertBanner,
  PageFrame,
  PageHeader,
  Panel,
  workspaceTheme,
} from '../components/workspace/WorkspaceUI';
import { getAuthHeader } from './_lib/getAuthHeader';

type AttentionIndicator = {
  count?: number;
  amountGbp?: number;
  label: string;
  severity: 'ok' | 'caution' | 'warning' | 'critical';
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

type CommandCentreData = {
  environment: 'PRODUCTION' | 'STAGING' | 'DEVELOPMENT';
  refreshedAt: string;
  attentionIndicators: {
    p0p1Incidents: AttentionIndicator;
    jobsAtRisk: AttentionIndicator;
    blockedAccounts: AttentionIndicator;
    financialExposure: AttentionIndicator;
    degradedServices: AttentionIndicator;
  };
  actionQueue: {
    total: number;
    p0: number;
    p1: number;
    p2: number;
    items: ActionQueueItem[];
  };
};

const SEVERITY_BG: Record<string, string> = {
  ok: '#16a34a',
  caution: '#d97706',
  warning: '#ea580c',
  critical: '#dc2626',
};

const SEVERITY_CHIP: Record<string, { bg: string; color: string }> = {
  P0: { bg: '#fef2f2', color: '#dc2626' },
  P1: { bg: '#fff7ed', color: '#ea580c' },
  P2: { bg: '#fffbeb', color: '#d97706' },
};

const ENV_STYLE: Record<string, { bg: string; color: string }> = {
  PRODUCTION: { bg: '#dc2626', color: '#fff' },
  STAGING: { bg: '#d97706', color: '#fff' },
  DEVELOPMENT: { bg: '#2563eb', color: '#fff' },
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

const formatAge = (minutes: number): string => {
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`;
  return `${Math.floor(minutes / (24 * 60))}d ago`;
};

export default function CommandCentrePage() {
  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <CommandCentreContent />
    </ProtectedRoute>
  );
}

function CommandCentreContent() {
  const router = useRouter();
  const [data, setData] = useState<CommandCentreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const auth = await getAuthHeader();
    if (!auth) {
      setError('Session expired. Please sign in again.');
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/super-admin/command-centre', {
        headers: { Authorization: auth },
      });
      const json = (await res.json().catch(() => null)) as (CommandCentreData & { error?: string }) | null;
      if (!res.ok) throw new Error(json?.error ?? 'Could not load Command Centre.');
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load Command Centre.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const id = setInterval(() => { void load(); }, 60000);
    return () => clearInterval(id);
  }, [load]);

  const env = data?.environment ?? 'DEVELOPMENT';
  const envStyle = ENV_STYLE[env] ?? ENV_STYLE.DEVELOPMENT;
  const indicators = data?.attentionIndicators;
  const queue = data?.actionQueue;

  return (
    <PageFrame>
      {/* Environment banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <span style={{ background: envStyle.bg, color: envStyle.color, fontWeight: 900, fontSize: '0.7rem', letterSpacing: '0.08em', padding: '0.25rem 0.6rem', borderRadius: 5 }}>
          {env}
        </span>
        {data?.refreshedAt && (
          <span style={{ color: workspaceTheme.muted, fontSize: '0.72rem' }}>
            Last updated: {formatTime(data.refreshedAt)}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <ActionButton tone="secondary" onClick={() => router.push('/super-admin/health')}>Platform Health</ActionButton>
        <ActionButton tone="secondary" onClick={() => void load()}>Refresh</ActionButton>
      </div>

      <PageHeader
        eyebrow="XDrive Platform"
        title="Operations Control Tower"
        description="Command centre for the entire platform. See → Understand → Decide → Act."
        actions={<>
          <ActionButton tone="warning" onClick={() => router.push('/super-admin/companies/approvals')}>
            Review approvals
          </ActionButton>
          <ActionButton tone="primary" onClick={() => router.push('/super-admin/operations/active-jobs')}>
            Live operations
          </ActionButton>
        </>}
      />

      {error && <AlertBanner tone="danger">{error}</AlertBanner>}

      {/* 5 Attention Indicators */}
      {env !== 'PRODUCTION' && (
        <AlertBanner tone="warning">
          You are operating in <strong>{env}</strong> environment. Changes made here do not affect production data.
        </AlertBanner>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {indicators ? (
          Object.values(indicators).map((ind: AttentionIndicator) => (
            <div key={ind.label} style={{ border: `1px solid ${workspaceTheme.border}`, borderTop: `3px solid ${SEVERITY_BG[ind.severity]}`, borderRadius: 10, background: workspaceTheme.surfaceSoft, padding: '0.85rem 0.9rem' }}>
              <div style={{ color: SEVERITY_BG[ind.severity], fontSize: '1.55rem', fontWeight: 900, lineHeight: 1 }}>
                {ind.amountGbp !== undefined ? `£${ind.amountGbp.toFixed(0)}` : (ind.count ?? 0)}
              </div>
              <div style={{ color: workspaceTheme.muted, fontSize: '0.7rem', fontWeight: 750, marginTop: '0.3rem' }}>{ind.label}</div>
            </div>
          ))
        ) : (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ border: `1px solid ${workspaceTheme.border}`, borderRadius: 10, background: workspaceTheme.surfaceSoft, padding: '0.85rem 0.9rem', opacity: 0.4, height: 72 }} />
          ))
        )}
      </div>

      {/* Critical Action Queue */}
      <Panel
        title={`Critical Action Queue${queue ? ` · ${queue.total} items` : ''}`}
        description={queue ? `P0: ${queue.p0} · P1: ${queue.p1} · P2: ${queue.p2}` : 'Loading…'}
        actions={<ActionButton tone="secondary" onClick={() => void load()}>Refresh queue</ActionButton>}
      >
        {loading && !data && (
          <div style={{ color: workspaceTheme.muted, fontSize: '0.82rem', padding: '1.5rem', textAlign: 'center' }}>Loading action queue…</div>
        )}
        {!loading && (!queue?.items?.length) && (
          <div style={{ color: workspaceTheme.muted, fontSize: '0.82rem', padding: '1.5rem', textAlign: 'center' }}>
            No critical actions required. Platform is operating normally.
          </div>
        )}
        {(queue?.items ?? []).map((item) => {
          const chip = SEVERITY_CHIP[item.severity] ?? SEVERITY_CHIP.P2;
          return (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              onClick={() => router.push(item.href)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') router.push(item.href); }}
              style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.7rem 0.5rem', borderBottom: `1px solid ${workspaceTheme.border}`, cursor: 'pointer' }}
            >
              <span style={{ background: chip.bg, color: chip.color, fontWeight: 900, fontSize: '0.65rem', padding: '0.2rem 0.45rem', borderRadius: 4, whiteSpace: 'nowrap', minWidth: 28, textAlign: 'center', marginTop: 2 }}>
                {item.severity}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 750, fontSize: '0.83rem', color: workspaceTheme.text }}>{item.title}</div>
                <div style={{ color: workspaceTheme.muted, fontSize: '0.74rem', marginTop: 1 }}>{item.description}</div>
                <div style={{ color: workspaceTheme.muted, fontSize: '0.68rem', marginTop: 2 }}>
                  {item.entityType.toUpperCase()} · {item.entityName}
                </div>
              </div>
              <div style={{ color: workspaceTheme.muted, fontSize: '0.68rem', whiteSpace: 'nowrap', marginTop: 2 }}>
                {formatAge(item.ageMinutes)}
              </div>
              <span style={{ color: workspaceTheme.muted, fontSize: '0.85rem' }}>→</span>
            </div>
          );
        })}
      </Panel>

      {/* Quick Access Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
        {[
          { title: 'Live Operations', desc: 'All active jobs, allocations, PODs', href: '/super-admin/operations/active-jobs', color: workspaceTheme.green },
          { title: 'Marketplace', desc: 'Exchange jobs, bids, carrier behaviour', href: '/super-admin/marketplace', color: workspaceTheme.blue },
          { title: 'Companies', desc: 'Approvals, verification, suspension', href: '/super-admin/companies', color: workspaceTheme.navy },
          { title: 'Compliance & Risk', desc: 'Documents, fraud, operator licences', href: '/super-admin/compliance/documents', color: workspaceTheme.red },
          { title: 'Finance', desc: 'Invoices, payments, disputes', href: '/super-admin/finance/invoices', color: workspaceTheme.orange },
          { title: 'Support & Cases', desc: 'Tickets, complaints, GDPR requests', href: '/super-admin/support/tickets', color: workspaceTheme.purple },
          { title: 'Security & Audit', desc: 'Audit log, admin access, sessions', href: '/super-admin/settings/audit-logs', color: '#64748b' },
          { title: 'Platform Health', desc: 'Services, integrations, webhooks', href: '/super-admin/health', color: '#0891b2' },
        ].map((card) => (
          <button
            key={card.href}
            type="button"
            onClick={() => router.push(card.href)}
            style={{ border: `1px solid ${workspaceTheme.border}`, borderLeft: `3px solid ${card.color}`, borderRadius: 10, background: workspaceTheme.surfaceSoft, padding: '0.9rem 1rem', textAlign: 'left', cursor: 'pointer' }}
          >
            <div style={{ fontWeight: 800, fontSize: '0.88rem', color: workspaceTheme.text }}>{card.title}</div>
            <div style={{ color: workspaceTheme.muted, fontSize: '0.72rem', marginTop: 3 }}>{card.desc}</div>
          </button>
        ))}
      </div>
    </PageFrame>
  );
}
