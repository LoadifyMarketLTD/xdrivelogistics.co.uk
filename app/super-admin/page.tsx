'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../components/ProtectedRoute';
import { supabase } from '../../lib/supabaseClient';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  ExchangeKpiStrip,
  KpiCard,
  KpiGrid,
  PageFrame,
  PageHeader,
  Panel,
  StatusBadge,
  TwoColumn,
} from '../components/workspace/WorkspaceUI';

type PlatformOverview = {
  refreshedAt: string;
  partial: boolean;
  metrics: {
    users: number | null;
    companies: number | null;
    activeCompanies: number | null;
    drivers: number | null;
    activeJobs: number | null;
    marketplaceLoads: number | null;
  };
};

type AttentionIndicator = {
  count?: number | null;
  amountGbp?: number;
  label: string;
  severity: 'critical' | 'warning' | 'caution' | 'ok' | 'unknown';
  note?: string;
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

type CommandCentre = {
  environment: 'PRODUCTION' | 'STAGING' | 'DEVELOPMENT';
  refreshedAt: string;
  partialData?: boolean;
  unavailableSources?: string[];
  attentionIndicators: {
    p0p1Incidents: AttentionIndicator;
    jobsAtRisk: AttentionIndicator;
    blockedAccounts: AttentionIndicator;
    financialExposure: AttentionIndicator;
    degradedServices: AttentionIndicator;
  };
  actionQueue: {
    derived: boolean;
    total: number;
    p0: number;
    p1: number;
    p2: number;
    items: ActionQueueItem[];
  };
};

const severityTone = (severity: AttentionIndicator['severity']) => {
  if (severity === 'critical') return 'red' as const;
  if (severity === 'warning' || severity === 'caution') return 'orange' as const;
  if (severity === 'ok') return 'green' as const;
  return 'navy' as const;
};

const queueTone = (severity: ActionQueueItem['severity']) =>
  severity === 'P0' ? 'red' as const : severity === 'P1' ? 'orange' as const : 'blue' as const;

const metric = (value: number | null | undefined) => value == null ? '—' : value;

const formatAge = (minutes: number) => {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
};

function PlatformOwnerDashboard() {
  const router = useRouter();
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [command, setCommand] = useState<CommandCentre | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setError('Your session has expired. Please sign in again.');
      setLoading(false);
      return;
    }

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [overviewResponse, commandResponse] = await Promise.all([
        fetch('/api/super-admin/platform-overview', { headers }),
        fetch('/api/super-admin/command-centre', { headers }),
      ]);

      const overviewPayload = await overviewResponse.json().catch(() => null) as (PlatformOverview & { error?: string }) | null;
      const commandPayload = await commandResponse.json().catch(() => null) as (CommandCentre & { error?: string }) | null;

      if (!overviewResponse.ok || !commandResponse.ok || !overviewPayload || !commandPayload) {
        setError('Some platform data could not be loaded. Refresh the dashboard or review Platform Health.');
      }
      if (overviewResponse.ok && overviewPayload) setOverview(overviewPayload);
      if (commandResponse.ok && commandPayload) setCommand(commandPayload);
    } catch {
      setError('Platform data could not be loaded. Refresh the dashboard or review Platform Health.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const attention = command?.attentionIndicators;
  const queue = command?.actionQueue;
  const platformMetrics = overview?.metrics;
  const partial = Boolean(overview?.partial || command?.partialData || command?.unavailableSources?.length);

  const attentionRows = useMemo(() => {
    if (!attention) return [];
    return [
      attention.p0p1Incidents,
      attention.jobsAtRisk,
      attention.blockedAccounts,
      attention.financialExposure,
      attention.degradedServices,
    ];
  }, [attention]);

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Platform Owner · Global control"
        title="Platform Owner Dashboard"
        description="Global platform activity, organisations, users, marketplace operations, risk, compliance and administration in one owner-only command surface."
        actions={
          <>
            <ActionButton tone="secondary" onClick={() => router.push('/super-admin/companies/approvals')}>Approvals</ActionButton>
            <ActionButton tone="primary" disabled={loading} onClick={() => void load()}>{loading ? 'Refreshing…' : 'Refresh'}</ActionButton>
          </>
        }
      />

      {error && <AlertBanner>{error}</AlertBanner>}
      {partial && !error && (
        <AlertBanner tone="info">Some optional platform sources are currently unavailable. Available metrics remain live; unavailable values are shown as —.</AlertBanner>
      )}

      <ExchangeKpiStrip>
        <KpiCard label="Users" value={loading ? '…' : metric(platformMetrics?.users)} detail="Registered platform accounts" tone="blue" onClick={() => router.push('/super-admin/users')} />
        <KpiCard label="Organisations" value={loading ? '…' : metric(platformMetrics?.companies)} detail={platformMetrics?.activeCompanies == null ? 'Company register' : `${platformMetrics.activeCompanies} active`} tone="navy" onClick={() => router.push('/super-admin/companies')} />
        <KpiCard label="Drivers" value={loading ? '…' : metric(platformMetrics?.drivers)} detail="Driver network" tone="green" onClick={() => router.push('/super-admin/drivers')} />
        <KpiCard label="Active jobs" value={loading ? '…' : metric(platformMetrics?.activeJobs)} detail="Transport execution live now" tone="purple" onClick={() => router.push('/super-admin/operations/active-jobs')} />
        <KpiCard label="Marketplace loads" value={loading ? '…' : metric(platformMetrics?.marketplaceLoads)} detail="Posted and not awarded" tone="orange" onClick={() => router.push('/super-admin/marketplace')} />
        <KpiCard label="Critical actions" value={loading ? '…' : metric(attention?.p0p1Incidents.count)} detail={queue ? `${queue.p0} P0 · ${queue.p1} P1` : 'Owner intervention queue'} tone={severityTone(attention?.p0p1Incidents.severity ?? 'unknown')} />
      </ExchangeKpiStrip>

      <TwoColumn>
        <Panel
          title="Owner action queue"
          description="The highest-risk platform items are placed before reporting and navigation."
          actions={<ActionButton tone="secondary" onClick={() => router.push('/super-admin/operations')}>Operations</ActionButton>}
        >
          <DataTable
            columns={['Priority', 'Action', 'Affected entity', 'Age', 'Review']}
            rows={(queue?.items ?? []).slice(0, 12).map((item) => [
              <StatusBadge key="priority" value={item.severity} tone={queueTone(item.severity)} />,
              <span key="action"><strong style={{ display: 'block' }}>{item.title}</strong><small style={{ color: '#64748b' }}>{item.description}</small></span>,
              <span key="entity"><strong style={{ display: 'block' }}>{item.entityName}</strong><small style={{ color: '#64748b', textTransform: 'capitalize' }}>{item.entityType}</small></span>,
              formatAge(item.ageMinutes),
              <ActionButton key="review" tone={item.severity === 'P0' ? 'danger' : 'secondary'} onClick={() => router.push(item.href)}>Review</ActionButton>,
            ])}
            empty={<EmptyState compact title={loading ? 'Loading owner queue…' : 'No critical actions'} description="High-risk operational, compliance and finance items will appear here." />}
          />
        </Panel>

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <Panel title="Platform risk signals" description="Cross-platform conditions that need owner awareness.">
            <KpiGrid>
              {attentionRows.map((indicator) => (
                <KpiCard
                  key={indicator.label}
                  label={indicator.label}
                  value={indicator.count == null ? (typeof indicator.amountGbp === 'number' ? `£${indicator.amountGbp.toLocaleString('en-GB')}` : '—') : indicator.count}
                  detail={indicator.note ?? indicator.severity}
                  tone={severityTone(indicator.severity)}
                />
              ))}
            </KpiGrid>
          </Panel>

          <Panel title="Administration actions" description="Owner-only platform controls.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '0.45rem' }}>
              {[
                ['Approve companies', '/super-admin/companies/approvals'],
                ['Manage users', '/super-admin/users'],
                ['Marketplace', '/super-admin/marketplace'],
                ['Finance', '/super-admin/finance/invoices'],
                ['Compliance', '/super-admin/compliance/documents'],
                ['Audit logs', '/super-admin/settings/audit-logs'],
              ].map(([label, href]) => (
                <button key={href} onClick={() => router.push(href)} style={{ border: '1px solid #dbe3ec', borderRadius: '7px', background: '#fff', color: '#0B2F6B', padding: '0.55rem', fontSize: '0.72rem', fontWeight: 750, cursor: 'pointer', textAlign: 'left' }}>{label}</button>
              ))}
            </div>
          </Panel>
        </div>
      </TwoColumn>

      <TwoColumn>
        <Panel title="Marketplace & operations" description="Global execution controls — not a carrier fleet dashboard.">
          <div style={{ display: 'grid', gap: '0.45rem' }}>
            {[
              ['Active operations', metric(platformMetrics?.activeJobs), '/super-admin/operations/active-jobs'],
              ['Marketplace loads', metric(platformMetrics?.marketplaceLoads), '/super-admin/marketplace'],
              ['Jobs at risk', metric(attention?.jobsAtRisk.count), '/super-admin/operations/active-jobs'],
              ['Blocked accounts', metric(attention?.blockedAccounts.count), '/super-admin/companies'],
            ].map(([label, value, href]) => (
              <button key={String(label)} onClick={() => router.push(String(href))} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '7px', background: '#f8fafc', padding: '0.6rem 0.7rem', color: '#334155', fontSize: '0.74rem', cursor: 'pointer' }}>
                <span>{label}</span><strong style={{ color: '#0B2F6B' }}>{String(value)}</strong>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Platform governance" description="Compliance, finance, support and system oversight.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '0.45rem' }}>
            {[
              ['Compliance documents', '/super-admin/compliance/documents'],
              ['Fraud & risk', '/super-admin/compliance/fraud-cases'],
              ['Invoices', '/super-admin/finance/invoices'],
              ['Support tickets', '/super-admin/support/tickets'],
              ['Platform health', '/super-admin/health'],
              ['Feature flags', '/super-admin/settings/feature-flags'],
            ].map(([label, href]) => (
              <button key={href} onClick={() => router.push(href)} style={{ border: '1px solid #dbe3ec', borderRadius: '7px', background: '#fff', color: '#0B2F6B', padding: '0.55rem', fontSize: '0.72rem', fontWeight: 750, cursor: 'pointer', textAlign: 'left' }}>{label}</button>
            ))}
          </div>
        </Panel>
      </TwoColumn>
    </PageFrame>
  );
}

export default function SuperAdminDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <PlatformOwnerDashboard />
    </ProtectedRoute>
  );
}
