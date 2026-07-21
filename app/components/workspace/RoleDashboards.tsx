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
const money = (value: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
const formatDate = (value: string | null | undefined) => value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set';
const daysUntil = (value: string | null | undefined) => value ? Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000) : null;

export function CarrierDashboard() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const metrics = useMemo(() => {
    const jobIds = new Set(data.jobs.map((job) => job.id));
    const submittedQuotes = data.bids.filter((bid) => bid.company_id === data.companyId && ['submitted', 'pending'].includes(bid.status)).length;
    const won = data.bids.filter((bid) => bid.company_id === data.companyId && bid.status === 'accepted').length;
    const unallocated = data.jobs.filter((job) => ['awarded', 'posted'].includes(job.status) && !job.assigned_driver_id).length;
    const active = data.jobs.filter((job) => activeStatuses.has(job.current_status ?? job.status)).length;
    const podPending = data.jobs.filter((job) => ['delivered', 'completed'].includes(job.status) && (job.delivery_photos?.length ?? 0) === 0).length;
    const overdueInvoices = data.invoices.filter((invoice) => invoice.due_date && new Date(invoice.due_date).getTime() < Date.now() && !['paid', 'Paid'].includes(invoice.status) && invoice.payment_status !== 'paid').length;
    const acceptedRevenue = data.bids.filter((bid) => jobIds.has(bid.job_id) && bid.status === 'accepted').reduce((sum, bid) => sum + Number(bid.bid_price_gbp ?? bid.amount ?? 0), 0);
    return { submittedQuotes, won, unallocated, active, podPending, overdueInvoices, acceptedRevenue };
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
        <KpiCard label="Quotes submitted" value={metrics.submittedQuotes} detail="Awaiting a commercial decision" />
        <KpiCard label="Won work" value={metrics.won} detail="Accepted carrier quotes" tone="green" />
        <KpiCard label="Awaiting allocation" value={metrics.unallocated} detail="Jobs requiring driver and vehicle" tone="orange" onClick={() => router.push('/admin/diary')} />
        <KpiCard label="Active jobs" value={metrics.active} detail="Collections and deliveries in progress" tone="purple" />
        <KpiCard label="POD outstanding" value={metrics.podPending} detail="Delivered jobs missing proof" tone="red" />
        <KpiCard label="Overdue invoices" value={metrics.overdueInvoices} detail={`${money(metrics.acceptedRevenue)} won work value`} tone="navy" />
      </KpiGrid>
      <TwoColumn>
        <Panel title="Jobs requiring attention" description="Unallocated, active and POD-pending work is prioritised before general reporting." actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/jobs')}>All jobs</ActionButton>}>
          <DataTable
            columns={['Route', 'Pickup', 'Vehicle', 'Status', 'Action']}
            rows={data.jobs.filter((job) => !terminalStatuses.has(job.status)).slice(0, 8).map((job) => [
              <strong key="route">{job.pickup_location ?? job.pickup_postcode ?? 'Collection'} → {job.delivery_location ?? job.delivery_postcode ?? 'Delivery'}</strong>,
              formatDate(job.pickup_datetime),
              (job.vehicle_type ?? 'Not specified').replace(/_/g, ' '),
              <StatusBadge key="status" value={job.current_status ?? job.status} />,
              <ActionButton key="action" tone="secondary" onClick={() => router.push(`/admin/jobs?job=${job.id}`)}>Open</ActionButton>,
            ])}
            empty={<EmptyState title="No jobs need attention" description="Won work and active jobs will appear here." />}
          />
        </Panel>
        <div style={{ display: 'grid', gap: '0.9rem' }}>
          <Panel title="Resource readiness" description="Live capacity from your company roster.">
            <div style={{ display: 'grid', gap: '0.58rem' }}>
              {[
                ['Available drivers', data.drivers.filter((driver) => driver.availability_status === 'available').length, '/admin/drivers'],
                ['Busy drivers', data.drivers.filter((driver) => driver.availability_status === 'busy').length, '/admin/drivers'],
                ['Vehicles', data.vehicles.length, '/admin/vehicles'],
                ['Unassigned vehicles', data.vehicles.filter((vehicle) => !vehicle.assigned_driver_id).length, '/admin/vehicles'],
              ].map(([label, value, href]) => <button key={String(label)} onClick={() => router.push(String(href))} style={{ display: 'flex', justifyContent: 'space-between', border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '8px', padding: '0.62rem 0.7rem', cursor: 'pointer', color: '#0f172a', fontWeight: 750 }}><span>{label}</span><strong>{value}</strong></button>)}
            </div>
          </Panel>
          <Panel title="Compliance alerts" description="Documents expiring within 30 days.">
            {data.driverDocuments.concat(data.vehicleDocuments).filter((document) => { const days = daysUntil(document.expiry_date); return days !== null && days <= 30; }).slice(0, 5).map((document) => (
              <div key={document.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', padding: '0.55rem 0', borderBottom: '1px solid #eef2f6', fontSize: '0.76rem' }}>
                <span>{document.doc_type?.replace(/_/g, ' ') ?? 'Document'}</span>
                <StatusBadge value={document.expiry_date ? `${daysUntil(document.expiry_date)} days` : 'missing'} tone="orange" />
              </div>
            ))}
            {data.driverDocuments.concat(data.vehicleDocuments).filter((document) => { const days = daysUntil(document.expiry_date); return days !== null && days <= 30; }).length === 0 && <EmptyState title="No expiry alerts" description="No driver or vehicle document expires within 30 days." />}
          </Panel>
        </div>
      </TwoColumn>
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
  const expiring = data.driverDocuments.concat(data.vehicleDocuments).filter((document) => { const days = daysUntil(document.expiry_date); return days !== null && days <= 30; }).length;
  const unassignedJobs = data.jobs.filter((job) => ['posted', 'awarded'].includes(job.status) && !job.assigned_driver_id).length;
  const activeJobs = data.jobs.filter((job) => activeStatuses.has(job.current_status ?? job.status)).length;

  return (
    <PageFrame>
      <PageHeader eyebrow="Fleet operations" title="Fleet Dashboard" description="Capacity, assignments, live positions, maintenance and compliance—ordered by operational urgency." actions={<><ActionButton tone="success" onClick={() => router.push('/admin/fleet/assignments')}>Allocate Work</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/positions')}>Live Positions</ActionButton></>} />
      {data.error && <AlertBanner>{data.error}</AlertBanner>}
      <KpiGrid>
        <KpiCard label="Available drivers" value={data.drivers.filter((driver) => driver.availability_status === 'available').length} tone="green" detail="Ready for allocation" />
        <KpiCard label="Busy drivers" value={data.drivers.filter((driver) => driver.availability_status === 'busy').length} tone="purple" detail="Assigned or on a job" />
        <KpiCard label="Offline drivers" value={data.drivers.filter((driver) => !driver.availability_status || driver.availability_status === 'offline').length} tone="navy" detail="Not available now" />
        <KpiCard label="Available vehicles" value={data.vehicles.filter((vehicle) => !vehicle.assigned_driver_id).length} tone="blue" detail={`${data.vehicles.length} total vehicles`} />
        <KpiCard label="Unassigned jobs" value={unassignedJobs} tone="orange" detail="Driver and vehicle required" onClick={() => router.push('/admin/fleet/assignments')} />
        <KpiCard label="Active jobs" value={activeJobs} tone="green" detail="Collections and deliveries" />
        <KpiCard label="Expiry alerts" value={expiring} tone="red" detail="Due within 30 days" onClick={() => router.push('/admin/documents/expiry')} />
        <KpiCard label="Stale positions" value={staleDrivers} tone="red" detail="No location within 20 minutes" onClick={() => router.push('/admin/fleet/positions')} />
      </KpiGrid>
      <TwoColumn>
        <Panel title="Jobs requiring allocation" description="Only work that cannot progress without a resource decision." actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/assignments')}>Assignments</ActionButton>}>
          <DataTable
            columns={['Route', 'Pickup', 'Required vehicle', 'Status', 'Action']}
            rows={data.jobs.filter((job) => ['posted', 'awarded'].includes(job.status) && !job.assigned_driver_id).slice(0, 8).map((job) => [
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
          <Panel title="Drivers available now" description="Availability and current assignment status.">
            {data.drivers.filter((driver) => driver.availability_status === 'available').slice(0, 7).map((driver) => (
              <button key={driver.id} onClick={() => router.push(`/admin/drivers?driver=${driver.id}`)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', gap: '0.5rem', border: 0, borderBottom: '1px solid #eef2f6', background: 'transparent', padding: '0.58rem 0', cursor: 'pointer', textAlign: 'left' }}>
                <span><strong style={{ display: 'block', fontSize: '0.78rem' }}>{driver.display_name ?? driver.email ?? 'Driver'}</strong><span style={{ color: '#64748b', fontSize: '0.68rem' }}>{driver.phone ?? 'No phone recorded'}</span></span>
                <StatusBadge value="available" tone="green" />
              </button>
            ))}
            {data.drivers.filter((driver) => driver.availability_status === 'available').length === 0 && <EmptyState title="No drivers marked available" />}
          </Panel>
          <Panel title="Readiness alerts" description="Expiry and location issues that can stop operations.">
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <button onClick={() => router.push('/admin/documents/expiry')} style={{ display: 'flex', justifyContent: 'space-between', border: '1px solid #e2e8f0', background: '#fff7ed', borderRadius: '8px', padding: '0.62rem', cursor: 'pointer' }}><span>Documents expiring</span><strong>{expiring}</strong></button>
              <button onClick={() => router.push('/admin/fleet/positions')} style={{ display: 'flex', justifyContent: 'space-between', border: '1px solid #e2e8f0', background: '#fef2f2', borderRadius: '8px', padding: '0.62rem', cursor: 'pointer' }}><span>Stale GPS positions</span><strong>{staleDrivers}</strong></button>
              <button onClick={() => router.push('/admin/fleet/maintenance')} style={{ display: 'flex', justifyContent: 'space-between', border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '8px', padding: '0.62rem', cursor: 'pointer' }}><span>Vehicles without driver</span><strong>{data.vehicles.filter((vehicle) => !vehicle.assigned_driver_id).length}</strong></button>
            </div>
          </Panel>
        </div>
      </TwoColumn>
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

export default function RoleDashboard() {
  const { user } = useAuth();
  const role = user?.workspaceRole ?? resolveWorkspaceRole(user);
  if (role === 'fleet_manager') return <FleetDashboard />;
  if (role === 'finance') return <FinanceDashboard />;
  if (role === 'compliance') return <ComplianceDashboard />;
  return <CarrierDashboard />;
}
