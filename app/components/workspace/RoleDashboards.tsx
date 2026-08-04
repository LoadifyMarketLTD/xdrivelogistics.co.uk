'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../AuthContext';
import { resolveWorkspaceRole } from '../../../lib/workspaceRole';
import { useCompanyWorkspaceData } from './useCompanyWorkspaceData';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  KpiCard,
  KpiGrid,
  PageFrame,
  PageHeader,
  Panel,
  StatusBadge,
  TwoColumn,
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
    <PageFrame>
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
            <div style={{ display: 'grid', gap: '0.58rem' }}>
              {[
                ['Available drivers', data.drivers.filter((d) => d.availability_status === 'available').length, '/admin/drivers'],
                ['Busy drivers', data.drivers.filter((d) => d.availability_status === 'busy').length, '/admin/drivers'],
                ['Total vehicles', data.vehicles.length, '/admin/vehicles'],
                ['Unassigned vehicles', data.vehicles.filter((v) => !v.assigned_driver_id).length, '/admin/vehicles'],
              ].map(([label, value, href]) => (
                <button key={String(label)} onClick={() => router.push(String(href))} style={{ display: 'flex', justifyContent: 'space-between', border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '8px', padding: '0.62rem 0.7rem', cursor: 'pointer', color: '#0f172a', fontWeight: 750 }}>
                  <span>{label}</span><strong>{value}</strong>
                </button>
              ))}
            </div>
          </Panel>
          <Panel title="Commercial shortcuts" description="Fast access to the carrier workflow.">
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {[
                ['Find marketplace loads', '/admin/marketplace'],
                ['Review submitted quotes', '/admin/quotes'],
                ['Allocate awarded work', '/admin/fleet/assignments'],
                ['Track active jobs', '/admin/fleet/active-jobs'],
                ['Open invoices', '/admin/invoices'],
              ].map(([label, href]) => (
                <button key={href} onClick={() => router.push(href)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '8px', padding: '0.62rem 0.7rem', cursor: 'pointer', color: '#0f172a', fontSize: '0.76rem' }}>
                  <span>{label}</span><span>→</span>
                </button>
              ))}
            </div>
          </Panel>
          <Panel title="Compliance alerts" description="Documents expiring within 30 days." actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/documents/expiry')}>View all</ActionButton>}>
            {data.driverDocuments.concat(data.vehicleDocuments).filter((doc) => { const d = daysUntil(doc.expiry_date); return d !== null && d <= 30; }).slice(0, 5).map((doc) => (
              <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', padding: '0.55rem 0', borderBottom: '1px solid #eef2f6', fontSize: '0.76rem' }}>
                <span>{doc.doc_type?.replace(/_/g, ' ') ?? 'Document'}</span>
                <StatusBadge value={doc.expiry_date ? `${daysUntil(doc.expiry_date)} days` : 'missing'} tone="orange" />
              </div>
            ))}
            {data.driverDocuments.concat(data.vehicleDocuments).filter((doc) => { const d = daysUntil(doc.expiry_date); return d !== null && d <= 30; }).length === 0 && <EmptyState title="No expiry alerts" description="No driver or vehicle document expires within 30 days." />}
          </Panel>
        </div>
      </TwoColumn>

      <Panel
        title="Revenue & finance overview"
        description="Financial position based on accepted bids, raised invoices and payment receipts."
        actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/invoices')}>Finance</ActionButton>}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.7rem' }}>
          {[
            ['Won work value', money(metrics.acceptedRevenue), 'Accepted bids total', '#f0fdf4', '#166534'],
            ['Invoiced', money(metrics.invoicedValue), 'Raised to customers', '#eff6ff', '#1e40af'],
            ['Paid', money(metrics.paidValue), 'Received payments', '#faf5ff', '#6b21a8'],
            ['Outstanding', money(Math.max(0, metrics.invoicedValue - metrics.paidValue)), 'Awaiting payment', metrics.invoicedValue - metrics.paidValue > 0 ? '#fff7ed' : '#f0fdf4', metrics.invoicedValue - metrics.paidValue > 0 ? '#c2410c' : '#166534'],
          ].map(([label, value, detail, bg, color]) => (
            <div key={String(label)} style={{ background: String(bg), border: `1px solid ${String(color)}20`, borderRadius: '10px', padding: '0.9rem 1rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: String(color), marginTop: '0.2rem' }}>{value}</div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.15rem' }}>{detail}</div>
            </div>
          ))}
        </div>
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

export function AdminDashboard() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();

  const metrics = useMemo(() => {
    const liveJobs = data.jobs.filter((j) => activeStatuses.has(j.current_status ?? j.status));
    const exceptions = data.jobs.filter((j) => exceptionStatuses.has(j.current_status ?? j.status));
    const unallocated = data.jobs.filter(
      (j) => ['awarded', 'posted'].includes(j.status) && !j.assigned_driver_id,
    );
    const podPending = data.jobs.filter(
      (j) =>
        ['delivered', 'completed'].includes(j.status) &&
        (j.delivery_photos?.length ?? 0) === 0,
    );
    const docs = data.driverDocuments.concat(data.vehicleDocuments);
    const expiredDocs = docs.filter((d) => {
      const days = daysUntil(d.expiry_date);
      return days !== null && days < 0;
    });
    const expiringSoon = docs.filter((d) => {
      const days = daysUntil(d.expiry_date);
      return days !== null && days >= 0 && days <= 30;
    });
    const pendingVerification = docs.filter((d) =>
      ['pending', 'under_review'].includes(d.status ?? ''),
    );
    const overdueInvoices = data.invoices.filter(
      (inv) =>
        inv.due_date &&
        new Date(inv.due_date).getTime() < Date.now() &&
        !['paid', 'Paid', 'void'].includes(inv.status) &&
        inv.payment_status !== 'paid',
    );
    const draftInvoices = data.invoices.filter((inv) =>
      ['draft', 'Draft'].includes(inv.status),
    );
    const availableDrivers = data.drivers.filter(
      (d) => d.availability_status === 'available',
    );
    const busyDrivers = data.drivers.filter((d) => d.availability_status === 'busy');
    const offlineDrivers = data.drivers.filter(
      (d) => !d.availability_status || d.availability_status === 'offline',
    );
    const unassignedVehicles = data.vehicles.filter((v) => !v.assigned_driver_id);
    return {
      liveJobs,
      exceptions,
      unallocated,
      podPending,
      expiredDocs,
      expiringSoon,
      pendingVerification,
      overdueInvoices,
      draftInvoices,
      availableDrivers,
      busyDrivers,
      offlineDrivers,
      unassignedVehicles,
    };
  }, [data]);

  const urgentExceptions = metrics.exceptions.slice(0, 6);
  const pendingAllocation = metrics.unallocated.slice(0, 8);
  const liveJobRows = metrics.liveJobs.slice(0, 8);

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Admin · Operations Command Centre"
        title="Admin Dashboard"
        description="Live jobs, dispatch, fleet readiness, compliance and finance exceptions — all operational decisions in one place."
        actions={
          <>
            <ActionButton tone="warning" onClick={() => router.push('/admin/operations-centre')}>
              Operations Centre
            </ActionButton>
            <ActionButton tone="primary" onClick={() => router.push('/admin/action-centre')}>
              Action Centre
            </ActionButton>
          </>
        }
      />

      {data.error && (
        <div
          style={{
            background: '#fff7ed',
            border: '1px solid #fed7aa',
            borderRadius: '4px',
            padding: '8px 10px',
            fontSize: '12px',
            color: '#92400e',
            marginBottom: '12px',
          }}
        >
          {data.error}
        </div>
      )}

      {/* KPI strip — max 6, operational decisions only */}
      <KpiGrid>
        <KpiCard
          label="Live jobs"
          value={metrics.liveJobs.length}
          detail="Active collections & deliveries"
          tone="blue"
          onClick={() => router.push('/admin/fleet/active-jobs')}
        />
        <KpiCard
          label="Exceptions"
          value={metrics.exceptions.length}
          detail="Failed, disputed or blocked"
          tone={metrics.exceptions.length > 0 ? 'red' : 'green'}
          onClick={() => router.push('/admin/incidents')}
        />
        <KpiCard
          label="Pending dispatch"
          value={metrics.unallocated.length}
          detail="Awarded, awaiting allocation"
          tone={metrics.unallocated.length > 0 ? 'orange' : 'green'}
          onClick={() => router.push('/admin/fleet/assignments')}
        />
        <KpiCard
          label="POD outstanding"
          value={metrics.podPending.length}
          detail="Delivered, proof missing"
          tone={metrics.podPending.length > 0 ? 'orange' : 'green'}
          onClick={() => router.push('/admin/documents?view=pod')}
        />
        <KpiCard
          label="Compliance alerts"
          value={metrics.expiredDocs.length + metrics.expiringSoon.length}
          detail={`${metrics.expiredDocs.length} expired · ${metrics.pendingVerification.length} pending`}
          tone={metrics.expiredDocs.length > 0 ? 'red' : metrics.expiringSoon.length > 0 ? 'orange' : 'green'}
          onClick={() => router.push('/admin/documents/expiry')}
        />
        <KpiCard
          label="Finance alerts"
          value={metrics.overdueInvoices.length}
          detail={`${metrics.draftInvoices.length} drafts outstanding`}
          tone={metrics.overdueInvoices.length > 0 ? 'red' : 'navy'}
          onClick={() => router.push('/admin/invoices')}
        />
      </KpiGrid>

      {/* Row 1: exceptions + driver/vehicle availability */}
      <TwoColumn>
        <Panel
          title="Operational exceptions"
          description="Jobs in failed, disputed, cancelled or breakdown state requiring admin action."
          actions={
            <ActionButton tone="danger" onClick={() => router.push('/admin/incidents')}>
              All incidents
            </ActionButton>
          }
        >
          <DataTable
            columns={['Route', 'Pickup', 'Exception', 'Action']}
            rows={
              urgentExceptions.length > 0
                ? urgentExceptions.map((job) => [
                    <strong key="route" style={{ fontSize: '12px' }}>
                      {job.pickup_location ?? job.pickup_postcode ?? 'Collection'} →{' '}
                      {job.delivery_location ?? job.delivery_postcode ?? 'Delivery'}
                    </strong>,
                    formatDate(job.pickup_datetime),
                    <StatusBadge key="status" value={job.current_status ?? job.status} tone="red" />,
                    <ActionButton
                      key="action"
                      tone="danger"
                      onClick={() => router.push(`/admin/jobs/${job.id}`)}
                    >
                      Resolve
                    </ActionButton>,
                  ])
                : []
            }
            empty={
              <EmptyState
                title="No exceptions"
                description="All jobs are progressing normally."
              />
            }
          />
        </Panel>

        <div style={{ display: 'grid', gap: '10px' }}>
          {/* Driver availability */}
          <Panel
            title="Driver & vehicle readiness"
            description="Live capacity for immediate dispatch decisions."
            actions={
              <ActionButton tone="secondary" onClick={() => router.push('/admin/drivers')}>
                Drivers
              </ActionButton>
            }
          >
            <div style={{ display: 'grid', gap: '6px' }}>
              {(
                [
                  [
                    `Available (${metrics.availableDrivers.length})`,
                    metrics.availableDrivers.length,
                    '#198754',
                    '/admin/driver-availability',
                  ],
                  [
                    `Busy (${metrics.busyDrivers.length})`,
                    metrics.busyDrivers.length,
                    '#1D57D8',
                    '/admin/drivers',
                  ],
                  [
                    `Offline (${metrics.offlineDrivers.length})`,
                    metrics.offlineDrivers.length,
                    '#64748B',
                    '/admin/driver-availability',
                  ],
                  [
                    `Unassigned vehicles (${metrics.unassignedVehicles.length})`,
                    metrics.unassignedVehicles.length,
                    '#F5A300',
                    '/admin/vehicles',
                  ],
                ] as [string, number, string, string][]
              ).map(([label, , color, href]) => (
                <button
                  key={href + label}
                  onClick={() => router.push(href)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    border: '1px solid #D8DEE8',
                    borderLeft: `3px solid ${color}`,
                    background: '#F4F6F8',
                    borderRadius: '4px',
                    padding: '6px 10px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: '#1A1F2B',
                    fontWeight: 600,
                    textAlign: 'left',
                  }}
                >
                  <span>{label}</span>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>→</span>
                </button>
              ))}
            </div>
          </Panel>

          {/* Compliance summary */}
          <Panel
            title="Compliance summary"
            actions={
              <ActionButton tone="secondary" onClick={() => router.push('/admin/documents/expiry')}>
                View expiry
              </ActionButton>
            }
          >
            <div style={{ display: 'grid', gap: '6px' }}>
              {(
                [
                  ['Expired documents', metrics.expiredDocs.length, '#C62828', '/admin/documents/expiry'],
                  ['Expiring ≤30 days', metrics.expiringSoon.length, '#F5A300', '/admin/documents/expiry'],
                  ['Pending verification', metrics.pendingVerification.length, '#1D57D8', '/admin/documents'],
                ] as [string, number, string, string][]
              ).map(([label, count, color, href]) => (
                <button
                  key={label}
                  onClick={() => router.push(href)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    border: '1px solid #D8DEE8',
                    borderLeft: `3px solid ${color}`,
                    background: count > 0 ? '#fff' : '#F4F6F8',
                    borderRadius: '4px',
                    padding: '6px 10px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: '#1A1F2B',
                    fontWeight: 600,
                    textAlign: 'left',
                  }}
                >
                  <span>{label}</span>
                  <span
                    style={{
                      fontWeight: 700,
                      color: count > 0 ? color : '#64748B',
                    }}
                  >
                    {count}
                  </span>
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </TwoColumn>

      {/* Row 2: pending allocations table */}
      <Panel
        title="Pending allocations — dispatch queue"
        description="Awarded jobs requiring driver and vehicle assignment. Prioritised by pickup time."
        actions={
          <>
            <ActionButton tone="secondary" onClick={() => router.push('/admin/diary')}>
              Diary
            </ActionButton>
            <ActionButton tone="success" onClick={() => router.push('/admin/fleet/assignments')}>
              Assign drivers
            </ActionButton>
          </>
        }
      >
        <DataTable
          columns={['Job ref', 'Route', 'Pickup', 'Vehicle', 'Status', 'Action']}
          rows={
            pendingAllocation.length > 0
              ? pendingAllocation.map((job) => [
                  <span key="ref" style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>
                    {job.id.slice(0, 8).toUpperCase()}
                  </span>,
                  <span key="route" style={{ fontSize: '12px', fontWeight: 600 }}>
                    {job.pickup_location ?? job.pickup_postcode ?? 'TBC'} →{' '}
                    {job.delivery_location ?? job.delivery_postcode ?? 'TBC'}
                  </span>,
                  formatDate(job.pickup_datetime),
                  (job.vehicle_type ?? 'Not set').replace(/_/g, ' '),
                  <StatusBadge key="status" value={job.current_status ?? job.status} />,
                  <ActionButton
                    key="action"
                    tone="warning"
                    onClick={() => router.push(`/admin/fleet/assignments`)}
                  >
                    Allocate
                  </ActionButton>,
                ])
              : []
          }
          empty={
            <EmptyState
              title="No jobs awaiting allocation"
              description="All awarded jobs have been assigned to a driver and vehicle."
            />
          }
        />
      </Panel>

      {/* Row 3: live jobs + operational shortcuts */}
      <TwoColumn>
        <Panel
          title="Live jobs"
          description="Active collections and deliveries in progress right now."
          actions={
            <ActionButton tone="secondary" onClick={() => router.push('/admin/jobs')}>
              All jobs
            </ActionButton>
          }
        >
          <DataTable
            columns={['Route', 'Pickup', 'Vehicle', 'Status', 'Action']}
            rows={
              liveJobRows.length > 0
                ? liveJobRows.map((job) => [
                    <span key="route" style={{ fontSize: '12px', fontWeight: 600 }}>
                      {job.pickup_location ?? job.pickup_postcode ?? 'Collection'} →{' '}
                      {job.delivery_location ?? job.delivery_postcode ?? 'Delivery'}
                    </span>,
                    formatDate(job.pickup_datetime),
                    (job.vehicle_type ?? 'Not set').replace(/_/g, ' '),
                    <StatusBadge key="status" value={job.current_status ?? job.status} />,
                    <ActionButton
                      key="action"
                      tone="secondary"
                      onClick={() => router.push(`/admin/jobs/${job.id}`)}
                    >
                      Open
                    </ActionButton>,
                  ])
                : []
            }
            empty={
              <EmptyState title="No live jobs" description="No active collections or deliveries." />
            }
          />
        </Panel>

        <div style={{ display: 'grid', gap: '10px' }}>
          {/* POD exceptions */}
          <Panel
            title="POD & delivery exceptions"
            actions={
              <ActionButton tone="secondary" onClick={() => router.push('/admin/documents?view=pod')}>
                View PODs
              </ActionButton>
            }
          >
            <DataTable
              columns={['Route', 'Action']}
              rows={metrics.podPending.slice(0, 4).map((job) => [
                <span key="route" style={{ fontSize: '12px' }}>
                  {job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}
                </span>,
                <ActionButton
                  key="action"
                  tone="primary"
                  onClick={() => router.push(`/admin/jobs/${job.id}`)}
                >
                  Upload POD
                </ActionButton>,
              ])}
              empty={
                <EmptyState
                  title="No POD exceptions"
                  description="All delivered jobs have proof of delivery."
                />
              }
            />
          </Panel>

          {/* Operational shortcuts */}
          <Panel title="Operational shortcuts">
            <div style={{ display: 'grid', gap: '5px' }}>
              {(
                [
                  ['Fleet assignments', '/admin/fleet/assignments'],
                  ['Fleet positions', '/admin/fleet/positions'],
                  ['Active jobs', '/admin/fleet/active-jobs'],
                  ['Marketplace', '/admin/marketplace'],
                  ['Operations diary', '/admin/diary'],
                  ['Disputes & incidents', '/admin/incidents'],
                  ['Invoice register', '/admin/invoices'],
                  ['Quote requests', '/admin/quotes'],
                  ['Finance reports', '/admin/finance/reports'],
                  ['All companies', '/admin/companies'],
                ] as [string, string][]
              ).map(([label, href]) => (
                <button
                  key={href}
                  onClick={() => router.push(href)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    border: '1px solid #D8DEE8',
                    background: '#F4F6F8',
                    borderRadius: '4px',
                    padding: '5px 10px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: '#1A1F2B',
                    textAlign: 'left',
                  }}
                >
                  <span>{label}</span>
                  <span style={{ color: '#1D57D8', fontSize: '11px' }}>→</span>
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </TwoColumn>
    </PageFrame>
  );
}

export default function RoleDashboard() {
  const { user } = useAuth();
  const role = resolveWorkspaceRole(user);
  if (role === 'platform_owner') return <AdminDashboard />;
  if (role === 'fleet_manager') return <FleetDashboard />;
  if (role === 'finance') return <FinanceDashboard />;
  if (role === 'compliance') return <ComplianceDashboard />;
  return <CarrierDashboard />;
}
