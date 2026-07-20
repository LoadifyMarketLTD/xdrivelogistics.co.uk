'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../AuthContext';
import { resolveWorkspaceRole } from '../../../lib/workspaceRole';
import { ActionButton, AlertBanner, DataTable, EmptyState, KpiCard, KpiGrid, PageFrame, PageHeader, Panel, StatusBadge, TwoColumn } from './WorkspaceUI';
import { useCompanyWorkspaceData } from './useCompanyWorkspaceData';

const activeStatuses = new Set(['awarded', 'allocated', 'assigned', 'accepted', 'on_my_way_to_pickup', 'on_site_pickup', 'loaded', 'collected', 'in_transit', 'on_my_way_to_delivery', 'on_site_delivery', 'in_progress']);
const money = (value: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
const dateTime = (value?: string | null) => value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set';
const daysUntil = (value?: string | null) => value ? Math.ceil((new Date(value).getTime() - Date.now()) / 86400000) : null;

export function CarrierDashboard() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const wonJobs = data.jobs.filter(job => job.awarded_carrier_company_id === data.companyId || ['awarded', 'allocated', 'assigned'].includes(job.status));
  const active = data.jobs.filter(job => activeStatuses.has(job.current_status ?? job.status));
  const awaitingAllocation = wonJobs.filter(job => !job.assigned_driver_id);
  const expiring = data.driverDocuments.concat(data.vehicleDocuments).filter(document => { const days = daysUntil(document.expiry_date); return days !== null && days <= 30; }).length;
  const unpaid = data.invoices.filter(invoice => invoice.payment_status !== 'paid' && !['paid', 'Paid', 'void'].includes(invoice.status));
  return <PageFrame>
    <PageHeader eyebrow="Transport company" title="Carrier Dashboard" description="Marketplace, quotes, won work, daily operations, drivers, vehicles, compliance and receivables." actions={<><ActionButton tone="success" onClick={() => router.push('/admin/marketplace')}>Find Loads</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/admin/diary')}>Open Diary</ActionButton></>} />
    {data.error && <AlertBanner>{data.error}</AlertBanner>}
    <KpiGrid>
      <KpiCard label="Marketplace loads" value={data.jobs.filter(job => ['posted', 'open'].includes(job.status) && job.company_id !== data.companyId).length} detail="Visible opportunities" onClick={() => router.push('/admin/marketplace')} />
      <KpiCard label="Quotes submitted" value={data.bids.filter(bid => bid.company_id === data.companyId && bid.status === 'submitted').length} tone="purple" onClick={() => router.push('/admin/quotes')} />
      <KpiCard label="Won work" value={wonJobs.length} tone="green" />
      <KpiCard label="Awaiting allocation" value={awaitingAllocation.length} tone="orange" onClick={() => router.push('/admin/diary')} />
      <KpiCard label="Active jobs" value={active.length} tone="green" onClick={() => router.push('/admin/jobs')} />
      <KpiCard label="Available drivers" value={data.drivers.filter(driver => driver.availability_status === 'available').length} tone="blue" />
      <KpiCard label="Expiry alerts" value={expiring} tone={expiring ? 'red' : 'green'} onClick={() => router.push('/admin/documents')} />
      <KpiCard label="Outstanding invoices" value={unpaid.length} detail={money(unpaid.reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0))} tone="navy" onClick={() => router.push('/admin/invoices')} />
    </KpiGrid>
    <TwoColumn>
      <Panel title="Operational priorities" description="Won jobs that still require a driver and vehicle decision.">
        <DataTable columns={['Route', 'Pickup', 'Vehicle', 'Status', 'Action']} rows={awaitingAllocation.slice(0, 8).map(job => [<strong key="route">{job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}</strong>, dateTime(job.pickup_datetime), (job.vehicle_type ?? 'Not specified').replace(/_/g, ' '), <StatusBadge key="status" value={job.status} />, <ActionButton key="action" tone="success" onClick={() => router.push(`/admin/diary?job=${job.id}`)}>Allocate</ActionButton>])} empty={<EmptyState title="No jobs awaiting allocation" />} />
      </Panel>
      <Panel title="Readiness" description="Capacity and compliance requiring attention.">
        <DataTable columns={['Area', 'Count', 'Open']} rows={[
          ['Drivers available', data.drivers.filter(driver => driver.availability_status === 'available').length, <ActionButton key="drivers" tone="secondary" onClick={() => router.push('/admin/drivers')}>Drivers</ActionButton>],
          ['Vehicles without driver', data.vehicles.filter(vehicle => !vehicle.assigned_driver_id).length, <ActionButton key="vehicles" tone="secondary" onClick={() => router.push('/admin/vehicles')}>Vehicles</ActionButton>],
          ['Documents expiring', expiring, <ActionButton key="documents" tone="secondary" onClick={() => router.push('/admin/documents')}>Documents</ActionButton>],
        ]} />
      </Panel>
    </TwoColumn>
  </PageFrame>;
}

export function FleetDashboard() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const unassigned = data.jobs.filter(job => ['posted', 'awarded', 'allocated'].includes(job.status) && !job.assigned_driver_id);
  const active = data.jobs.filter(job => activeStatuses.has(job.current_status ?? job.status));
  const documentAlerts = data.driverDocuments.concat(data.vehicleDocuments).filter(document => { const days = daysUntil(document.expiry_date); return days !== null && days <= 30; }).length;
  const lastLocation = new Map<string, number>();
  data.locations.forEach(location => { const timestamp = new Date(location.recorded_at ?? location.updated_at ?? 0).getTime(); if (!lastLocation.has(location.driver_id) || timestamp > (lastLocation.get(location.driver_id) ?? 0)) lastLocation.set(location.driver_id, timestamp); });
  const stale = data.drivers.filter(driver => { const time = lastLocation.get(driver.id); return Boolean(time && Date.now() - time > 20 * 60 * 1000); }).length;
  return <PageFrame>
    <PageHeader eyebrow="Fleet operations" title="Fleet Dashboard" description="Drivers, vehicles, assignments, live positions, maintenance, compliance and future capacity." actions={<><ActionButton tone="success" onClick={() => router.push('/admin/fleet/assignments')}>Allocate Work</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/positions')}>Live Positions</ActionButton></>} />
    {data.error && <AlertBanner>{data.error}</AlertBanner>}
    <KpiGrid>
      <KpiCard label="Available drivers" value={data.drivers.filter(driver => driver.availability_status === 'available').length} tone="green" detail="Ready for allocation" />
      <KpiCard label="Busy drivers" value={data.drivers.filter(driver => driver.availability_status === 'busy').length} tone="purple" />
      <KpiCard label="Offline drivers" value={data.drivers.filter(driver => !driver.availability_status || driver.availability_status === 'offline').length} tone="navy" />
      <KpiCard label="Available vehicles" value={data.vehicles.filter(vehicle => !vehicle.assigned_driver_id).length} detail={`${data.vehicles.length} total vehicles`} />
      <KpiCard label="Unassigned jobs" value={unassigned.length} tone="orange" onClick={() => router.push('/admin/fleet/assignments')} />
      <KpiCard label="Active jobs" value={active.length} tone="green" onClick={() => router.push('/admin/fleet/active-jobs')} />
      <KpiCard label="Expiry alerts" value={documentAlerts} tone={documentAlerts ? 'red' : 'green'} onClick={() => router.push('/admin/documents/expiry')} />
      <KpiCard label="Stale positions" value={stale} tone={stale ? 'red' : 'green'} onClick={() => router.push('/admin/fleet/positions')} />
    </KpiGrid>
    <TwoColumn>
      <Panel title="Jobs requiring allocation" description="Work that cannot progress without a resource decision." actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/assignments')}>Assignments</ActionButton>}>
        <DataTable columns={['Route', 'Pickup', 'Required vehicle', 'Status', 'Action']} rows={unassigned.slice(0, 10).map(job => [<strong key="route">{job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}</strong>, dateTime(job.pickup_datetime), (job.vehicle_type ?? 'Not specified').replace(/_/g, ' '), <StatusBadge key="status" value={job.current_status ?? job.status} />, <ActionButton key="action" tone="success" onClick={() => router.push(`/admin/diary?job=${job.id}`)}>Allocate</ActionButton>])} empty={<EmptyState title="No unassigned jobs" description="All current jobs have a resource allocation or are not ready for allocation." />} />
      </Panel>
      <div style={{ display: 'grid', gap: '0.9rem' }}>
        <Panel title="Drivers available now">{data.drivers.filter(driver => driver.availability_status === 'available').slice(0, 7).map(driver => <button key={driver.id} onClick={() => router.push(`/admin/drivers?driver=${driver.id}`)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', border: 0, borderBottom: '1px solid #eef2f6', background: 'transparent', padding: '0.58rem 0', cursor: 'pointer', textAlign: 'left' }}><span><strong style={{ display: 'block' }}>{driver.display_name ?? driver.email ?? 'Driver'}</strong><span style={{ color: '#64748b', fontSize: '0.68rem' }}>{driver.phone ?? 'No phone recorded'}</span></span><StatusBadge value="available" tone="green" /></button>)}{!data.drivers.some(driver => driver.availability_status === 'available') && <EmptyState title="No drivers marked available" />}</Panel>
        <Panel title="Readiness alerts"><DataTable columns={['Alert', 'Count']} rows={[["Documents expiring", documentAlerts], ["Stale GPS positions", stale], ["Vehicles without driver", data.vehicles.filter(vehicle => !vehicle.assigned_driver_id).length]]} /></Panel>
      </div>
    </TwoColumn>
  </PageFrame>;
}

export function FinanceDashboard() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const unpaid = data.invoices.filter(invoice => invoice.payment_status !== 'paid' && !['paid', 'Paid', 'void'].includes(invoice.status));
  const overdue = unpaid.filter(invoice => invoice.due_date && new Date(invoice.due_date).getTime() < Date.now());
  return <PageFrame><PageHeader eyebrow="Finance" title="Finance Dashboard" description="Invoice issuance, payment status, balances and exceptions without operational edit permissions." actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/invoices')}>Open Invoices</ActionButton>} /><KpiGrid><KpiCard label="Draft invoices" value={data.invoices.filter(invoice => ['draft', 'Draft'].includes(invoice.status)).length} /><KpiCard label="Outstanding invoices" value={unpaid.length} tone="orange" /><KpiCard label="Overdue invoices" value={overdue.length} tone="red" /><KpiCard label="Outstanding value" value={money(unpaid.reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0))} tone="navy" /><KpiCard label="Overdue value" value={money(overdue.reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0))} tone="red" /></KpiGrid><Panel title="Invoice control"><DataTable columns={['Invoice', 'Client', 'Amount', 'Due', 'Status']} rows={data.invoices.slice(0, 20).map(invoice => [invoice.invoice_number ?? invoice.id.slice(0, 8), invoice.client_name ?? 'Client', money(Number(invoice.amount ?? 0)), invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-GB') : 'Not set', <StatusBadge key="status" value={invoice.payment_status ?? invoice.status} />])} /></Panel></PageFrame>;
}

export function ComplianceDashboard() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const documents = data.driverDocuments.concat(data.vehicleDocuments);
  const expired = documents.filter(document => { const days = daysUntil(document.expiry_date); return days !== null && days < 0; });
  const due7 = documents.filter(document => { const days = daysUntil(document.expiry_date); return days !== null && days >= 0 && days <= 7; });
  const due30 = documents.filter(document => { const days = daysUntil(document.expiry_date); return days !== null && days > 7 && days <= 30; });
  return <PageFrame><PageHeader eyebrow="Compliance" title="Compliance Dashboard" description="Verification, expiry and operational readiness for drivers, vehicles and company documents." actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/documents')}>Verification Queue</ActionButton>} /><KpiGrid><KpiCard label="Expired" value={expired.length} tone="red" /><KpiCard label="Expires in 7 days" value={due7.length} tone="orange" /><KpiCard label="Expires in 30 days" value={due30.length} /><KpiCard label="Pending verification" value={documents.filter(document => ['pending', 'under_review'].includes(document.status ?? '')).length} tone="purple" /><KpiCard label="Drivers not ready" value={data.drivers.filter(driver => driver.status !== 'active').length} tone="red" /></KpiGrid><Panel title="Priority expiry queue"><DataTable columns={['Document', 'Entity', 'Expiry', 'Status', 'Action']} rows={documents.filter(document => document.expiry_date).sort((a, b) => +new Date(a.expiry_date ?? 0) - +new Date(b.expiry_date ?? 0)).slice(0, 20).map(document => [document.doc_type?.replace(/_/g, ' ') ?? 'Document', document.driver_id ? 'Driver' : 'Vehicle', document.expiry_date ? new Date(document.expiry_date).toLocaleDateString('en-GB') : 'Not set', <StatusBadge key="status" value={document.status ?? 'pending'} />, <ActionButton key="action" tone="secondary" onClick={() => router.push('/admin/documents')}>Review</ActionButton>])} /></Panel></PageFrame>;
}

export default function RoleDashboard() {
  const { user } = useAuth();
  const role = useMemo(() => resolveWorkspaceRole(user), [user]);
  if (role === 'fleet_manager') return <FleetDashboard />;
  if (role === 'finance') return <FinanceDashboard />;
  if (role === 'compliance') return <ComplianceDashboard />;
  return <CarrierDashboard />;
}
