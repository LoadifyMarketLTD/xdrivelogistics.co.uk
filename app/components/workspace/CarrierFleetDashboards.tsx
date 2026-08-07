'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  getWorkspaceDatasetMetricValue,
  useCompanyWorkspaceData,
} from './useCompanyWorkspaceData';
import {
  ActionButton,
  DataTable,
  EmptyState,
  ExchangeKpiStrip,
  FinancialSummaryPanel,
  KpiCard,
  KpiGrid,
  PageFrame,
  PageHeader,
  Panel,
  StatusBadge,
  TwoColumn,
  workspaceTheme,
} from './WorkspaceUI';
import {
  activeStatuses,
  datasetStatus,
  datasetUnavailable,
  daysUntil,
  exceptionStatuses,
  formatDate,
  metricDetail,
  metricTone,
  metricValue,
  money,
  terminalStatuses,
} from './dashboardRuntime';

const compactActionGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit,minmax(135px,1fr))',
  gap: '0.45rem',
};

const compactActionStyle: React.CSSProperties = {
  border: '1px solid #dbe3ec',
  borderRadius: '7px',
  background: '#ffffff',
  color: '#0B2F6B',
  padding: '0.55rem 0.65rem',
  fontSize: '0.72rem',
  fontWeight: 750,
  cursor: 'pointer',
  textAlign: 'left',
};

export function CarrierDashboard() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();

  const metrics = useMemo(() => {
    const jobIds = new Set(data.jobs.map((job) => job.id));
    const companyBids = data.bids.filter((bid) => bid.company_id === data.companyId);
    const carrierInvoices = data.invoices.filter((invoice) => invoice.company_id === data.companyId);
    const submittedQuotes = companyBids.filter((bid) => ['submitted', 'pending'].includes(bid.status));
    const wonQuotes = companyBids.filter((bid) => bid.status === 'accepted');
    const unallocatedJobs = data.jobs.filter(
      (job) => ['awarded', 'posted'].includes(job.status) && !job.assigned_driver_id,
    );
    const activeJobs = data.jobs.filter((job) => activeStatuses.has(job.current_status ?? job.status));
    const podPending = data.jobs.filter(
      (job) => ['delivered', 'completed'].includes(job.status) && (job.delivery_photos?.length ?? 0) === 0,
    );
    const outstandingInvoices = carrierInvoices.filter(
      (invoice) => invoice.payment_status !== 'paid' && !['paid', 'Paid', 'void', 'cancelled'].includes(invoice.status),
    );
    const overdueInvoices = outstandingInvoices.filter(
      (invoice) => invoice.due_date && new Date(invoice.due_date).getTime() < Date.now(),
    );
    const acceptedRevenue = data.bids
      .filter((bid) => jobIds.has(bid.job_id) && bid.status === 'accepted')
      .reduce((sum, bid) => sum + Number(bid.bid_price_gbp ?? bid.amount ?? 0), 0);
    const invoicedValue = carrierInvoices
      .filter((invoice) => !['draft', 'pending', 'cancelled'].includes(String(invoice.status).toLowerCase()))
      .reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0);
    const paidValue = carrierInvoices
      .filter((invoice) => ['paid', 'Paid'].includes(invoice.status) || invoice.payment_status === 'paid')
      .reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0);
    const exceptionJobs = data.jobs.filter((job) => exceptionStatuses.has(job.current_status ?? job.status));
    const recentQuoteActivity = [...companyBids]
      .filter((bid) => ['submitted', 'accepted', 'rejected'].includes(bid.status))
      .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
      .slice(0, 5);

    return {
      submittedQuotes,
      wonQuotes,
      unallocatedJobs,
      activeJobs,
      podPending,
      outstandingInvoices,
      overdueInvoices,
      acceptedRevenue,
      invoicedValue,
      paidValue,
      exceptionJobs,
      recentQuoteActivity,
    };
  }, [data]);

  const complianceAlerts = useMemo(
    () =>
      data.driverDocuments
        .concat(data.vehicleDocuments)
        .map((doc) => ({ ...doc, daysToExpiry: daysUntil(doc.expiry_date) }))
        .filter((doc) => doc.daysToExpiry !== null && doc.daysToExpiry <= 30)
        .sort((a, b) => (a.daysToExpiry ?? 9999) - (b.daysToExpiry ?? 9999)),
    [data.driverDocuments, data.vehicleDocuments],
  );

  const jobsNeedingAttention = data.jobs
    .filter((job) => !terminalStatuses.has(job.status))
    .sort((a, b) => {
      const aPriority = !a.assigned_driver_id ? 0 : exceptionStatuses.has(a.current_status ?? a.status) ? 1 : 2;
      const bPriority = !b.assigned_driver_id ? 0 : exceptionStatuses.has(b.current_status ?? b.status) ? 1 : 2;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return String(a.pickup_datetime ?? '').localeCompare(String(b.pickup_datetime ?? ''));
    })
    .slice(0, 8);

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Carrier control desk"
        title="Carrier Dashboard"
        description="Run today’s transport operation: allocate won work, keep drivers and vehicles ready, protect POD and turn completed jobs into cash."
        actions={
          <>
            <ActionButton tone="success" onClick={() => router.push('/admin/marketplace')}>Find Loads</ActionButton>
            <ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/assignments')}>Allocate Work</ActionButton>
          </>
        }
      />

      <ExchangeKpiStrip>
        <KpiCard
          label="Active jobs"
          value={getWorkspaceDatasetMetricValue(data.datasets.jobs, (rows) => rows.filter((job) => activeStatuses.has(job.current_status ?? job.status)).length)}
          detail={metricDetail(data, ['jobs'], 'Collections and deliveries live now')}
          tone={metricTone(data, ['jobs'], 'green')}
          onClick={() => router.push('/admin/fleet/active-jobs')}
        />
        <KpiCard
          label="Awaiting allocation"
          value={getWorkspaceDatasetMetricValue(data.datasets.jobs, (rows) => rows.filter((job) => ['awarded', 'posted'].includes(job.status) && !job.assigned_driver_id).length)}
          detail={metricDetail(data, ['jobs'], 'Driver and vehicle required')}
          tone={metricTone(data, ['jobs'], 'orange')}
          onClick={() => router.push('/admin/fleet/assignments')}
        />
        <KpiCard
          label="Available drivers"
          value={getWorkspaceDatasetMetricValue(data.datasets.drivers, (rows) => rows.filter((driver) => driver.availability_status === 'available').length)}
          detail={metricDetail(data, ['drivers'], 'Ready for dispatch')}
          tone={metricTone(data, ['drivers'], 'blue')}
          onClick={() => router.push('/admin/driver-availability')}
        />
        <KpiCard
          label="Available vehicles"
          value={getWorkspaceDatasetMetricValue(data.datasets.vehicles, (rows) => rows.filter((vehicle) => !vehicle.assigned_driver_id).length)}
          detail={metricDetail(data, ['vehicles'], 'Unassigned fleet capacity')}
          tone={metricTone(data, ['vehicles'], 'navy')}
          onClick={() => router.push('/admin/vehicles')}
        />
        <KpiCard
          label="POD outstanding"
          value={getWorkspaceDatasetMetricValue(data.datasets.jobs, (rows) => rows.filter((job) => ['delivered', 'completed'].includes(job.status) && (job.delivery_photos?.length ?? 0) === 0).length)}
          detail={metricDetail(data, ['jobs'], 'Delivered without proof')}
          tone={metricTone(data, ['jobs'], metrics.podPending.length ? 'red' : 'green')}
          onClick={() => router.push('/admin/documents?view=pod')}
        />
        <KpiCard
          label="Outstanding invoices"
          value={metricValue(data, ['invoices'], () => metrics.outstandingInvoices.length)}
          detail={metricDetail(data, ['invoices'], metrics.outstandingInvoices.length ? `${metrics.overdueInvoices.length} overdue` : 'Nothing awaiting payment')}
          tone={metricTone(data, ['invoices'], metrics.overdueInvoices.length ? 'red' : metrics.outstandingInvoices.length ? 'orange' : 'green')}
          onClick={() => router.push('/admin/invoices')}
        />
      </ExchangeKpiStrip>

      <TwoColumn>
        <Panel
          title="Today’s operations — attention first"
          description="Unallocated, live and exception work is kept ahead of reporting so dispatch can act immediately."
          actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/jobs')}>All jobs</ActionButton>}
        >
          <DataTable
            columns={['Route', 'Pickup', 'Driver', 'Vehicle', 'Status', 'Next action']}
            rows={jobsNeedingAttention.map((job) => {
              const driver = data.drivers.find((candidate) => candidate.id === job.assigned_driver_id);
              return [
                <strong key="route">{job.pickup_location ?? job.pickup_postcode ?? 'Collection'} → {job.delivery_location ?? job.delivery_postcode ?? 'Delivery'}</strong>,
                formatDate(job.pickup_datetime),
                driver?.display_name ?? driver?.email ?? 'Unassigned',
                (job.vehicle_type ?? 'Not specified').replace(/_/g, ' '),
                <StatusBadge key="status" value={job.current_status ?? job.status} tone={exceptionStatuses.has(job.current_status ?? job.status) ? 'red' : undefined} />,
                <ActionButton
                  key="action"
                  tone={!job.assigned_driver_id ? 'success' : 'secondary'}
                  onClick={() => router.push(!job.assigned_driver_id ? `/admin/fleet/assignments?job=${job.id}` : `/admin/jobs/${job.id}`)}
                >
                  {!job.assigned_driver_id ? 'Allocate' : 'Open'}
                </ActionButton>,
              ];
            })}
            empty={
              <EmptyState
                compact
                title={datasetUnavailable(data, ['jobs']) ? 'Job data unavailable' : 'No jobs need attention'}
                description={datasetUnavailable(data, ['jobs']) ? 'The carrier jobs dataset is unavailable for this workspace.' : 'New won work, active jobs and exceptions will appear here.'}
              />
            }
          />
        </Panel>

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <Panel title="Capacity now" description="Current company resources available for dispatch.">
            <KpiGrid>
              <KpiCard label="Drivers ready" value={getWorkspaceDatasetMetricValue(data.datasets.drivers, (rows) => rows.filter((driver) => driver.availability_status === 'available').length)} detail={metricDetail(data, ['drivers'], 'Available now')} tone={metricTone(data, ['drivers'], 'green')} />
              <KpiCard label="Drivers busy" value={getWorkspaceDatasetMetricValue(data.datasets.drivers, (rows) => rows.filter((driver) => driver.availability_status === 'busy').length)} detail={metricDetail(data, ['drivers'], 'Assigned or on job')} tone={metricTone(data, ['drivers'], 'orange')} />
              <KpiCard label="Vehicles" value={getWorkspaceDatasetMetricValue(data.datasets.vehicles, (rows) => rows.length)} detail={metricDetail(data, ['vehicles'], 'Company fleet')} tone="navy" />
              <KpiCard label="Docs due" value={metricValue(data, ['driverDocuments', 'vehicleDocuments'], () => complianceAlerts.length)} detail={metricDetail(data, ['driverDocuments', 'vehicleDocuments'], 'Within 30 days')} tone={metricTone(data, ['driverDocuments', 'vehicleDocuments'], complianceAlerts.length ? 'red' : 'green')} />
            </KpiGrid>
          </Panel>

          <Panel title="Carrier actions" description="Compact shortcuts to the daily commercial and dispatch workflow.">
            <div style={compactActionGrid}>
              <button style={compactActionStyle} onClick={() => router.push('/admin/marketplace')}>Find marketplace loads</button>
              <button style={compactActionStyle} onClick={() => router.push('/admin/quotes')}>Review quotes</button>
              <button style={compactActionStyle} onClick={() => router.push('/admin/fleet/assignments')}>Allocate won work</button>
              <button style={compactActionStyle} onClick={() => router.push('/admin/fleet/positions')}>Live positions</button>
              <button style={compactActionStyle} onClick={() => router.push('/admin/invoices')}>Invoices</button>
              <button style={compactActionStyle} onClick={() => router.push('/admin/documents/expiry')}>Compliance</button>
            </div>
          </Panel>
        </div>
      </TwoColumn>

      <TwoColumn>
        <Panel
          title="Commercial performance"
          description="Marketplace results and cash position without pushing the live operation below decorative cards."
          actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/quotes')}>Commercial desk</ActionButton>}
        >
          <FinancialSummaryPanel
            items={[
              {
                label: 'Quotes submitted',
                detail: metricDetail(data, ['bids'], 'Awaiting customer decision'),
                value: metricValue(data, ['bids'], () => metrics.submittedQuotes.length),
                color: datasetUnavailable(data, ['bids']) ? workspaceTheme.navy : '#1e40af',
                background: datasetUnavailable(data, ['bids']) ? workspaceTheme.surfaceMuted : '#eff6ff',
              },
              {
                label: 'Won work',
                detail: metricDetail(data, ['bids'], 'Accepted carrier quotes'),
                value: metricValue(data, ['bids'], () => metrics.wonQuotes.length),
                color: datasetUnavailable(data, ['bids']) ? workspaceTheme.navy : '#166534',
                background: datasetUnavailable(data, ['bids']) ? workspaceTheme.surfaceMuted : '#f0fdf4',
              },
              {
                label: 'Won work value',
                detail: metricDetail(data, ['jobs', 'bids'], 'Accepted bid total'),
                value: metricValue(data, ['jobs', 'bids'], () => money(metrics.acceptedRevenue)),
                color: datasetUnavailable(data, ['jobs', 'bids']) ? workspaceTheme.navy : '#0B2F6B',
                background: datasetUnavailable(data, ['jobs', 'bids']) ? workspaceTheme.surfaceMuted : '#eef4ff',
              },
              {
                label: 'Outstanding',
                detail: metricDetail(data, ['invoices'], `${metrics.overdueInvoices.length} overdue`),
                value: metricValue(data, ['invoices'], () => money(Math.max(0, metrics.invoicedValue - metrics.paidValue))),
                color: datasetUnavailable(data, ['invoices']) ? workspaceTheme.navy : metrics.overdueInvoices.length ? '#b91c1c' : '#c2410c',
                background: datasetUnavailable(data, ['invoices']) ? workspaceTheme.surfaceMuted : metrics.overdueInvoices.length ? '#fef2f2' : '#fff7ed',
              },
            ]}
          />
        </Panel>

        <Panel title="Operational alerts" description="Only issues that can stop work or delay payment.">
          <div style={{ display: 'grid', gap: '0.45rem' }}>
            <button style={compactActionStyle} onClick={() => router.push('/admin/incidents')}>
              Exceptions · {metricValue(data, ['jobs'], () => metrics.exceptionJobs.length)}
            </button>
            <button style={compactActionStyle} onClick={() => router.push('/admin/documents/expiry')}>
              Compliance alerts · {metricValue(data, ['driverDocuments', 'vehicleDocuments'], () => complianceAlerts.length)}
            </button>
            <button style={compactActionStyle} onClick={() => router.push('/admin/invoices')}>
              Overdue invoices · {metricValue(data, ['invoices'], () => metrics.overdueInvoices.length)}
            </button>
          </div>
        </Panel>
      </TwoColumn>

      {metrics.recentQuoteActivity.length > 0 && (
        <Panel title="Recent quote activity" description="Latest commercial responses from this carrier account." actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/quotes')}>All quotes</ActionButton>}>
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
          />
        </Panel>
      )}
    </PageFrame>
  );
}

export function FleetDashboard() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const locations = data.locations;

  const latestLocationByDriver = useMemo(() => {
    const map = new Map<string, (typeof locations)[number]>();
    for (const location of locations) {
      const current = map.get(location.driver_id);
      const currentAt = current?.recorded_at ?? current?.updated_at ?? '';
      const candidateAt = location.recorded_at ?? location.updated_at ?? '';
      if (!current || candidateAt > currentAt) map.set(location.driver_id, location);
    }
    return map;
  }, [locations]);

  const staleDrivers = data.drivers.filter((driver) => {
    const location = latestLocationByDriver.get(driver.id);
    const timestamp = location?.recorded_at ?? location?.updated_at;
    return !timestamp || Date.now() - new Date(timestamp).getTime() > 20 * 60_000;
  });

  const expiringDocs = data.driverDocuments
    .concat(data.vehicleDocuments)
    .filter((doc) => {
      const days = daysUntil(doc.expiry_date);
      return days !== null && days <= 30;
    });

  const unassignedJobs = data.jobs.filter((job) => ['posted', 'awarded'].includes(job.status) && !job.assigned_driver_id);
  const activeJobs = data.jobs.filter((job) => activeStatuses.has(job.current_status ?? job.status));
  const exceptionJobs = data.jobs.filter((job) => exceptionStatuses.has(job.current_status ?? job.status));

  const fleetRows = data.drivers.slice(0, 10).map((driver) => {
    const vehicle = data.vehicles.find((candidate) => candidate.assigned_driver_id === driver.id);
    const location = latestLocationByDriver.get(driver.id);
    const locationAt = location?.recorded_at ?? location?.updated_at ?? null;
    const stale = !locationAt || Date.now() - new Date(locationAt).getTime() > 20 * 60_000;
    return [
      <strong key="driver">{driver.display_name ?? driver.email ?? 'Driver'}</strong>,
      vehicle ? `${vehicle.reg_plate ?? 'No reg'} · ${String(vehicle.type ?? 'vehicle').replace(/_/g, ' ')}` : 'No vehicle assigned',
      <StatusBadge key="availability" value={driver.availability_status ?? 'offline'} tone={driver.availability_status === 'available' ? 'green' : driver.availability_status === 'busy' ? 'orange' : undefined} />,
      locationAt ? formatDate(locationAt) : 'No position',
      <StatusBadge key="freshness" value={stale ? 'stale' : 'live'} tone={stale ? 'red' : 'green'} />,
      <ActionButton key="action" tone="secondary" onClick={() => router.push(`/admin/drivers?driver=${driver.id}`)}>Open</ActionButton>,
    ];
  });

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Fleet control"
        title="Fleet Dashboard"
        description="See usable capacity first: vehicles, drivers, live-position freshness, maintenance access and compliance readiness."
        actions={
          <>
            <ActionButton tone="success" onClick={() => router.push('/admin/fleet/positions')}>Live Map</ActionButton>
            <ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/maintenance')}>Maintenance</ActionButton>
          </>
        }
      />

      <ExchangeKpiStrip>
        <KpiCard label="Available vehicles" value={getWorkspaceDatasetMetricValue(data.datasets.vehicles, (rows) => rows.filter((vehicle) => !vehicle.assigned_driver_id).length)} detail={metricDetail(data, ['vehicles'], 'Ready to assign')} tone={metricTone(data, ['vehicles'], 'green')} onClick={() => router.push('/admin/vehicles')} />
        <KpiCard label="Assigned vehicles" value={getWorkspaceDatasetMetricValue(data.datasets.vehicles, (rows) => rows.filter((vehicle) => Boolean(vehicle.assigned_driver_id)).length)} detail={metricDetail(data, ['vehicles'], 'Currently paired to drivers')} tone={metricTone(data, ['vehicles'], 'blue')} onClick={() => router.push('/admin/vehicles')} />
        <KpiCard label="Available drivers" value={getWorkspaceDatasetMetricValue(data.datasets.drivers, (rows) => rows.filter((driver) => driver.availability_status === 'available').length)} detail={metricDetail(data, ['drivers'], 'Ready now')} tone={metricTone(data, ['drivers'], 'green')} onClick={() => router.push('/admin/driver-availability')} />
        <KpiCard label="Busy drivers" value={getWorkspaceDatasetMetricValue(data.datasets.drivers, (rows) => rows.filter((driver) => driver.availability_status === 'busy').length)} detail={metricDetail(data, ['drivers'], 'Assigned or on job')} tone={metricTone(data, ['drivers'], 'orange')} onClick={() => router.push('/admin/drivers')} />
        <KpiCard label="Stale GPS positions" value={metricValue(data, ['drivers', 'locations'], () => staleDrivers.length)} detail={metricDetail(data, ['drivers', 'locations'], 'No fresh update within 20 min')} tone={metricTone(data, ['drivers', 'locations'], staleDrivers.length ? 'red' : 'green')} onClick={() => router.push('/admin/fleet/positions')} />
        <KpiCard label="Expiry alerts" value={metricValue(data, ['driverDocuments', 'vehicleDocuments'], () => expiringDocs.length)} detail={metricDetail(data, ['driverDocuments', 'vehicleDocuments'], 'Due within 30 days')} tone={metricTone(data, ['driverDocuments', 'vehicleDocuments'], expiringDocs.length ? 'red' : 'green')} onClick={() => router.push('/admin/documents/expiry')} />
      </ExchangeKpiStrip>

      <TwoColumn>
        <Panel title="Fleet availability" description="Driver, vehicle and tracking freshness in one scannable operational list." actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/positions')}>Live positions</ActionButton>}>
          <DataTable
            columns={['Driver', 'Vehicle', 'Availability', 'Last position', 'Tracking', 'Action']}
            rows={fleetRows}
            empty={
              <EmptyState
                compact
                title={datasetUnavailable(data, ['drivers']) ? (datasetStatus(data, ['drivers']) === 'partial' ? 'Partial driver data' : 'Driver data unavailable') : 'No drivers in fleet'}
                description={datasetUnavailable(data, ['drivers']) ? 'Driver availability cannot be fully displayed for this workspace.' : 'Add drivers to start building the live fleet view.'}
              />
            }
          />
        </Panel>

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <Panel title="Fleet readiness" description="Issues that can prevent a vehicle or driver from being dispatched.">
            <div style={{ display: 'grid', gap: '0.45rem' }}>
              <button style={compactActionStyle} onClick={() => router.push('/admin/documents/expiry')}>
                Documents expiring · {metricValue(data, ['driverDocuments', 'vehicleDocuments'], () => expiringDocs.length)}
              </button>
              <button style={compactActionStyle} onClick={() => router.push('/admin/fleet/positions')}>
                Stale GPS positions · {metricValue(data, ['drivers', 'locations'], () => staleDrivers.length)}
              </button>
              <button style={compactActionStyle} onClick={() => router.push('/admin/fleet/maintenance')}>
                Maintenance planner · Open
              </button>
              <button style={compactActionStyle} onClick={() => router.push('/admin/vehicles')}>
                Unassigned vehicles · {getWorkspaceDatasetMetricValue(data.datasets.vehicles, (rows) => rows.filter((vehicle) => !vehicle.assigned_driver_id).length)}
              </button>
            </div>
          </Panel>

          <Panel title="Fleet actions" description="No marketplace or broker controls — only fleet work.">
            <div style={compactActionGrid}>
              <button style={compactActionStyle} onClick={() => router.push('/admin/fleet/positions')}>Live map</button>
              <button style={compactActionStyle} onClick={() => router.push('/admin/fleet/assignments')}>Assignments</button>
              <button style={compactActionStyle} onClick={() => router.push('/admin/driver-availability')}>Driver availability</button>
              <button style={compactActionStyle} onClick={() => router.push('/admin/vehicles')}>Vehicles</button>
              <button style={compactActionStyle} onClick={() => router.push('/admin/fleet/maintenance')}>Maintenance</button>
              <button style={compactActionStyle} onClick={() => router.push('/admin/documents/expiry')}>Compliance</button>
            </div>
          </Panel>
        </div>
      </TwoColumn>

      <TwoColumn>
        <Panel title="Work awaiting resources" description="Jobs that cannot move until a driver and vehicle are allocated." actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/assignments')}>Assignments</ActionButton>}>
          <DataTable
            columns={['Route', 'Pickup', 'Required vehicle', 'Status', 'Action']}
            rows={unassignedJobs.slice(0, 6).map((job) => [
              <strong key="route">{job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}</strong>,
              formatDate(job.pickup_datetime),
              (job.vehicle_type ?? 'Not specified').replace(/_/g, ' '),
              <StatusBadge key="status" value={job.status} tone="orange" />,
              <ActionButton key="action" tone="success" onClick={() => router.push(`/admin/fleet/assignments?job=${job.id}`)}>Allocate</ActionButton>,
            ])}
            empty={<EmptyState compact title={datasetUnavailable(data, ['jobs']) ? 'Job data unavailable' : 'No unassigned jobs'} description={datasetUnavailable(data, ['jobs']) ? 'The fleet jobs dataset is unavailable for this workspace.' : 'Current work already has resource allocation.'} />}
          />
        </Panel>

        <Panel title="Live workload" description="Fleet utilisation signal from jobs currently being executed.">
          <KpiGrid>
            <KpiCard label="Active jobs" value={metricValue(data, ['jobs'], () => activeJobs.length)} detail={metricDetail(data, ['jobs'], 'In execution')} tone={metricTone(data, ['jobs'], 'green')} />
            <KpiCard label="Exceptions" value={metricValue(data, ['jobs'], () => exceptionJobs.length)} detail={metricDetail(data, ['jobs'], 'Operational intervention')} tone={metricTone(data, ['jobs'], exceptionJobs.length ? 'red' : 'green')} />
            <KpiCard label="Vehicles total" value={getWorkspaceDatasetMetricValue(data.datasets.vehicles, (rows) => rows.length)} detail={metricDetail(data, ['vehicles'], 'Fleet units')} tone="navy" />
            <KpiCard label="Drivers total" value={getWorkspaceDatasetMetricValue(data.datasets.drivers, (rows) => rows.length)} detail={metricDetail(data, ['drivers'], 'Fleet roster')} tone="navy" />
          </KpiGrid>
        </Panel>
      </TwoColumn>
    </PageFrame>
  );
}
