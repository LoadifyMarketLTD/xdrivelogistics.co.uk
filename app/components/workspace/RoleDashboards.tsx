'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../AuthContext';
import {
  getWorkspaceDefinition,
  hasWorkspaceCapability,
  resolveWorkspaceRole,
  type WorkspaceRole,
} from '../../../lib/workspaceRole';
import {
  getWorkspaceDatasetMetricValue,
  getWorkspaceMetricPresentationStatus,
  useCompanyWorkspaceData,
  type WorkspaceDataState,
} from './useCompanyWorkspaceData';
import {
  ActionCard,
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  FinancialSummaryPanel,
  KpiCard,
  KpiGrid,
  PageFrame,
  PageHeader,
  Panel,
  PermissionDeniedState,
  StatusBadge,
  TwoColumn,
} from './WorkspaceUI';

const activeStatuses = new Set(['awarded', 'allocated', 'accepted', 'on_my_way', 'on_my_way_to_pickup', 'on_site_pickup', 'loaded', 'collected', 'in_transit', 'on_my_way_to_delivery', 'on_site_delivery']);
const terminalStatuses = new Set(['delivered', 'completed', 'cancelled', 'paid']);
const exceptionStatuses = new Set(['cancelled', 'failed', 'exception', 'disputed', 'collection_failed', 'delivery_failed', 'damaged', 'breakdown']);
const money = (value: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
const formatDate = (value: string | null | undefined) => value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set';
const daysUntil = (value: string | null | undefined) => value ? Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000) : null;

type AdminDashboardTarget =
  | 'carrier'
  | 'fleet'
  | 'dispatcher'
  | 'finance'
  | 'compliance'
  | 'viewer'
  | 'blocked';

export type AdminDashboardResolution = {
  target: AdminDashboardTarget;
  blocker: string | null;
  homeHref: string | null;
};

const datasetStatus = (
  data: WorkspaceDataState,
  keys: Array<keyof WorkspaceDataState['datasets']>,
) => getWorkspaceMetricPresentationStatus(keys.map((key) => data.datasets[key]));

const datasetUnavailable = (
  data: WorkspaceDataState,
  keys: Array<keyof WorkspaceDataState['datasets']>,
) => {
  const status = datasetStatus(data, keys);
  return status === 'partial' || status === 'unavailable' || status === 'omitted';
};

const metricValue = (
  data: WorkspaceDataState,
  keys: Array<keyof WorkspaceDataState['datasets']>,
  compute: () => number | string,
) => {
  const status = datasetStatus(data, keys);
  if (status === 'partial') return 'Partial';
  if (status === 'unavailable' || status === 'omitted') return '—';
  return compute();
};

const metricDetail = (
  data: WorkspaceDataState,
  keys: Array<keyof WorkspaceDataState['datasets']>,
  detail: string,
  unavailable = 'Unavailable',
) => {
  const status = datasetStatus(data, keys);
  if (status === 'partial') return 'Partial data unavailable';
  if (status === 'unavailable' || status === 'omitted') return unavailable;
  return detail;
};

const metricTone = (
  data: WorkspaceDataState,
  keys: Array<keyof WorkspaceDataState['datasets']>,
  tone: 'navy' | 'green' | 'orange' | 'purple' | 'red' | 'blue',
) => (datasetUnavailable(data, keys) ? 'navy' : tone);

export function resolveAdminDashboard(role: WorkspaceRole | null | undefined): AdminDashboardResolution {
  if (!role) {
    return {
      target: 'blocked',
      blocker: 'Workspace role context is unavailable, so the /admin dashboard cannot be resolved safely.',
      homeHref: null,
    };
  }

  const definition = getWorkspaceDefinition(role);
  switch (role) {
    case 'company_owner':
    case 'company_admin':
    case 'carrier_admin':
      return hasWorkspaceCapability(role, 'jobs.view') && definition.homeHref === '/admin'
        ? { target: 'carrier', blocker: null, homeHref: definition.homeHref }
        : { target: 'blocked', blocker: `${role} is missing the approved /admin carrier dashboard contract.`, homeHref: definition.homeHref };
    case 'fleet_manager':
      return hasWorkspaceCapability(role, 'fleet.positions.view')
        ? { target: 'fleet', blocker: null, homeHref: definition.homeHref }
        : { target: 'blocked', blocker: 'fleet_manager is missing the approved fleet dashboard capability contract.', homeHref: definition.homeHref };
    case 'dispatcher':
      return hasWorkspaceCapability(role, 'jobs.dispatch')
        ? { target: 'dispatcher', blocker: null, homeHref: definition.homeHref }
        : { target: 'blocked', blocker: 'dispatcher is missing the approved operations dashboard capability contract.', homeHref: definition.homeHref };
    case 'finance':
      return hasWorkspaceCapability(role, 'invoices.customer.manage') || hasWorkspaceCapability(role, 'invoices.carrier.manage')
        ? { target: 'finance', blocker: null, homeHref: definition.homeHref }
        : { target: 'blocked', blocker: 'finance is missing the approved finance dashboard capability contract.', homeHref: definition.homeHref };
    case 'compliance':
      return hasWorkspaceCapability(role, 'documents.company.manage') || hasWorkspaceCapability(role, 'documents.verify')
        ? { target: 'compliance', blocker: null, homeHref: definition.homeHref }
        : { target: 'blocked', blocker: 'compliance is missing the approved compliance dashboard capability contract.', homeHref: definition.homeHref };
    case 'viewer':
      return { target: 'viewer', blocker: null, homeHref: definition.homeHref };
    case 'platform_owner':
      return { target: 'blocked', blocker: `platform_owner resolves to ${definition.homeHref}, so it cannot silently receive the carrier /admin dashboard.`, homeHref: definition.homeHref };
    case 'broker':
    case 'customer':
    case 'driver':
    case 'owner_driver':
      return { target: 'blocked', blocker: `${role} resolves to ${definition.homeHref}; entering /admin does not convert it into carrier/company operations.`, homeHref: definition.homeHref };
  }
}

export function CarrierDashboard() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const metrics = useMemo(() => {
    const jobIds = new Set(data.jobs.map((job) => job.id));
    const companyBids = data.bids.filter((bid) => bid.company_id === data.companyId);
    const submittedQuotes = companyBids.filter((bid) => ['submitted', 'pending'].includes(bid.status)).length;
    const won = companyBids.filter((bid) => bid.status === 'accepted').length;
    const unallocated = data.jobs.filter((job) => ['awarded', 'posted'].includes(job.status) && !job.assigned_driver_id).length;
    const active = data.jobs.filter((job) => activeStatuses.has(job.current_status ?? job.status)).length;
    const podPending = data.jobs.filter((job) => ['delivered', 'completed'].includes(job.status) && (job.delivery_photos?.length ?? 0) === 0).length;
    const carrierInvoices = data.invoices.filter((inv) => inv.company_id === data.companyId);
    const overdueInvoices = carrierInvoices.filter((invoice) => invoice.due_date && new Date(invoice.due_date).getTime() < Date.now() && !['paid', 'Paid'].includes(invoice.status) && invoice.payment_status !== 'paid').length;
    const acceptedRevenue = data.bids.filter((bid) => jobIds.has(bid.job_id) && bid.status === 'accepted').reduce((sum, bid) => sum + Number(bid.bid_price_gbp ?? bid.amount ?? 0), 0);
    const invoicedValue = carrierInvoices.filter((inv) => !['draft', 'pending', 'cancelled'].includes(String(inv.status).toLowerCase())).reduce((sum, inv) => sum + Number(inv.amount ?? 0), 0);
    const paidValue = carrierInvoices.filter((inv) => ['paid', 'Paid'].includes(inv.status) || inv.payment_status === 'paid').reduce((sum, inv) => sum + Number(inv.amount ?? 0), 0);
    const exceptionJobs = data.jobs.filter((job) => exceptionStatuses.has(job.current_status ?? job.status));
    const recentQuoteActivity = [...companyBids]
      .filter((bid) => ['submitted', 'accepted', 'rejected'].includes(bid.status))
      .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
      .slice(0, 5);
    return { submittedQuotes, won, unallocated, active, podPending, overdueInvoices, acceptedRevenue, invoicedValue, paidValue, exceptionJobs, recentQuoteActivity };
  }, [data]);
  const complianceAlerts = useMemo(() => (
    data.driverDocuments
      .concat(data.vehicleDocuments)
      .map((doc) => ({
        ...doc,
        daysToExpiry: daysUntil(doc.expiry_date),
      }))
      .filter((doc) => doc.daysToExpiry !== null && doc.daysToExpiry <= 30)
      .sort((a, b) => (a.daysToExpiry ?? 9999) - (b.daysToExpiry ?? 9999))
  ), [data.driverDocuments, data.vehicleDocuments]);

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Carrier operations"
        title="Carrier Dashboard"
        description="Find work, price opportunities, allocate resources and complete transport with a controlled POD-to-invoice workflow."
        actions={<><ActionButton tone="success" onClick={() => router.push('/admin/marketplace')}>Find Loads</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/admin/diary')}>Open Diary</ActionButton></>}
      />
      {data.error && <AlertBanner>{data.error}</AlertBanner>}
      <KpiGrid>
        <KpiCard label="Quotes submitted" value={getWorkspaceDatasetMetricValue(data.datasets.bids, (rows) => rows.filter((bid) => bid.company_id === data.companyId && ['submitted', 'pending'].includes(bid.status)).length)} detail={metricDetail(data, ['bids'], 'Awaiting a commercial decision')} onClick={() => router.push('/admin/quotes')} />
        <KpiCard label="Won work" value={getWorkspaceDatasetMetricValue(data.datasets.bids, (rows) => rows.filter((bid) => bid.company_id === data.companyId && bid.status === 'accepted').length)} detail={metricDetail(data, ['bids'], 'Accepted carrier quotes')} tone={metricTone(data, ['bids'], 'green')} onClick={() => router.push('/admin/bids')} />
        <KpiCard label="Awaiting allocation" value={getWorkspaceDatasetMetricValue(data.datasets.jobs, (rows) => rows.filter((job) => ['awarded', 'posted'].includes(job.status) && !job.assigned_driver_id).length)} detail={metricDetail(data, ['jobs'], 'Jobs requiring driver and vehicle')} tone={metricTone(data, ['jobs'], 'orange')} onClick={() => router.push('/admin/fleet/assignments')} />
        <KpiCard label="Active jobs" value={getWorkspaceDatasetMetricValue(data.datasets.jobs, (rows) => rows.filter((job) => activeStatuses.has(job.current_status ?? job.status)).length)} detail={metricDetail(data, ['jobs'], 'Collections and deliveries in progress')} tone={metricTone(data, ['jobs'], 'purple')} onClick={() => router.push('/admin/fleet/active-jobs')} />
        <KpiCard label="POD outstanding" value={getWorkspaceDatasetMetricValue(data.datasets.jobs, (rows) => rows.filter((job) => ['delivered', 'completed'].includes(job.status) && (job.delivery_photos?.length ?? 0) === 0).length)} detail={metricDetail(data, ['jobs'], 'Delivered jobs missing proof')} tone={metricTone(data, ['jobs'], 'red')} onClick={() => router.push('/admin/documents?view=pod')} />
        <KpiCard label="Overdue invoices" value={getWorkspaceDatasetMetricValue(data.datasets.invoices, (rows) => rows.filter((invoice) => invoice.company_id === data.companyId && invoice.due_date && new Date(invoice.due_date).getTime() < Date.now() && !['paid', 'Paid'].includes(invoice.status) && invoice.payment_status !== 'paid').length)} detail={metricDetail(data, ['invoices'], 'Past due date')} tone={metricTone(data, ['invoices'], metrics.overdueInvoices ? 'red' : 'navy')} onClick={() => router.push('/admin/invoices')} />
        <KpiCard label="Exceptions" value={getWorkspaceDatasetMetricValue(data.datasets.jobs, (rows) => rows.filter((job) => exceptionStatuses.has(job.current_status ?? job.status)).length)} detail={metricDetail(data, ['jobs'], 'Failed or disputed jobs')} tone={metricTone(data, ['jobs'], metrics.exceptionJobs.length ? 'red' : 'green')} onClick={() => router.push('/admin/incidents')} />
        <KpiCard label="Won work value" value={metricValue(data, ['jobs', 'bids'], () => money(metrics.acceptedRevenue))} detail={metricDetail(data, ['jobs', 'bids'], 'Accepted bid total')} tone="navy" />
      </KpiGrid>

      <TwoColumn>
        <Panel
          title="Jobs requiring attention"
          description="Unallocated, active and POD-pending work is prioritised before general reporting."
          actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/jobs')}>All jobs</ActionButton>}
        >
          <DataTable
            columns={['Route', 'Pickup', 'Vehicle', 'Status', 'Action']}
            rows={data.jobs.filter((job) => !terminalStatuses.has(job.status)).slice(0, 8).map((job) => [
              <strong key="route">{job.pickup_location ?? job.pickup_postcode ?? 'Collection'} → {job.delivery_location ?? job.delivery_postcode ?? 'Delivery'}</strong>,
              formatDate(job.pickup_datetime),
              (job.vehicle_type ?? 'Not specified').replace(/_/g, ' '),
              <StatusBadge key="status" value={job.current_status ?? job.status} />,
              <ActionButton key="action" tone="secondary" onClick={() => router.push(`/admin/jobs/${job.id}`)}>Open</ActionButton>,
            ])}
            empty={<EmptyState title="No jobs need attention" description="Won work and active jobs will appear here." />}
          />
        </Panel>
        <div style={{ display: 'grid', gap: '0.9rem' }}>
          <Panel title="Resource readiness" description="Live capacity from your company roster.">
            <KpiGrid>
              <KpiCard label="Available drivers" value={getWorkspaceDatasetMetricValue(data.datasets.drivers, (rows) => rows.filter((driver) => driver.availability_status === 'available').length)} detail={metricDetail(data, ['drivers'], 'Ready for allocation')} tone={metricTone(data, ['drivers'], 'green')} onClick={() => router.push('/admin/drivers')} />
              <KpiCard label="Busy drivers" value={getWorkspaceDatasetMetricValue(data.datasets.drivers, (rows) => rows.filter((driver) => driver.availability_status === 'busy').length)} detail={metricDetail(data, ['drivers'], 'Assigned or on a job')} tone={metricTone(data, ['drivers'], 'orange')} onClick={() => router.push('/admin/drivers')} />
              <KpiCard label="Total vehicles" value={getWorkspaceDatasetMetricValue(data.datasets.vehicles, (rows) => rows.length)} detail={metricDetail(data, ['vehicles'], 'Company vehicles')} tone="navy" onClick={() => router.push('/admin/vehicles')} />
              <KpiCard label="Unassigned vehicles" value={getWorkspaceDatasetMetricValue(data.datasets.vehicles, (rows) => rows.filter((vehicle) => !vehicle.assigned_driver_id).length)} detail={metricDetail(data, ['vehicles'], 'Ready to assign')} tone={metricTone(data, ['vehicles'], 'blue')} onClick={() => router.push('/admin/vehicles')} />
            </KpiGrid>
          </Panel>
          <Panel title="Commercial shortcuts" description="Fast access to the carrier workflow.">
            <KpiGrid>
              <ActionCard label="Find marketplace loads" description="Available transport work" tone="blue" onClick={() => router.push('/admin/marketplace')} />
              <ActionCard label="Review submitted quotes" description="Carrier pricing workflow" tone="navy" onClick={() => router.push('/admin/quotes')} />
              <ActionCard label="Allocate awarded work" description="Assign driver and vehicle" tone="orange" onClick={() => router.push('/admin/fleet/assignments')} />
              <ActionCard label="Track active jobs" description="Live collections and deliveries" tone="purple" onClick={() => router.push('/admin/fleet/active-jobs')} />
              <ActionCard label="Open invoices" description="Billing and payment status" tone="green" onClick={() => router.push('/admin/invoices')} />
            </KpiGrid>
          </Panel>
          <Panel title="Compliance alerts" description="Documents expiring within 30 days." actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/documents/expiry')}>View all</ActionButton>}>
            {complianceAlerts.slice(0, 4).length > 0 && (
              <KpiGrid>
                {complianceAlerts.slice(0, 4).map((doc) => (
                  <KpiCard
                    key={doc.id}
                    label={doc.doc_type?.replace(/_/g, ' ') ?? 'Document'}
                    value={doc.daysToExpiry && doc.daysToExpiry > 0 ? `${doc.daysToExpiry} days` : 'Expired'}
                    detail={doc.driver_id ? 'Driver document' : 'Vehicle document'}
                    tone={metricTone(data, ['driverDocuments', 'vehicleDocuments'], doc.daysToExpiry !== null && doc.daysToExpiry <= 7 ? 'red' : 'orange')}
                    onClick={() => router.push('/admin/documents/expiry')}
                  />
                ))}
              </KpiGrid>
            )}
            {complianceAlerts.length === 0 && <EmptyState compact title="No expiry alerts" description="No driver or vehicle document expires within 30 days." />}
          </Panel>
        </div>
      </TwoColumn>

      <Panel
        title="Revenue & finance overview"
        description="Financial position based on accepted bids, raised invoices and payment receipts."
        actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/invoices')}>Finance</ActionButton>}
      >
        <FinancialSummaryPanel
          items={[
            { label: 'Won work value', detail: 'Accepted bids total', value: money(metrics.acceptedRevenue), color: '#166534', background: '#f0fdf4' },
            { label: 'Invoiced', detail: 'Raised to customers', value: money(metrics.invoicedValue), color: '#1e40af', background: '#eff6ff' },
            { label: 'Paid', detail: 'Received payments', value: money(metrics.paidValue), color: '#6b21a8', background: '#faf5ff' },
            {
              label: 'Outstanding',
              detail: 'Awaiting payment',
              value: money(Math.max(0, metrics.invoicedValue - metrics.paidValue)),
              color: metrics.invoicedValue - metrics.paidValue > 0 ? '#c2410c' : '#166534',
              background: metrics.invoicedValue - metrics.paidValue > 0 ? '#fff7ed' : '#f0fdf4',
            },
          ]}
        />
      </Panel>

      <Panel
        title="Recent quote activity"
        description="Latest commercial responses from the carrier account."
        actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/quotes')}>All quotes</ActionButton>}
      >
        <DataTable
          columns={['Route', 'Submitted', 'Value', 'Status', 'Action']}
          rows={metrics.recentQuoteActivity.map((bid) => {
            const job = data.jobs.find((item) => item.id === bid.job_id);
            return [
              <strong key="route">{job?.pickup_location ?? job?.pickup_postcode ?? 'Collection'} → {job?.delivery_location ?? job?.delivery_postcode ?? 'Delivery'}</strong>,
              formatDate(bid.created_at),
              money(Number(bid.bid_price_gbp ?? bid.amount ?? 0)),
              <StatusBadge key="status" value={bid.status} />,
              <ActionButton key="action" tone="secondary" onClick={() => router.push('/admin/quotes')}>Open</ActionButton>,
            ];
          })}
          empty={<EmptyState title="No recent quote activity" description="Submitted or accepted quotes will appear here." />}
        />
      </Panel>
    </PageFrame>
  );
}

export function FleetDashboard() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const locations = data.locations;
  const latestLocationByDriver = useMemo(() => {
    const map = new Map<string, (typeof locations)[number]>();
    for (const location of locations) if (!map.has(location.driver_id)) map.set(location.driver_id, location);
    return map;
  }, [locations]);
  const staleDrivers = data.drivers.filter((driver) => {
    const location = latestLocationByDriver.get(driver.id);
    const timestamp = location?.recorded_at ?? location?.updated_at;
    return !timestamp || Date.now() - new Date(timestamp).getTime() > 20 * 60_000;
  }).length;
  const expiring = data.driverDocuments.concat(data.vehicleDocuments).filter((doc) => { const d = daysUntil(doc.expiry_date); return d !== null && d <= 30; }).length;
  const unassignedJobs = data.jobs.filter((job) => ['posted', 'awarded'].includes(job.status) && !job.assigned_driver_id);
  const activeJobs = data.jobs.filter((job) => activeStatuses.has(job.current_status ?? job.status));
  const exceptionJobs = data.jobs.filter((job) => exceptionStatuses.has(job.current_status ?? job.status));

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Fleet operations"
        title="Fleet Dashboard"
        description="Capacity, assignments, live positions, maintenance and compliance—ordered by operational urgency."
        actions={<><ActionButton tone="success" onClick={() => router.push('/admin/fleet/assignments')}>Allocate Work</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/positions')}>Live Positions</ActionButton></>}
      />
      {data.error && <AlertBanner>{data.error}</AlertBanner>}
      <KpiGrid>
        <KpiCard label="Available drivers" value={getWorkspaceDatasetMetricValue(data.datasets.drivers, (rows) => rows.filter((driver) => driver.availability_status === 'available').length)} tone={metricTone(data, ['drivers'], 'green')} detail={metricDetail(data, ['drivers'], 'Ready for allocation')} onClick={() => router.push('/admin/drivers')} />
        <KpiCard label="Busy drivers" value={getWorkspaceDatasetMetricValue(data.datasets.drivers, (rows) => rows.filter((driver) => driver.availability_status === 'busy').length)} tone={metricTone(data, ['drivers'], 'purple')} detail={metricDetail(data, ['drivers'], 'Assigned or on a job')} onClick={() => router.push('/admin/drivers')} />
        <KpiCard label="Offline drivers" value={getWorkspaceDatasetMetricValue(data.datasets.drivers, (rows) => rows.filter((driver) => !driver.availability_status || driver.availability_status === 'offline').length)} tone="navy" detail={metricDetail(data, ['drivers'], 'Not available now')} onClick={() => router.push('/admin/driver-availability')} />
        <KpiCard label="Available vehicles" value={getWorkspaceDatasetMetricValue(data.datasets.vehicles, (rows) => rows.filter((vehicle) => !vehicle.assigned_driver_id).length)} tone={metricTone(data, ['vehicles'], 'blue')} detail={metricValue(data, ['vehicles'], () => `${data.vehicles.length} total vehicles`)} onClick={() => router.push('/admin/vehicles')} />
        <KpiCard label="Unassigned jobs" value={getWorkspaceDatasetMetricValue(data.datasets.jobs, (rows) => rows.filter((job) => ['posted', 'awarded'].includes(job.status) && !job.assigned_driver_id).length)} tone={metricTone(data, ['jobs'], 'orange')} detail={metricDetail(data, ['jobs'], 'Driver and vehicle required')} onClick={() => router.push('/admin/fleet/assignments')} />
        <KpiCard label="Active jobs" value={getWorkspaceDatasetMetricValue(data.datasets.jobs, (rows) => rows.filter((job) => activeStatuses.has(job.current_status ?? job.status)).length)} tone={metricTone(data, ['jobs'], 'green')} detail={metricDetail(data, ['jobs'], 'Collections and deliveries')} onClick={() => router.push('/admin/fleet/active-jobs')} />
        <KpiCard label="Expiry alerts" value={metricValue(data, ['driverDocuments', 'vehicleDocuments'], () => expiring)} tone={metricTone(data, ['driverDocuments', 'vehicleDocuments'], expiring ? 'red' : 'green')} detail={metricDetail(data, ['driverDocuments', 'vehicleDocuments'], 'Due within 30 days')} onClick={() => router.push('/admin/documents/expiry')} />
        <KpiCard label="Exceptions" value={getWorkspaceDatasetMetricValue(data.datasets.jobs, (rows) => rows.filter((job) => exceptionStatuses.has(job.current_status ?? job.status)).length)} tone={metricTone(data, ['jobs'], exceptionJobs.length ? 'red' : 'green')} detail={metricDetail(data, ['jobs'], 'Failed or disputed jobs')} onClick={() => router.push('/admin/incidents')} />
      </KpiGrid>

      <TwoColumn>
        <Panel
          title="Jobs requiring allocation"
          description="Work that cannot progress without a driver and vehicle assignment."
          actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/assignments')}>Assignments</ActionButton>}
        >
          <DataTable
            columns={['Route', 'Pickup', 'Required vehicle', 'Status', 'Action']}
            rows={unassignedJobs.slice(0, 6).map((job) => [
              <strong key="route">{job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}</strong>,
              formatDate(job.pickup_datetime),
              (job.vehicle_type ?? 'Not specified').replace(/_/g, ' '),
              <StatusBadge key="status" value={job.status} tone="orange" />,
              <ActionButton key="action" tone="success" onClick={() => router.push(`/admin/diary?job=${job.id}`)}>Allocate</ActionButton>,
            ])}
            empty={<EmptyState title="No unassigned jobs" description="All current jobs have a resource allocation or are not ready for allocation." />}
          />
        </Panel>
        <div style={{ display: 'grid', gap: '0.9rem' }}>
          <Panel title="Drivers available now" description="Availability and current assignment status." actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/drivers')}>All drivers</ActionButton>}>
            {data.drivers.filter((d) => d.availability_status === 'available').slice(0, 6).map((driver) => (
              <button key={driver.id} onClick={() => router.push(`/admin/drivers?driver=${driver.id}`)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', gap: '0.5rem', border: 0, borderBottom: '1px solid #eef2f6', background: 'transparent', padding: '0.58rem 0', cursor: 'pointer', textAlign: 'left' }}>
                <span><strong style={{ display: 'block', fontSize: '0.78rem' }}>{driver.display_name ?? driver.email ?? 'Driver'}</strong><span style={{ color: '#64748b', fontSize: '0.68rem' }}>{driver.phone ?? 'No phone recorded'}</span></span>
                <StatusBadge value="available" tone="green" />
              </button>
            ))}
            {data.drivers.filter((d) => d.availability_status === 'available').length === 0 && <EmptyState title="No drivers marked available" />}
          </Panel>
          <Panel title="Readiness alerts" description="Expiry and location issues that can stop operations.">
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <button onClick={() => router.push('/admin/documents/expiry')} style={{ display: 'flex', justifyContent: 'space-between', border: '1px solid #e2e8f0', background: expiring ? '#fff7ed' : '#f8fafc', borderRadius: '8px', padding: '0.62rem', cursor: 'pointer' }}><span>Documents expiring</span><strong>{expiring}</strong></button>
              <button onClick={() => router.push('/admin/fleet/positions')} style={{ display: 'flex', justifyContent: 'space-between', border: '1px solid #e2e8f0', background: staleDrivers ? '#fef2f2' : '#f8fafc', borderRadius: '8px', padding: '0.62rem', cursor: 'pointer' }}><span>Stale GPS positions</span><strong>{staleDrivers}</strong></button>
              <button onClick={() => router.push('/admin/fleet/maintenance')} style={{ display: 'flex', justifyContent: 'space-between', border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '8px', padding: '0.62rem', cursor: 'pointer' }}><span>Unassigned vehicles</span><strong>{data.vehicles.filter((v) => !v.assigned_driver_id).length}</strong></button>
            </div>
          </Panel>
        </div>
      </TwoColumn>

      {activeJobs.length > 0 && (
        <Panel
          title="Active jobs — live operational view"
          description="Jobs currently in transit. Track progress and identify any exceptions early."
          actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/active-jobs')}>Full board</ActionButton>}
        >
          <DataTable
            columns={['Route', 'Pickup', 'Delivery', 'Driver', 'Status', 'Action']}
            rows={activeJobs.slice(0, 8).map((job) => {
              const driver = data.drivers.find((d) => d.id === job.assigned_driver_id);
              return [
                <strong key="route">{job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}</strong>,
                formatDate(job.pickup_datetime),
                formatDate(job.delivery_datetime),
                driver?.display_name ?? driver?.email ?? '—',
                <StatusBadge key="status" value={job.current_status ?? job.status} />,
                <ActionButton key="action" tone="secondary" onClick={() => router.push(`/admin/jobs/${job.id}`)}>Open</ActionButton>,
              ];
            })}
            empty={<EmptyState title="No active jobs" />}
          />
        </Panel>
      )}

      {exceptionJobs.length > 0 && (
        <Panel
          title="Exceptions — immediate action required"
          description="Failed, disputed or damaged jobs that need intervention before they escalate."
          actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/incidents')}>Incidents</ActionButton>}
        >
          <DataTable
            columns={['Route', 'Pickup', 'Exception status', 'Action']}
            rows={exceptionJobs.slice(0, 6).map((job) => [
              <strong key="route">{job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}</strong>,
              formatDate(job.pickup_datetime),
              <StatusBadge key="status" value={job.current_status ?? job.status} tone="red" />,
              <ActionButton key="action" tone="danger" onClick={() => router.push(`/admin/jobs/${job.id}`)}>Resolve</ActionButton>,
            ])}
            empty={<EmptyState title="No exceptions" />}
          />
        </Panel>
      )}
    </PageFrame>
  );
}

export function FinanceDashboard() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const totals = useMemo(() => {
    const unpaid = data.invoices.filter((invoice) => invoice.payment_status !== 'paid' && !['paid', 'Paid', 'void'].includes(invoice.status));
    const overdue = unpaid.filter((invoice) => invoice.due_date && new Date(invoice.due_date).getTime() < Date.now());
    return {
      draft: data.invoices.filter((invoice) => ['draft', 'Draft'].includes(invoice.status)).length,
      unpaid: unpaid.length,
      overdue: overdue.length,
      outstanding: unpaid.reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0),
      overdueAmount: overdue.reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0),
    };
  }, [data.invoices]);
  return (
    <PageFrame>
      <PageHeader eyebrow="Finance" title="Finance Dashboard" description="Invoice issuance, payment status, balances and exceptions without operational edit permissions." actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/invoices')}>Open Invoices</ActionButton>} />
      <KpiGrid>
        <KpiCard label="Draft invoices" value={getWorkspaceDatasetMetricValue(data.datasets.invoices, (rows) => rows.filter((invoice) => ['draft', 'Draft'].includes(invoice.status)).length)} detail={metricDetail(data, ['invoices'], 'Invoices requiring issue')} />
        <KpiCard label="Outstanding invoices" value={getWorkspaceDatasetMetricValue(data.datasets.invoices, (rows) => rows.filter((invoice) => invoice.payment_status !== 'paid' && !['paid', 'Paid', 'void'].includes(invoice.status)).length)} detail={metricDetail(data, ['invoices'], 'Awaiting payment')} tone={metricTone(data, ['invoices'], 'orange')} />
        <KpiCard label="Overdue invoices" value={getWorkspaceDatasetMetricValue(data.datasets.invoices, (rows) => rows.filter((invoice) => invoice.payment_status !== 'paid' && !['paid', 'Paid', 'void'].includes(invoice.status) && invoice.due_date && new Date(invoice.due_date).getTime() < Date.now()).length)} detail={metricDetail(data, ['invoices'], 'Past due date')} tone={metricTone(data, ['invoices'], 'red')} />
        <KpiCard label="Outstanding value" value={metricValue(data, ['invoices'], () => money(totals.outstanding))} detail={metricDetail(data, ['invoices'], 'Unpaid balance')} tone={metricTone(data, ['invoices'], 'navy')} />
        <KpiCard label="Overdue value" value={metricValue(data, ['invoices'], () => money(totals.overdueAmount))} detail={metricDetail(data, ['invoices'], 'Past due balance')} tone={metricTone(data, ['invoices'], 'red')} />
      </KpiGrid>
      <Panel title="Invoice control" description="Most recent invoices and payment state.">
        <DataTable columns={['Invoice', 'Client', 'Amount', 'Due', 'Status']} rows={data.invoices.slice(0, 15).map((invoice) => [invoice.invoice_number ?? 'Invoice', invoice.client_name ?? 'Client', money(Number(invoice.amount ?? 0)), invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-GB') : 'Not set', <StatusBadge key="status" value={invoice.payment_status ?? invoice.status} />])} />
      </Panel>
    </PageFrame>
  );
}

export function ComplianceDashboard() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const documents = data.driverDocuments.concat(data.vehicleDocuments);
  const expired = documents.filter((document) => { const days = daysUntil(document.expiry_date); return days !== null && days < 0; });
  const due7 = documents.filter((document) => { const days = daysUntil(document.expiry_date); return days !== null && days >= 0 && days <= 7; });
  const due30 = documents.filter((document) => { const days = daysUntil(document.expiry_date); return days !== null && days > 7 && days <= 30; });
  return (
    <PageFrame>
      <PageHeader eyebrow="Compliance" title="Compliance Dashboard" description="Verification, expiry and operational readiness for drivers, vehicles and company documents." actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/documents')}>Verification Queue</ActionButton>} />
      <KpiGrid>
        <KpiCard label="Expired" value={metricValue(data, ['driverDocuments', 'vehicleDocuments'], () => expired.length)} detail={metricDetail(data, ['driverDocuments', 'vehicleDocuments'], 'Immediate renewal required')} tone={metricTone(data, ['driverDocuments', 'vehicleDocuments'], 'red')} />
        <KpiCard label="Expires in 7 days" value={metricValue(data, ['driverDocuments', 'vehicleDocuments'], () => due7.length)} detail={metricDetail(data, ['driverDocuments', 'vehicleDocuments'], 'Urgent review window')} tone={metricTone(data, ['driverDocuments', 'vehicleDocuments'], 'orange')} />
        <KpiCard label="Expires in 30 days" value={metricValue(data, ['driverDocuments', 'vehicleDocuments'], () => due30.length)} detail={metricDetail(data, ['driverDocuments', 'vehicleDocuments'], 'Upcoming expiry')} tone={metricTone(data, ['driverDocuments', 'vehicleDocuments'], 'blue')} />
        <KpiCard label="Pending verification" value={metricValue(data, ['driverDocuments', 'vehicleDocuments'], () => documents.filter((document) => ['pending', 'under_review'].includes(document.status ?? '')).length)} detail={metricDetail(data, ['driverDocuments', 'vehicleDocuments'], 'Requires review')} tone={metricTone(data, ['driverDocuments', 'vehicleDocuments'], 'purple')} />
        <KpiCard label="Drivers not ready" value={getWorkspaceDatasetMetricValue(data.datasets.drivers, (rows) => rows.filter((driver) => driver.status !== 'active').length)} detail={metricDetail(data, ['drivers'], 'Inactive or blocked')} tone={metricTone(data, ['drivers'], 'red')} />
      </KpiGrid>
      <Panel title="Priority expiry queue" description="Expired documents first, followed by the nearest expiry date.">
        <DataTable columns={['Document', 'Entity', 'Expiry', 'Status', 'Action']} rows={documents.filter((document) => document.expiry_date).sort((a, b) => new Date(a.expiry_date ?? 0).getTime() - new Date(b.expiry_date ?? 0).getTime()).slice(0, 20).map((document) => [document.doc_type?.replace(/_/g, ' ') ?? 'Document', document.driver_id ? 'Driver' : 'Vehicle', document.expiry_date ? new Date(document.expiry_date).toLocaleDateString('en-GB') : 'Not set', <StatusBadge key="status" value={document.status ?? 'pending'} />, <ActionButton key="action" tone="secondary" onClick={() => router.push('/admin/documents')}>Review</ActionButton>])} />
      </Panel>
    </PageFrame>
  );
}

export function DispatcherDashboard() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const latestLocationByDriver = useMemo(() => {
    const map = new Map<string, WorkspaceDataState['locations'][number]>();
    for (const location of data.locations) if (!map.has(location.driver_id)) map.set(location.driver_id, location);
    return map;
  }, [data.locations]);
  const stalePositions = data.drivers.filter((driver) => {
    const location = latestLocationByDriver.get(driver.id);
    const timestamp = location?.recorded_at ?? location?.updated_at;
    return !timestamp || Date.now() - new Date(timestamp).getTime() > 20 * 60_000;
  }).length;
  const activeJobs = data.jobs.filter((job) => activeStatuses.has(job.current_status ?? job.status));
  const unallocatedJobs = data.jobs.filter((job) => ['posted', 'awarded'].includes(job.status) && !job.assigned_driver_id);
  const exceptionJobs = data.jobs.filter((job) => exceptionStatuses.has(job.current_status ?? job.status));

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Operations control"
        title="Operations Dashboard"
        description="Daily allocation, live execution and exception control without carrier marketplace or finance content."
        actions={<><ActionButton tone="success" onClick={() => router.push('/admin/operations-centre')}>Open operations centre</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/assignments')}>Assignments</ActionButton></>}
      />
      {data.error && <AlertBanner>{data.error}</AlertBanner>}
      <KpiGrid>
        <KpiCard label="Unallocated jobs" value={getWorkspaceDatasetMetricValue(data.datasets.jobs, (rows) => rows.filter((job) => ['posted', 'awarded'].includes(job.status) && !job.assigned_driver_id).length)} detail={metricDetail(data, ['jobs'], 'Needs dispatch')} tone={metricTone(data, ['jobs'], 'orange')} onClick={() => router.push('/admin/fleet/assignments')} />
        <KpiCard label="Active jobs" value={getWorkspaceDatasetMetricValue(data.datasets.jobs, (rows) => rows.filter((job) => activeStatuses.has(job.current_status ?? job.status)).length)} detail={metricDetail(data, ['jobs'], 'Live execution')} tone={metricTone(data, ['jobs'], 'green')} onClick={() => router.push('/admin/fleet/active-jobs')} />
        <KpiCard label="Exceptions" value={getWorkspaceDatasetMetricValue(data.datasets.jobs, (rows) => rows.filter((job) => exceptionStatuses.has(job.current_status ?? job.status)).length)} detail={metricDetail(data, ['jobs'], 'Immediate intervention')} tone={metricTone(data, ['jobs'], exceptionJobs.length ? 'red' : 'green')} onClick={() => router.push('/admin/incidents')} />
        <KpiCard label="Available drivers" value={getWorkspaceDatasetMetricValue(data.datasets.drivers, (rows) => rows.filter((driver) => driver.availability_status === 'available').length)} detail={metricDetail(data, ['drivers'], 'Ready now')} tone={metricTone(data, ['drivers'], 'blue')} onClick={() => router.push('/admin/drivers')} />
        <KpiCard label="Stale positions" value={metricValue(data, ['drivers', 'locations'], () => stalePositions)} detail={metricDetail(data, ['drivers', 'locations'], 'No fresh GPS update')} tone={metricTone(data, ['drivers', 'locations'], stalePositions ? 'red' : 'navy')} onClick={() => router.push('/admin/fleet/positions')} />
      </KpiGrid>
      <TwoColumn>
        <Panel title="Priority jobs" description="Dispatch priority sorted by current operating risk.">
          <DataTable
            columns={['Route', 'Pickup', 'Status', 'Action']}
            rows={[...unallocatedJobs, ...activeJobs.filter((job) => !unallocatedJobs.includes(job))].slice(0, 8).map((job) => [
              <strong key="route">{job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}</strong>,
              formatDate(job.pickup_datetime),
              <StatusBadge key="status" value={job.current_status ?? job.status} />,
              <ActionButton key="action" tone="secondary" onClick={() => router.push(`/admin/jobs/${job.id}`)}>Open</ActionButton>,
            ])}
            empty={<EmptyState title={datasetUnavailable(data, ['jobs']) ? 'Job data unavailable' : 'No dispatch priorities'} description={datasetUnavailable(data, ['jobs']) ? 'The operational jobs feed is unavailable for this workspace.' : 'Unallocated and live jobs will appear here.'} />}
          />
        </Panel>
        <Panel title="Resource signals" description="Dispatchers can monitor status without carrier commercial actions.">
          <KpiGrid>
            <KpiCard label="Drivers online" value={getWorkspaceDatasetMetricValue(data.datasets.drivers, (rows) => rows.filter((driver) => driver.availability_status !== 'offline').length)} detail={metricDetail(data, ['drivers'], 'Online or busy')} tone={metricTone(data, ['drivers'], 'green')} onClick={() => router.push('/admin/drivers')} />
            <KpiCard label="Vehicles visible" value={getWorkspaceDatasetMetricValue(data.datasets.vehicles, (rows) => rows.length)} detail={metricDetail(data, ['vehicles'], 'Fleet units')} tone="navy" onClick={() => router.push('/admin/vehicles')} />
            <KpiCard label="Exceptions open" value={getWorkspaceDatasetMetricValue(data.datasets.jobs, (rows) => rows.filter((job) => exceptionStatuses.has(job.current_status ?? job.status)).length)} detail={metricDetail(data, ['jobs'], 'Operational incidents')} tone={metricTone(data, ['jobs'], 'red')} onClick={() => router.push('/admin/incidents')} />
          </KpiGrid>
        </Panel>
      </TwoColumn>
    </PageFrame>
  );
}

export function ViewerDashboard() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const completedJobs = data.jobs.filter((job) => ['delivered', 'completed', 'paid'].includes(job.current_status ?? job.status));
  const exceptionJobs = data.jobs.filter((job) => exceptionStatuses.has(job.current_status ?? job.status));

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Read-only operations"
        title="Viewer Dashboard"
        description="Approved operational visibility without state-changing carrier actions."
      />
      {data.error && <AlertBanner>{data.error}</AlertBanner>}
      <KpiGrid>
        <KpiCard label="Jobs visible" value={getWorkspaceDatasetMetricValue(data.datasets.jobs, (rows) => rows.length)} detail={metricDetail(data, ['jobs'], 'Read-only record set')} tone="navy" onClick={() => router.push('/admin/jobs')} />
        <KpiCard label="Active jobs" value={getWorkspaceDatasetMetricValue(data.datasets.jobs, (rows) => rows.filter((job) => activeStatuses.has(job.current_status ?? job.status)).length)} detail={metricDetail(data, ['jobs'], 'In progress')} tone={metricTone(data, ['jobs'], 'green')} onClick={() => router.push('/admin/jobs')} />
        <KpiCard label="Completed" value={metricValue(data, ['jobs'], () => completedJobs.length)} detail={metricDetail(data, ['jobs'], 'Delivered or paid')} tone={metricTone(data, ['jobs'], 'blue')} onClick={() => router.push('/admin/jobs')} />
        <KpiCard label="Exceptions" value={metricValue(data, ['jobs'], () => exceptionJobs.length)} detail={metricDetail(data, ['jobs'], 'Requires follow-up')} tone={metricTone(data, ['jobs'], exceptionJobs.length ? 'red' : 'green')} onClick={() => router.push('/admin/jobs')} />
      </KpiGrid>
      <Panel title="Recent jobs" description="Latest visible operational work items.">
        <DataTable
          columns={['Route', 'Pickup', 'Status', 'Open']}
          rows={data.jobs.slice(0, 10).map((job) => [
            <strong key="route">{job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}</strong>,
            formatDate(job.pickup_datetime),
            <StatusBadge key="status" value={job.current_status ?? job.status} />,
            <ActionButton key="open" tone="secondary" onClick={() => router.push(`/admin/jobs/${job.id}`)}>Open</ActionButton>,
          ])}
          empty={<EmptyState title={datasetUnavailable(data, ['jobs']) ? 'Job data unavailable' : 'No jobs visible'} description={datasetUnavailable(data, ['jobs']) ? 'The read-only jobs dataset is currently unavailable.' : 'Operational jobs will appear here when records are available.'} />}
        />
      </Panel>
    </PageFrame>
  );
}

function BlockedAdminDashboard({
  blocker,
  homeHref,
}: {
  blocker: string;
  homeHref: string | null;
}) {
  const router = useRouter();
  return (
    <PageFrame>
      <PageHeader
        eyebrow="Workspace boundary"
        title="Admin dashboard unavailable"
        description="The canonical workspace contract does not permit this role to inherit carrier/company operations content here."
      />
      <PermissionDeniedState
        reason={blocker}
        action={homeHref ? <ActionButton tone="secondary" onClick={() => router.push(homeHref)}>Open approved home route</ActionButton> : undefined}
      />
    </PageFrame>
  );
}

export default function RoleDashboard() {
  const { user } = useAuth();
  const resolution = resolveAdminDashboard(user?.workspaceRole ?? resolveWorkspaceRole(user));
  switch (resolution.target) {
    case 'carrier':
      return <CarrierDashboard />;
    case 'fleet':
      return <FleetDashboard />;
    case 'dispatcher':
      return <DispatcherDashboard />;
    case 'finance':
      return <FinanceDashboard />;
    case 'compliance':
      return <ComplianceDashboard />;
    case 'viewer':
      return <ViewerDashboard />;
    case 'blocked':
      return <BlockedAdminDashboard blocker={resolution.blocker ?? 'Admin dashboard unavailable.'} homeHref={resolution.homeHref} />;
  }
}
