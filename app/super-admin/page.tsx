'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutDashboard, RefreshCw } from 'lucide-react';
import ProtectedRoute from '../components/ProtectedRoute';
import { getAuthHeader } from './_lib/getAuthHeader';
import SuperAdminOperationalMap, {
  type OperationalDriverPin,
  type OperationalJobPin,
} from './_components/SuperAdminOperationalMap';
import {
  SuperAdminDataGrid,
  SuperAdminMetricCard,
  SuperAdminMetricGrid,
  SuperAdminNotice,
  SuperAdminPage,
  SuperAdminPageHeader,
  SuperAdminSectionCard,
  SuperAdminStatusBadge,
  SuperAdminUnavailableState,
  type EnterpriseTone,
  type SuperAdminDataColumn,
} from './_components/SuperAdminEnterprisePrimitives';
import styles from './CommandCentreV3.module.css';

type Severity = 'critical' | 'warning' | 'caution' | 'ok' | 'unknown';
type AttentionIndicator = { count: number | null; label: string; severity: Severity; note?: string };
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
  partial?: boolean;
  queueNote?: string;
  total: number | null;
  p0: number | null;
  p1: number | null;
  p2: number | null;
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
  refreshedAt?: string;
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

type OperationsCockpitPayload = {
  refreshedAt: string;
  definitions: Record<string, string>;
  kpis: {
    activeJobs: number;
    driversOnline: number;
    fleetHealth: number | null;
    lateDeliveries: number;
    revenueToday: number | null;
    urgentRequests: number;
    currency: string | null;
    mixedCurrency: boolean;
  };
  map: {
    drivers: OperationalDriverPin[];
    jobs: OperationalJobPin[];
    routes: OperationalJobPin[];
    driverLocationSources: string[];
    trafficEtaSource: string;
    providerCallsTriggered: boolean;
  };
};

type PrimaryKpi = {
  label: string;
  value: string;
  note: string;
  tone: EnterpriseTone;
  testId: 'kpi-loading' | 'kpi-ready' | 'kpi-unavailable';
};

const REQUEST_TIMEOUT_MS = 12_000;
const PRIMARY_KPI_LABELS = [
  'Active Jobs',
  'Jobs at Risk',
  'Drivers Online',
  'Fleet readiness',
  'Compliance review',
  'Outstanding invoices',
  'Active companies',
  'Critical actions',
] as const;

function severityTone(severity: Severity): EnterpriseTone {
  if (severity === 'critical') return 'danger';
  if (severity === 'warning' || severity === 'caution') return 'warning';
  if (severity === 'ok') return 'success';
  return 'unavailable';
}

function fmtAge(minutes: number) {
  const abs = Math.abs(minutes);
  const format = (value: number) => {
    if (value < 60) return `${value}m`;
    const hours = Math.floor(value / 60);
    const mins = value % 60;
    return mins ? `${hours}h ${mins}m` : `${hours}h`;
  };
  return minutes < 0 ? `in ${format(abs)}` : `${format(abs)} ago`;
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
  const [operations, setOperations] = useState<OperationsCockpitPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [operationsError, setOperationsError] = useState<string | null>(null);
  const [refreshCompletedAt, setRefreshCompletedAt] = useState<string | null>(null);
  const refreshGeneration = useRef(0);

  const load = useCallback(async () => {
    const generation = ++refreshGeneration.current;
    setLoading(true);
    setPageError(null);
    setCommandError(null);
    setStatsError(null);
    setOperationsError(null);
    setRefreshCompletedAt(null);
    setData(null);
    setStats(null);
    setOperations(null);

    try {
      const auth = await getAuthHeader();
      if (!auth) {
        if (generation !== refreshGeneration.current) return;
        setPageError('Session expired. Please sign in again.');
        return;
      }

      const headers = { Authorization: auth };
      const [commandResult, statsResult, operationsResult] = await Promise.allSettled([
        fetchJsonWithTimeout<CommandCentrePayload>('/api/super-admin/command-centre', headers),
        fetchJsonWithTimeout<PlatformStats>('/api/super-admin/stats', headers),
        fetchJsonWithTimeout<OperationsCockpitPayload>('/api/super-admin/operations-cockpit', headers),
      ]);

      if (generation !== refreshGeneration.current) return;
      if (commandResult.status === 'fulfilled') setData(commandResult.value);
      else setCommandError(commandResult.reason instanceof Error ? commandResult.reason.message : 'Command Centre data is unavailable.');
      if (statsResult.status === 'fulfilled') setStats(statsResult.value);
      else setStatsError(statsResult.reason instanceof Error ? statsResult.reason.message : 'Platform summary data is unavailable.');
      if (operationsResult.status === 'fulfilled') setOperations(operationsResult.value);
      else setOperationsError(operationsResult.reason instanceof Error ? operationsResult.reason.message : 'Operations data is unavailable.');
      setRefreshCompletedAt(new Date().toISOString());
    } catch {
      if (generation !== refreshGeneration.current) return;
      setPageError('Command Centre refresh failed before data could be verified. Please retry.');
    } finally {
      if (generation === refreshGeneration.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => { refreshGeneration.current += 1; };
  }, [load]);

  const indicators = data?.attentionIndicators;
  const queue = data?.actionQueue;
  const commandPartial = Boolean(
    data?.partialData || data?.queryErrors?.length || data?.unavailableSources?.length || queue?.partial,
  );

  const unavailableKpi = (label: string, note: string): PrimaryKpi => ({
    label,
    value: '—',
    note,
    tone: 'unavailable',
    testId: 'kpi-unavailable',
  });

  const loadingKpis: PrimaryKpi[] = PRIMARY_KPI_LABELS.map((label) => ({
    label,
    value: '—',
    note: 'Loading verified source…',
    tone: 'neutral',
    testId: 'kpi-loading',
  }));  const primaryKpis: PrimaryKpi[] = loading ? loadingKpis : [
    operations
      ? { label: 'Active Jobs', value: operations.kpis.activeJobs.toLocaleString(), note: operations.definitions.activeJobs ?? 'Open operational jobs.', tone: 'info', testId: 'kpi-ready' }
      : unavailableKpi('Active Jobs', operationsError ?? 'Operations source unavailable.'),
    indicators
      ? { label: 'Jobs at Risk', value: indicators.jobsAtRisk.count === null ? '—' : indicators.jobsAtRisk.count.toLocaleString(), note: indicators.jobsAtRisk.note ?? 'Stale or unassigned operational jobs.', tone: severityTone(indicators.jobsAtRisk.severity), testId: indicators.jobsAtRisk.count === null ? 'kpi-unavailable' : 'kpi-ready' }
      : unavailableKpi('Jobs at Risk', commandError ?? 'Command Centre source unavailable.'),
    operations
      ? { label: 'Drivers Online', value: operations.kpis.driversOnline.toLocaleString(), note: operations.definitions.driversOnline ?? 'Verified availability/tracking presence.', tone: 'success', testId: 'kpi-ready' }
      : unavailableKpi('Drivers Online', operationsError ?? 'Operations source unavailable.'),
    operations
      ? { label: 'Fleet readiness', value: operations.kpis.fleetHealth === null ? '—' : `${operations.kpis.fleetHealth}%`, note: operations.definitions.fleetHealth ?? 'Operational vehicle readiness.', tone: operations.kpis.fleetHealth === null ? 'unavailable' : 'success', testId: operations.kpis.fleetHealth === null ? 'kpi-unavailable' : 'kpi-ready' }
      : unavailableKpi('Fleet readiness', operationsError ?? 'Operations source unavailable.'),    stats
      ? { label: 'Compliance review', value: stats.compliancePending.toLocaleString(), note: 'Driver and vehicle documents pending or rejected.', tone: stats.compliancePending > 0 ? 'warning' : 'success', testId: 'kpi-ready' }
      : unavailableKpi('Compliance review', statsError ?? 'Platform summary unavailable.'),
    stats
      ? { label: 'Outstanding invoices', value: stats.invoicesUnpaid.toLocaleString(), note: `${stats.invoicesTotal.toLocaleString()} invoices in the canonical register.`, tone: stats.invoicesUnpaid > 0 ? 'warning' : 'success', testId: 'kpi-ready' }
      : unavailableKpi('Outstanding invoices', statsError ?? 'Platform summary unavailable.'),
    stats
      ? { label: 'Active companies', value: stats.companiesActive.toLocaleString(), note: `${stats.companiesTotal.toLocaleString()} registered companies.`, tone: 'info', testId: 'kpi-ready' }
      : unavailableKpi('Active companies', statsError ?? 'Platform summary unavailable.'),
    indicators
      ? { label: 'Critical actions', value: indicators.p0p1Incidents.count === null ? '—' : indicators.p0p1Incidents.count.toLocaleString(), note: indicators.p0p1Incidents.note ?? 'P0/P1 actions requiring owner attention.', tone: severityTone(indicators.p0p1Incidents.severity), testId: indicators.p0p1Incidents.count === null ? 'kpi-unavailable' : 'kpi-ready' }
      : unavailableKpi('Critical actions', commandError ?? 'Command Centre source unavailable.'),
  ];

  const attentionList = indicators
    ? [indicators.p0p1Incidents, indicators.jobsAtRisk, indicators.blockedAccounts, indicators.financialExposure, indicators.degradedServices]
    : [];
  const driverColumns: SuperAdminDataColumn<OperationalDriverPin>[] = [
    { key: 'driver', label: 'Driver', render: (driver) => driver.name },
    { key: 'status', label: 'Status', render: (driver) => <SuperAdminStatusBadge label={driver.status} tone={driver.status === 'offline' ? 'danger' : 'success'} /> },
    { key: 'vehicle', label: 'Vehicle', render: (driver) => driver.vehicle ? `${driver.vehicle.registration} · ${driver.vehicle.label}` : '—' },
    { key: 'source', label: 'Location source', render: (driver) => driver.location?.source === 'availability_presence' ? 'Availability presence' : driver.location?.source ?? '—' },
    { key: 'lastFix', label: 'Last fix', render: (driver) => driver.location?.recorded_at ? new Date(driver.location.recorded_at).toLocaleString('en-GB') : '—' },
  ];

  const queueColumns: SuperAdminDataColumn<ActionQueueItem>[] = [
    { key: 'severity', label: 'Severity', render: (item) => <SuperAdminStatusBadge label={item.severity} tone={item.severity === 'P0' ? 'danger' : item.severity === 'P1' ? 'warning' : 'info'} /> },
    { key: 'action', label: 'Action', render: (item) => <><strong>{item.title}</strong><div>{item.description}</div></> },
    { key: 'entity', label: 'Affected entity', render: (item) => item.entityName },
    { key: 'age', label: 'Age', render: (item) => fmtAge(item.ageMinutes) },
    { key: 'review', label: '', render: (item) => <Link href={item.href}>Review →</Link> },
  ];

  const refreshMeta = refreshCompletedAt
    ? `${commandError || statsError || operationsError || commandPartial ? 'Refresh incomplete' : 'Refresh completed'} ${new Date(refreshCompletedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`
    : undefined;
  return (
    <SuperAdminPage>
      <SuperAdminPageHeader
        eyebrow="Command · Platform Control"
        title="Command Centre"
        description="Cross-platform operations, risk, compliance and financial attention from canonical XDrive sources."
        icon={<LayoutDashboard size={20} aria-hidden="true" />}
        meta={<div className={styles.metaRow}>{data ? <SuperAdminStatusBadge label={data.environment} tone={data.environment === 'PRODUCTION' ? 'danger' : 'info'} /> : null}{refreshMeta ? <span>{refreshMeta}</span> : null}</div>}
        actions={<button type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={15} aria-hidden="true" />{loading ? 'Refreshing…' : 'Refresh'}</button>}
      />

      {pageError ? <SuperAdminUnavailableState title="Command Centre unavailable" description={pageError} /> : null}
      {commandError ? <SuperAdminNotice tone="danger"><strong>Risk and action data unavailable.</strong> {commandError}</SuperAdminNotice> : null}
      {statsError ? <SuperAdminNotice tone="unavailable"><strong>Platform summary unavailable.</strong> {statsError}</SuperAdminNotice> : null}
      {operationsError ? <SuperAdminNotice tone="unavailable"><strong>Live operations unavailable.</strong> {operationsError}</SuperAdminNotice> : null}
      {commandPartial ? <SuperAdminNotice tone="warning">Some Command Centre sources are unavailable. Available records remain visible, but missing sources are never interpreted as zero or healthy.</SuperAdminNotice> : null}

      <section data-contract-surface="command-centre-kpis">
        <div className={styles.sectionHeading}><div><h2>Platform control summary</h2><p>Eight primary signals only. Every value is source-backed or explicitly unavailable.</p></div><Link href="/super-admin/analytics">Full analytics →</Link></div>
        <SuperAdminMetricGrid>
          {primaryKpis.map((kpi) => <div key={kpi.label} className={styles.kpiCell} data-testid={kpi.testId}><SuperAdminMetricCard label={kpi.label} value={kpi.value} note={kpi.note} tone={kpi.tone} /></div>)}
        </SuperAdminMetricGrid>
      </section>

      <SuperAdminSectionCard
        title="Live Operations Map"
        description="Real driver availability/execution positions and active job route coordinates. No provider call is triggered by this view."
        actions={<Link href="/super-admin/operations/fleet-positions">Open Fleet Positions →</Link>}
      >
        {operationsError ? (
          <SuperAdminUnavailableState title="Live map unavailable" description={operationsError} />
        ) : operations && (operations.map.drivers.length > 0 || operations.map.jobs.length > 0) ? (
          <>
            <SuperAdminOperationalMap drivers={operations.map.drivers} jobs={operations.map.jobs} routes={operations.map.routes} />
            {operations.map.drivers.length > 0 ? <div className={styles.mapFallback}><h3>Accessible live-position ledger</h3><SuperAdminDataGrid columns={driverColumns} rows={operations.map.drivers} rowKey={(driver) => driver.id} minWidth={760} /></div> : null}
          </>
        ) : loading ? (
          <div>Loading verified positions…</div>
        ) : (
          <div data-state="empty">No current map-ready driver or job positions are available. No placeholder pins are shown.</div>
        )}
      </SuperAdminSectionCard>

      <div className={styles.sectionHeading}><div><h2>Critical attention</h2><p>Operational, account, finance and platform-health signals requiring owner awareness.</p></div><Link href="/super-admin/action-centre">Open Action Centre →</Link></div>
      <SuperAdminMetricGrid>
        {loading ? [0, 1, 2, 3, 4].map((index) => <SuperAdminMetricCard key={index} label="Loading…" value="—" tone="neutral" />)
          : attentionList.length ? attentionList.map((indicator) => <SuperAdminMetricCard key={indicator.label} label={indicator.label} value={indicator.count === null ? '—' : indicator.count.toLocaleString()} note={indicator.note ?? indicator.severity} tone={severityTone(indicator.severity)} />)
            : ['Critical actions', 'Jobs at risk', 'Blocked accounts', 'Overdue invoices', 'Degraded services'].map((label) => <SuperAdminMetricCard key={label} label={label} value="—" note="Unavailable — not reported as healthy." tone="unavailable" />)}
      </SuperAdminMetricGrid>

      <SuperAdminSectionCard
        title="Operational queue"
        description={queue?.queueNote ?? 'Derived owner action queue from canonical source tables.'}
        actions={queue ? <SuperAdminStatusBadge label={queue.total === null ? 'Partial total' : `${queue.total} total`} tone={commandPartial ? 'warning' : 'info'} /> : undefined}
        flush
      >
        {loading ? (
          <div style={{ padding: 18 }}>Loading verified actions…</div>
        ) : !queue ? (
          <SuperAdminUnavailableState title="Operational queue unavailable" description="No zero or healthy state has been inferred." />
        ) : queue.items.length === 0 ? (
          commandPartial
            ? <SuperAdminNotice tone="warning">No actions were found in the currently available sources. A platform-wide zero has not been established.</SuperAdminNotice>
            : <div data-state="empty" style={{ padding: 18 }}>No critical actions in the verified source set.</div>
        ) : (
          <SuperAdminDataGrid columns={queueColumns} rows={queue.items.slice(0, 12)} rowKey={(item) => item.id} minWidth={820} />
        )}
      </SuperAdminSectionCard>

      <SuperAdminSectionCard title="Operational snapshot" description="Secondary verified operational signals. These do not replace the eight primary Command Centre KPIs.">
        <SuperAdminMetricGrid>
          <SuperAdminMetricCard label="Late deliveries" value={operations ? operations.kpis.lateDeliveries.toLocaleString() : '—'} note={operations?.definitions.lateDeliveries ?? operationsError ?? 'Operations source unavailable.'} tone={operations ? (operations.kpis.lateDeliveries > 0 ? 'warning' : 'success') : 'unavailable'} />
          <SuperAdminMetricCard label="Revenue today" value={operations && operations.kpis.revenueToday !== null && operations.kpis.currency ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: operations.kpis.currency }).format(operations.kpis.revenueToday) : '—'} note={operations?.definitions.revenue ?? (operations?.kpis.mixedCurrency ? 'Mixed currencies — aggregate suppressed.' : operationsError ?? 'Revenue source unavailable.')} tone={operations?.kpis.revenueToday !== null ? 'success' : 'unavailable'} />
          <SuperAdminMetricCard label="Urgent requests" value={operations ? operations.kpis.urgentRequests.toLocaleString() : '—'} note="Open P0/P1 platform cases plus critical support tickets." tone={operations ? (operations.kpis.urgentRequests > 0 ? 'danger' : 'success') : 'unavailable'} />
        </SuperAdminMetricGrid>
      </SuperAdminSectionCard>      <SuperAdminSectionCard title="Quick actions" description="Direct navigation to the highest-value control surfaces. No mutation is triggered from these links.">
        <div className={styles.quickActions}>
          <Link href="/super-admin/operations/jobs">All Jobs <span>→</span></Link>
          <Link href="/super-admin/operations/allocations">Allocations <span>→</span></Link>
          <Link href="/super-admin/compliance/documents">Document Review <span>→</span></Link>
          <Link href="/super-admin/finance/control">Trade Control <span>→</span></Link>
          <Link href="/super-admin/companies">Companies <span>→</span></Link>
          <Link href="/super-admin/support/tickets">Support Tickets <span>→</span></Link>
          <Link href="/super-admin/health">Platform Health <span>→</span></Link>
          <Link href="/super-admin/settings/audit-logs">Audit Logs <span>→</span></Link>
        </div>
      </SuperAdminSectionCard>

      <SuperAdminSectionCard
        title="Administrative activity"
        description="Governance decisions and administrative changes remain in the canonical audit trail."
        actions={<Link href="/super-admin/settings/audit-logs">Open audit trail →</Link>}
      >
        <p style={{ margin: 0 }}>Platform Owner actions remain evidence-backed and auditable. This Command Centre does not impersonate tenant workspaces or bypass existing governance controls.</p>
      </SuperAdminSectionCard>
    </SuperAdminPage>
  );
}

export default function SuperAdminDashboardPage() {
  return <ProtectedRoute allowedRoles={['owner']}><CommandCentre /></ProtectedRoute>;
}
