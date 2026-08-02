'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../AuthContext';
import { resolveWorkspaceRole } from '../../../lib/workspaceRole';
import { useCompanyWorkspaceData } from './useCompanyWorkspaceData';
import styles from './WorkspaceUI.module.css';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  OperationalCard,
  OperationalFilterField,
  OperationalFilters,
  OperationalMetricList,
  OperationalPageLayout,
  QuickActionGrid,
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

const activeStatuses = new Set(['awarded', 'allocated', 'accepted', 'on_my_way', 'on_my_way_to_pickup', 'on_site_pickup', 'loaded', 'collected', 'in_transit', 'on_my_way_to_delivery', 'on_site_delivery']);
const terminalStatuses = new Set(['delivered', 'completed', 'cancelled', 'paid']);
const exceptionStatuses = new Set(['cancelled', 'failed', 'exception', 'disputed', 'collection_failed', 'delivery_failed', 'damaged', 'breakdown']);
const money = (value: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
const formatDate = (value: string | null | undefined) => value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set';
const daysUntil = (value: string | null | undefined) => value ? Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000) : null;

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

  return (
    <OperationalPageLayout
      searchPanel={(
        <OperationalFilters title="Carrier control desk">
          <OperationalFilterField label="Live focus">
            <OperationalMetricList
              items={[
                { label: 'Quotes awaiting reply', value: metrics.submittedQuotes, tone: metrics.submittedQuotes ? 'orange' : 'green' },
                { label: 'Jobs in progress', value: metrics.active, tone: metrics.active ? 'green' : 'grey' },
                { label: 'POD missing', value: metrics.podPending, tone: metrics.podPending ? 'red' : 'green' },
                { label: 'Overdue invoices', value: metrics.overdueInvoices, tone: metrics.overdueInvoices ? 'red' : 'green' },
              ]}
            />
          </OperationalFilterField>
          <OperationalFilterField label="Quick actions">
            <QuickActionGrid
              actions={[
                { key: 'find-loads', label: 'Find marketplace loads', onClick: () => router.push('/admin/marketplace') },
                { key: 'quotes', label: 'Review submitted quotes', onClick: () => router.push('/admin/quotes') },
                { key: 'assign', label: 'Allocate awarded work', onClick: () => router.push('/admin/fleet/assignments') },
                { key: 'finance', label: 'Open invoices', onClick: () => router.push('/admin/invoices') },
              ]}
            />
          </OperationalFilterField>
          <OperationalFilterField label="Urgent exceptions">
            <OperationalMetricList
              items={[
                { label: 'Operational exceptions', value: metrics.exceptionJobs.length, tone: metrics.exceptionJobs.length ? 'red' : 'green' },
                { label: 'Roster ready', value: `${data.drivers.filter((d) => d.availability_status === 'available').length} drivers`, tone: 'blue' },
              ]}
            />
          </OperationalFilterField>
        </OperationalFilters>
      )}
    >
      <PageHeader
        eyebrow="Carrier operations"
        title="Carrier Dashboard"
        description="Find work, price opportunities, allocate resources and complete transport with a controlled POD-to-invoice workflow."
        actions={<><ActionButton tone="success" onClick={() => router.push('/admin/marketplace')}>Find Loads</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/admin/diary')}>Open Diary</ActionButton></>}
      />
      {data.error && <AlertBanner>{data.error}</AlertBanner>}
      <KpiGrid>
        <KpiCard label="Quotes submitted" value={metrics.submittedQuotes} detail="Awaiting a commercial decision" onClick={() => router.push('/admin/quotes')} />
        <KpiCard label="Won work" value={metrics.won} detail="Accepted carrier quotes" tone="green" onClick={() => router.push('/admin/bids')} />
        <KpiCard label="Awaiting allocation" value={metrics.unallocated} detail="Jobs requiring driver and vehicle" tone="orange" onClick={() => router.push('/admin/fleet/assignments')} />
        <KpiCard label="Active jobs" value={metrics.active} detail="Collections and deliveries in progress" tone="purple" onClick={() => router.push('/admin/fleet/active-jobs')} />
        <KpiCard label="POD outstanding" value={metrics.podPending} detail="Delivered jobs missing proof" tone="red" onClick={() => router.push('/admin/documents?view=pod')} />
        <KpiCard label="Overdue invoices" value={metrics.overdueInvoices} detail="Past due date" tone={metrics.overdueInvoices ? 'red' : 'navy'} onClick={() => router.push('/admin/invoices')} />
        <KpiCard label="Exceptions" value={metrics.exceptionJobs.length} detail="Failed or disputed jobs" tone={metrics.exceptionJobs.length ? 'red' : 'green'} onClick={() => router.push('/admin/incidents')} />
        <KpiCard label="Won work value" value={money(metrics.acceptedRevenue)} detail="Accepted bid total" tone="navy" />
      </KpiGrid>

      <TwoColumn>
        <OperationalCard
          title="Jobs requiring attention"
          subtitle="Unallocated, active and POD-pending work is prioritised before general reporting."
          actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/jobs')}>All jobs</ActionButton>}
          flush
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
        </OperationalCard>
        <div className={styles.roleDashboardColumn}>
          <OperationalCard title="Resource readiness" subtitle="Live capacity from your company roster.">
            <div className={styles.roleDashboardSummaryList}>
              {[
                ['Available drivers', data.drivers.filter((d) => d.availability_status === 'available').length, '/admin/drivers'],
                ['Busy drivers', data.drivers.filter((d) => d.availability_status === 'busy').length, '/admin/drivers'],
                ['Total vehicles', data.vehicles.length, '/admin/vehicles'],
                ['Unassigned vehicles', data.vehicles.filter((v) => !v.assigned_driver_id).length, '/admin/vehicles'],
              ].map(([label, value, href]) => (
                <button key={String(label)} type="button" onClick={() => router.push(String(href))} className={styles.roleDashboardSummaryButton}>
                  <span>{label}</span><strong>{value}</strong>
                </button>
              ))}
            </div>
          </OperationalCard>
          <OperationalCard title="Commercial shortcuts" subtitle="Fast access to the carrier workflow.">
            <QuickActionGrid
              actions={[
                { key: 'marketplace', label: 'Find marketplace loads', onClick: () => router.push('/admin/marketplace') },
                { key: 'submitted', label: 'Review submitted quotes', onClick: () => router.push('/admin/quotes') },
                { key: 'allocate', label: 'Allocate awarded work', onClick: () => router.push('/admin/fleet/assignments') },
                { key: 'active-jobs', label: 'Track active jobs', onClick: () => router.push('/admin/fleet/active-jobs') },
                { key: 'invoices', label: 'Open invoices', onClick: () => router.push('/admin/invoices') },
              ]}
            />
          </OperationalCard>
          <OperationalCard title="Compliance alerts" subtitle="Documents expiring within 30 days." actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/documents/expiry')}>View all</ActionButton>}>
            {data.driverDocuments.concat(data.vehicleDocuments).filter((doc) => { const d = daysUntil(doc.expiry_date); return d !== null && d <= 30; }).slice(0, 5).map((doc) => (
              <div key={doc.id} className={styles.roleDashboardListRow}>
                <span>{doc.doc_type?.replace(/_/g, ' ') ?? 'Document'}</span>
                <StatusBadge value={doc.expiry_date ? `${daysUntil(doc.expiry_date)} days` : 'missing'} tone="orange" />
              </div>
            ))}
            {data.driverDocuments.concat(data.vehicleDocuments).filter((doc) => { const d = daysUntil(doc.expiry_date); return d !== null && d <= 30; }).length === 0 && <EmptyState title="No expiry alerts" description="No driver or vehicle document expires within 30 days." />}
          </OperationalCard>
        </div>
      </TwoColumn>

      <OperationalCard
        title="Revenue & finance overview"
        subtitle="Financial position based on accepted bids, raised invoices and payment receipts."
        actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/invoices')}>Finance</ActionButton>}
      >
        <FinancialSummaryPanel
          items={[
            { label: 'Won work value', value: money(metrics.acceptedRevenue), background: workspaceTheme.surfaceSoft, color: workspaceTheme.green },
            { label: 'Invoiced', value: money(metrics.invoicedValue), background: workspaceTheme.surfaceSoft, color: workspaceTheme.blue },
            { label: 'Paid', value: money(metrics.paidValue), background: workspaceTheme.surfaceSoft, color: workspaceTheme.purple },
            { label: 'Outstanding', value: money(Math.max(0, metrics.invoicedValue - metrics.paidValue)), background: workspaceTheme.surfaceSoft, color: metrics.invoicedValue - metrics.paidValue > 0 ? workspaceTheme.orange : workspaceTheme.green },
          ]}
        />
      </OperationalCard>

      <OperationalCard
        title="Recent quote activity"
        subtitle="Latest commercial responses from the carrier account."
        actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/quotes')}>All quotes</ActionButton>}
        flush
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
      </OperationalCard>
    </OperationalPageLayout>
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
    <OperationalPageLayout
      searchPanel={(
        <OperationalFilters title="Fleet control desk">
          <OperationalFilterField label="Immediate attention">
            <OperationalMetricList
              items={[
                { label: 'Unassigned jobs', value: unassignedJobs.length, tone: unassignedJobs.length ? 'orange' : 'green' },
                { label: 'Stale GPS updates', value: staleDrivers, tone: staleDrivers ? 'red' : 'green' },
                { label: 'Compliance alerts', value: expiring, tone: expiring ? 'orange' : 'green' },
                { label: 'Exceptions', value: exceptionJobs.length, tone: exceptionJobs.length ? 'red' : 'green' },
              ]}
            />
          </OperationalFilterField>
          <OperationalFilterField label="Quick actions">
            <QuickActionGrid
              actions={[
                { key: 'assignments', label: 'Allocate work', onClick: () => router.push('/admin/fleet/assignments') },
                { key: 'positions', label: 'Open live positions', onClick: () => router.push('/admin/fleet/positions') },
                { key: 'drivers', label: 'Review driver roster', onClick: () => router.push('/admin/drivers') },
                { key: 'maintenance', label: 'Check maintenance', onClick: () => router.push('/admin/fleet/maintenance') },
              ]}
            />
          </OperationalFilterField>
        </OperationalFilters>
      )}
    >
      <PageHeader
        eyebrow="Fleet operations"
        title="Fleet Dashboard"
        description="Capacity, assignments, live positions, maintenance and compliance—ordered by operational urgency."
        actions={<><ActionButton tone="success" onClick={() => router.push('/admin/fleet/assignments')}>Allocate Work</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/positions')}>Live Positions</ActionButton></>}
      />
      {data.error && <AlertBanner>{data.error}</AlertBanner>}
      <KpiGrid>
        <KpiCard label="Available drivers" value={data.drivers.filter((d) => d.availability_status === 'available').length} tone="green" detail="Ready for allocation" onClick={() => router.push('/admin/drivers')} />
        <KpiCard label="Busy drivers" value={data.drivers.filter((d) => d.availability_status === 'busy').length} tone="purple" detail="Assigned or on a job" onClick={() => router.push('/admin/drivers')} />
        <KpiCard label="Offline drivers" value={data.drivers.filter((d) => !d.availability_status || d.availability_status === 'offline').length} tone="navy" detail="Not available now" onClick={() => router.push('/admin/driver-availability')} />
        <KpiCard label="Available vehicles" value={data.vehicles.filter((v) => !v.assigned_driver_id).length} tone="blue" detail={`${data.vehicles.length} total vehicles`} onClick={() => router.push('/admin/vehicles')} />
        <KpiCard label="Unassigned jobs" value={unassignedJobs.length} tone="orange" detail="Driver and vehicle required" onClick={() => router.push('/admin/fleet/assignments')} />
        <KpiCard label="Active jobs" value={activeJobs.length} tone="green" detail="Collections and deliveries" onClick={() => router.push('/admin/fleet/active-jobs')} />
        <KpiCard label="Expiry alerts" value={expiring} tone={expiring ? 'red' : 'green'} detail="Due within 30 days" onClick={() => router.push('/admin/documents/expiry')} />
        <KpiCard label="Exceptions" value={exceptionJobs.length} tone={exceptionJobs.length ? 'red' : 'green'} detail="Failed or disputed jobs" onClick={() => router.push('/admin/incidents')} />
      </KpiGrid>

      <TwoColumn>
        <OperationalCard
          title="Jobs requiring allocation"
          subtitle="Work that cannot progress without a driver and vehicle assignment."
          actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/assignments')}>Assignments</ActionButton>}
          flush
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
        </OperationalCard>
        <div className={styles.roleDashboardColumn}>
          <OperationalCard title="Drivers available now" subtitle="Availability and current assignment status." actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/drivers')}>All drivers</ActionButton>}>
            {data.drivers.filter((d) => d.availability_status === 'available').slice(0, 6).map((driver) => (
              <button key={driver.id} type="button" onClick={() => router.push(`/admin/drivers?driver=${driver.id}`)} className={styles.roleDashboardDriverButton}>
                <span className={styles.roleDashboardDriverCopy}>
                  <strong className={styles.roleDashboardDriverName}>{driver.display_name ?? driver.email ?? 'Driver'}</strong>
                  <span className={styles.roleDashboardDriverMeta}>{driver.phone ?? 'No phone recorded'}</span>
                </span>
                <StatusBadge value="available" tone="green" />
              </button>
            ))}
            {data.drivers.filter((d) => d.availability_status === 'available').length === 0 && <EmptyState title="No drivers marked available" />}
          </OperationalCard>
          <OperationalCard title="Readiness alerts" subtitle="Expiry and location issues that can stop operations.">
            <div className={styles.roleDashboardSummaryList}>
              <button type="button" onClick={() => router.push('/admin/documents/expiry')} className={styles.roleDashboardSummaryButton}><span>Documents expiring</span><strong>{expiring}</strong></button>
              <button type="button" onClick={() => router.push('/admin/fleet/positions')} className={styles.roleDashboardSummaryButton}><span>Stale GPS positions</span><strong>{staleDrivers}</strong></button>
              <button type="button" onClick={() => router.push('/admin/fleet/maintenance')} className={styles.roleDashboardSummaryButton}><span>Unassigned vehicles</span><strong>{data.vehicles.filter((v) => !v.assigned_driver_id).length}</strong></button>
            </div>
          </OperationalCard>
        </div>
      </TwoColumn>

      {activeJobs.length > 0 && (
        <OperationalCard
          title="Active jobs — live operational view"
          subtitle="Jobs currently in transit. Track progress and identify any exceptions early."
          actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/active-jobs')}>Full board</ActionButton>}
          flush
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
        </OperationalCard>
      )}

      {exceptionJobs.length > 0 && (
        <OperationalCard
          title="Exceptions — immediate action required"
          subtitle="Failed, disputed or damaged jobs that need intervention before they escalate."
          actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/incidents')}>Incidents</ActionButton>}
          flush
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
        </OperationalCard>
      )}
    </OperationalPageLayout>
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
        <KpiCard label="Draft invoices" value={totals.draft} />
        <KpiCard label="Outstanding invoices" value={totals.unpaid} tone="orange" />
        <KpiCard label="Overdue invoices" value={totals.overdue} tone="red" />
        <KpiCard label="Outstanding value" value={money(totals.outstanding)} tone="navy" />
        <KpiCard label="Overdue value" value={money(totals.overdueAmount)} tone="red" />
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
        <KpiCard label="Expired" value={expired.length} tone="red" />
        <KpiCard label="Expires in 7 days" value={due7.length} tone="orange" />
        <KpiCard label="Expires in 30 days" value={due30.length} tone="blue" />
        <KpiCard label="Pending verification" value={documents.filter((document) => ['pending', 'under_review'].includes(document.status ?? '')).length} tone="purple" />
        <KpiCard label="Drivers not ready" value={data.drivers.filter((driver) => driver.status !== 'active').length} tone="red" />
      </KpiGrid>
      <Panel title="Priority expiry queue" description="Expired documents first, followed by the nearest expiry date.">
        <DataTable columns={['Document', 'Entity', 'Expiry', 'Status', 'Action']} rows={documents.filter((document) => document.expiry_date).sort((a, b) => new Date(a.expiry_date ?? 0).getTime() - new Date(b.expiry_date ?? 0).getTime()).slice(0, 20).map((document) => [document.doc_type?.replace(/_/g, ' ') ?? 'Document', document.driver_id ? 'Driver' : 'Vehicle', document.expiry_date ? new Date(document.expiry_date).toLocaleDateString('en-GB') : 'Not set', <StatusBadge key="status" value={document.status ?? 'pending'} />, <ActionButton key="action" tone="secondary" onClick={() => router.push('/admin/documents')}>Review</ActionButton>])} />
      </Panel>
    </PageFrame>
  );
}

export default function RoleDashboard() {
  const { user } = useAuth();
  const role = resolveWorkspaceRole(user);
  if (role === 'fleet_manager') return <FleetDashboard />;
  if (role === 'finance') return <FinanceDashboard />;
  if (role === 'compliance') return <ComplianceDashboard />;
  return <CarrierDashboard />;
}
