'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../AuthContext';
import { resolveWorkspaceRole, type WorkspaceRole } from '../../../lib/workspaceRole';
import { supabase } from '../../../lib/supabaseClient';
import {
  useCompanyWorkspaceData,
  type WorkspaceInvoice,
  type WorkspaceJob,
} from './useCompanyWorkspaceData';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  KpiCard,
  KpiGrid,
  Panel,
  QuickActions,
  StatusBadge,
  TwoColumn,
  workspaceTheme,
} from './WorkspaceUI';

type Variant = 'carrier' | 'fleet' | 'finance' | 'compliance' | 'customer' | 'broker' | 'driver' | 'owner_driver';
type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'navy';
type Kpi = { label: string; value: ReactNode; detail?: ReactNode; tone: Tone; href?: string };
type Action = { label: string; description: string; href: string; count?: number; tone?: 'green' | 'orange' | 'red' | 'purple' | 'blue' };
type PlatformStats = { companiesTotal: number; companiesActive: number; companiesSuspended: number; companiesPending: number; driversTotal: number; jobsTotal: number; jobsOpen: number; jobsDelivered: number; invoicesTotal: number; invoicesUnpaid: number };
type PlatformNotification = { id: string; type: string; title: string; message: string; status: string; created_at: string };

const DAY = 86_400_000;
const activeStatuses = new Set(['awarded', 'allocated', 'accepted', 'on_my_way', 'on_my_way_to_pickup', 'on_site_pickup', 'loaded', 'collected', 'in_transit', 'on_my_way_to_delivery', 'on_site_delivery']);
const terminalStatuses = new Set(['delivered', 'completed', 'cancelled', 'invoiced', 'paid']);
const money = (value: number, currency = 'GBP') => new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number.isFinite(value) ? value : 0);
const when = (value: string | null | undefined) => value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set';
const route = (job: WorkspaceJob) => `${job.pickup_postcode ?? job.pickup_location ?? 'Collection'} → ${job.delivery_postcode ?? job.delivery_location ?? 'Delivery'}`;
const status = (job: WorkspaceJob) => job.current_status ?? job.status;
const daysUntil = (value: string | null | undefined) => value ? Math.ceil((new Date(value).getTime() - Date.now()) / DAY) : null;
const paid = (invoice: WorkspaceInvoice) => String(invoice.payment_status ?? invoice.status).toLowerCase() === 'paid';
const overdue = (invoice: WorkspaceInvoice) => Boolean(invoice.due_date && new Date(invoice.due_date).getTime() < Date.now() && !paid(invoice));

export default function DashboardCompletionLayer({ mode = 'workspace' }: { mode?: 'workspace' | 'super-admin' }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const role = resolveWorkspaceRole(user);
  if (mode === 'super-admin') return pathname === '/super-admin' ? <SuperAdminCompletion /> : null;
  const variant = resolveVariant(pathname, role);
  return variant ? <WorkspaceCompletion variant={variant} /> : null;
}

function resolveVariant(pathname: string, role: WorkspaceRole): Variant | null {
  if (pathname === '/customer') return 'customer';
  if (pathname === '/broker') return 'broker';
  if (pathname === '/driver') return role === 'owner_driver' ? 'owner_driver' : 'driver';
  if (pathname === '/admin/fleet') return 'fleet';
  if (pathname === '/admin/invoices' && role === 'finance') return 'finance';
  if (pathname === '/admin/documents' && role === 'compliance') return 'compliance';
  if (pathname !== '/admin') return null;
  if (role === 'fleet_manager') return 'fleet';
  if (role === 'finance') return 'finance';
  if (role === 'compliance') return 'compliance';
  return 'carrier';
}

function Frame({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section style={{ width: '100%', maxWidth: 1480, margin: '0 auto', padding: '0 clamp(0.85rem,2vw,1.5rem) 2.5rem' }}>
    <div style={{ margin: '0.2rem 0 0.8rem' }}>
      <div style={{ color: workspaceTheme.blue, fontSize: '0.65rem', fontWeight: 900, letterSpacing: '0.09em', textTransform: 'uppercase' }}>Dashboard control layer</div>
      <h2 style={{ margin: '0.2rem 0 0', color: workspaceTheme.text, fontSize: '1.08rem' }}>{title}</h2>
      <p style={{ margin: '0.25rem 0 0', color: workspaceTheme.muted, fontSize: '0.75rem', lineHeight: 1.45, maxWidth: 920 }}>{description}</p>
    </div>
    {children}
  </section>;
}

function WorkspaceCompletion({ variant }: { variant: Variant }) {
  const router = useRouter();
  const { user } = useAuth();
  const data = useCompanyWorkspaceData();
  const docs = data.driverDocuments.concat(data.vehicleDocuments);
  const now = Date.now();
  const next7 = data.jobs.filter((job) => { const time = job.pickup_datetime ? new Date(job.pickup_datetime).getTime() : 0; return time >= now && time <= now + 7 * DAY && !terminalStatuses.has(job.status); }).sort((a, b) => String(a.pickup_datetime ?? '').localeCompare(String(b.pickup_datetime ?? '')));
  const active = data.jobs.filter((job) => activeStatuses.has(status(job)));
  const expiring = docs.filter((doc) => { const days = daysUntil(doc.expiry_date); return days !== null && days <= 30; });
  const unpaid = data.invoices.filter((invoice) => !paid(invoice));
  const overdueInvoices = unpaid.filter(overdue);

  let title = 'Operational priorities';
  const description = 'The missing decision queues, exceptions and near-term workload are now visible on the dashboard.';
  let kpis: Kpi[] = [];
  let actions: Action[] = [];
  let columns = ['Route', 'Pickup', 'Status', 'Action'];
  let rows: ReactNode[][] = [];
  let panelTitle = 'Priority queue';
  const emptyTitle = 'No priority items';

  if (variant === 'carrier') {
    const ownQuotes = data.bids.filter((bid) => bid.company_id === data.companyId);
    const accepted = ownQuotes.filter((bid) => bid.status === 'accepted');
    const decided = ownQuotes.filter((bid) => ['accepted', 'rejected'].includes(bid.status));
    const waiting = ownQuotes.filter((bid) => ['submitted', 'pending'].includes(bid.status));
    const winRate = decided.length ? accepted.length / decided.length * 100 : 0;
    title = 'Commercial pipeline, schedule and readiness';
    kpis = [
      { label: 'Quotes awaiting decision', value: waiting.length, tone: 'purple', href: '/admin/quotes' },
      { label: 'Quote win rate', value: `${winRate.toFixed(1)}%`, detail: `${accepted.length} accepted`, tone: 'green' },
      { label: 'Accepted work value', value: money(accepted.reduce((sum, bid) => sum + Number(bid.bid_price_gbp ?? bid.amount ?? 0), 0)), tone: 'navy' },
      { label: 'Next 7 days', value: next7.length, tone: 'blue', href: '/admin/diary' },
      { label: 'Overdue invoice value', value: money(overdueInvoices.reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0)), detail: `${overdueInvoices.length} invoices`, tone: overdueInvoices.length ? 'red' : 'green', href: '/admin/invoices' },
      { label: 'Readiness exceptions', value: expiring.length + data.vehicles.filter((vehicle) => !vehicle.assigned_driver_id).length, tone: expiring.length ? 'orange' : 'green' },
    ];
    actions = [
      { label: 'Commercial quotes', description: 'Review submitted quotes', href: '/admin/quotes', count: waiting.length, tone: 'purple' },
      { label: 'Allocate won work', description: 'Open dispatch diary', href: '/admin/diary', count: data.jobs.filter((job) => ['awarded', 'posted'].includes(job.status) && !job.assigned_driver_id).length, tone: 'orange' },
      { label: 'POD exceptions', description: 'Delivered work without proof', href: '/admin/documents?view=pod', count: data.jobs.filter((job) => ['delivered', 'completed'].includes(job.status) && !(job.delivery_photos?.length ?? 0)).length, tone: 'red' },
      { label: 'Overdue invoices', description: 'Finance follow-up', href: '/admin/invoices', count: overdueInvoices.length, tone: 'red' },
    ];
    panelTitle = 'Upcoming collections';
    rows = jobRows(next7, '/admin/jobs', router);
  } else if (variant === 'fleet') {
    const unallocated = data.jobs.filter((job) => ['posted', 'awarded'].includes(job.status) && !job.assigned_driver_id);
    const stale = data.drivers.filter((driver) => { const location = data.locations.find((item) => item.driver_id === driver.id); const timestamp = location?.recorded_at ?? location?.updated_at; return !timestamp || now - new Date(timestamp).getTime() > 20 * 60_000; });
    title = 'Capacity, allocation and readiness exceptions';
    kpis = [
      { label: 'Available drivers', value: data.drivers.filter((driver) => driver.availability_status === 'available').length, tone: 'green', href: '/admin/drivers' },
      { label: 'Available vehicles', value: data.vehicles.filter((vehicle) => !vehicle.assigned_driver_id).length, tone: 'blue', href: '/admin/vehicles' },
      { label: 'Unallocated jobs', value: unallocated.length, tone: unallocated.length ? 'orange' : 'green', href: '/admin/fleet/assignments' },
      { label: 'Active work', value: active.length, tone: 'purple', href: '/admin/fleet/active-jobs' },
      { label: 'Stale GPS positions', value: stale.length, tone: stale.length ? 'red' : 'green', href: '/admin/fleet/positions' },
      { label: 'Documents expiring', value: expiring.length, tone: expiring.length ? 'red' : 'green', href: '/admin/documents/expiry' },
    ];
    actions = [
      { label: 'Allocate work', description: 'Jobs without driver or vehicle', href: '/admin/fleet/assignments', count: unallocated.length, tone: 'orange' },
      { label: 'Live positions', description: 'Drivers without a recent location', href: '/admin/fleet/positions', count: stale.length, tone: 'red' },
      { label: 'Future availability', description: 'Plan the next seven days', href: '/admin/fleet/future-availability', count: next7.length, tone: 'blue' },
      { label: 'Document expiry', description: 'Readiness checks due in 30 days', href: '/admin/documents/expiry', count: expiring.length, tone: 'red' },
    ];
    panelTitle = 'Jobs requiring allocation';
    rows = jobRows(unallocated, '/admin/diary', router, 'Allocate');
  } else if (variant === 'finance') {
    const due7 = unpaid.filter((invoice) => { const days = daysUntil(invoice.due_date); return days !== null && days >= 0 && days <= 7; });
    const due30 = unpaid.filter((invoice) => { const days = daysUntil(invoice.due_date); return days !== null && days > 7 && days <= 30; });
    const unsent = data.invoices.filter((invoice) => ['draft', 'pending'].includes(String(invoice.status).toLowerCase()) || String(invoice.delivery_state ?? '').toLowerCase() !== 'sent');
    title = 'Receivables ageing and invoice exceptions';
    kpis = [
      { label: 'Outstanding value', value: money(unpaid.reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0)), tone: 'navy' },
      { label: 'Overdue value', value: money(overdueInvoices.reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0)), detail: `${overdueInvoices.length} invoices`, tone: overdueInvoices.length ? 'red' : 'green' },
      { label: 'Due in 7 days', value: due7.length, tone: due7.length ? 'orange' : 'green' },
      { label: 'Due in 30 days', value: due30.length, tone: 'blue' },
      { label: 'Draft / unsent', value: unsent.length, tone: unsent.length ? 'orange' : 'green' },
      { label: 'Invoice coverage', value: `${data.jobs.filter((job) => ['delivered', 'completed', 'invoiced', 'paid'].includes(job.status)).length} jobs`, detail: `${data.invoices.length} invoices`, tone: 'purple' },
    ];
    actions = [
      { label: 'Overdue balances', description: 'Invoices past due date', href: '/admin/finance/balances', count: overdueInvoices.length, tone: 'red' },
      { label: 'Payments', description: 'Reconcile received payments', href: '/admin/finance/payments', count: unpaid.length, tone: 'orange' },
      { label: 'Draft and unsent', description: 'Complete invoice delivery', href: '/admin/invoices', count: unsent.length, tone: 'orange' },
      { label: 'Reports and exports', description: 'Financial reporting', href: '/admin/finance/reports', tone: 'blue' },
    ];
    columns = ['Invoice', 'Client', 'Amount', 'Due', 'Status'];
    rows = [...unpaid].sort((a, b) => String(a.due_date ?? '').localeCompare(String(b.due_date ?? ''))).slice(0, 12).map((invoice) => [invoice.invoice_number ?? invoice.id.slice(0, 8), invoice.client_name ?? 'Client', money(Number(invoice.amount ?? 0), invoice.currency ?? 'GBP'), invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-GB') : 'Not set', <StatusBadge key="status" value={overdue(invoice) ? 'overdue' : invoice.payment_status ?? invoice.status} tone={overdue(invoice) ? 'red' : undefined} />]);
    panelTitle = 'Receivables priority queue';
  } else if (variant === 'compliance') {
    const expired = docs.filter((doc) => { const days = daysUntil(doc.expiry_date); return days !== null && days < 0; });
    const due7 = docs.filter((doc) => { const days = daysUntil(doc.expiry_date); return days !== null && days >= 0 && days <= 7; });
    const pending = docs.filter((doc) => ['pending', 'under_review'].includes(String(doc.status ?? '').toLowerCase()));
    const rejected = docs.filter((doc) => String(doc.status ?? '').toLowerCase() === 'rejected');
    const coveredDrivers = new Set(data.driverDocuments.map((doc) => doc.driver_id).filter(Boolean));
    const coveredVehicles = new Set(data.vehicleDocuments.map((doc) => doc.vehicle_id).filter(Boolean));
    const uncovered = data.drivers.filter((driver) => !coveredDrivers.has(driver.id)).length + data.vehicles.filter((vehicle) => !coveredVehicles.has(vehicle.id)).length;
    title = 'Verification, expiry and missing-document coverage';
    kpis = [
      { label: 'Expired', value: expired.length, tone: expired.length ? 'red' : 'green', href: '/admin/documents/expiry' },
      { label: 'Due in 7 days', value: due7.length, tone: due7.length ? 'orange' : 'green' },
      { label: 'Due in 30 days', value: expiring.length, tone: expiring.length ? 'orange' : 'green' },
      { label: 'Pending verification', value: pending.length, tone: pending.length ? 'purple' : 'green', href: '/admin/documents' },
      { label: 'Rejected', value: rejected.length, tone: rejected.length ? 'red' : 'green' },
      { label: 'No document coverage', value: uncovered, tone: uncovered ? 'red' : 'green' },
    ];
    actions = [
      { label: 'Verification queue', description: 'Pending driver and vehicle files', href: '/admin/documents', count: pending.length, tone: 'purple' },
      { label: 'Expired documents', description: 'Immediate operating risk', href: '/admin/documents/expiry', count: expired.length, tone: 'red' },
      { label: 'Missing coverage', description: 'Entities with no document record', href: '/admin/documents', count: uncovered, tone: 'red' },
      { label: 'Incidents', description: 'Compliance-related exceptions', href: '/admin/incidents', tone: 'orange' },
    ];
    columns = ['Document', 'Entity', 'Expiry', 'Status'];
    rows = [...docs].filter((doc) => doc.expiry_date || ['pending', 'rejected'].includes(String(doc.status))).sort((a, b) => String(a.expiry_date ?? '').localeCompare(String(b.expiry_date ?? ''))).slice(0, 14).map((doc) => [(doc.doc_type ?? 'Document').replace(/_/g, ' '), doc.driver_id ? 'Driver' : 'Vehicle', doc.expiry_date ? new Date(doc.expiry_date).toLocaleDateString('en-GB') : 'Not set', <StatusBadge key="status" value={doc.status ?? 'pending'} />]);
    panelTitle = 'Compliance priority queue';
  } else if (variant === 'customer') {
    const quoteDecisions = data.jobs.filter((job) => !job.awarded_carrier_company_id && data.bids.some((bid) => bid.job_id === job.id && bid.status === 'submitted'));
    const delayed = active.filter((job) => job.delivery_datetime && new Date(job.delivery_datetime).getTime() < now);
    const podPending = data.jobs.filter((job) => ['delivered', 'completed'].includes(job.status) && !(job.delivery_photos?.length ?? 0));
    title = 'Quote decisions, live delivery exceptions and documents';
    kpis = [
      { label: 'Quotes to decide', value: quoteDecisions.length, tone: quoteDecisions.length ? 'orange' : 'green', href: '/customer/quotes' },
      { label: 'Active deliveries', value: active.length, tone: 'green', href: '/customer/deliveries' },
      { label: 'Delayed', value: delayed.length, tone: delayed.length ? 'red' : 'green', href: '/customer/deliveries' },
      { label: 'Next 7 days', value: next7.length, tone: 'blue' },
      { label: 'POD pending', value: podPending.length, tone: podPending.length ? 'orange' : 'green', href: '/customer/documents' },
      { label: 'Unpaid invoices', value: unpaid.length, tone: unpaid.length ? 'orange' : 'green', href: '/customer/invoices' },
    ];
    actions = [
      { label: 'Decide carrier quotes', description: 'Loads with selectable responses', href: '/customer/quotes', count: quoteDecisions.length, tone: 'orange' },
      { label: 'Track deliveries', description: 'Active and delayed transport', href: '/customer/deliveries', count: active.length, tone: 'green' },
      { label: 'POD and documents', description: 'Delivery evidence queue', href: '/customer/documents', count: podPending.length, tone: 'orange' },
      { label: 'Invoices', description: 'Payment and due-date status', href: '/customer/invoices', count: unpaid.length, tone: 'orange' },
    ];
    const attention = [...quoteDecisions, ...delayed, ...podPending].filter((job, index, list) => list.findIndex((item) => item.id === job.id) === index);
    rows = jobRows(attention, '/customer/jobs', router);
    panelTitle = 'Transport requiring a decision';
  } else if (variant === 'broker') {
    const submitted = data.bids.filter((bid) => bid.status === 'submitted');
    const noQuotes = data.jobs.filter((job) => ['posted', 'quoted'].includes(job.status) && !submitted.some((bid) => bid.job_id === job.id));
    const awaitingAward = data.jobs.filter((job) => !job.awarded_carrier_company_id && submitted.some((bid) => bid.job_id === job.id));
    const podPending = data.jobs.filter((job) => ['delivered', 'completed'].includes(job.status) && !(job.delivery_photos?.length ?? 0));
    const marginRows = data.jobs.map((job) => { const quotes = submitted.filter((bid) => bid.job_id === job.id); const cost = quotes.length ? Math.min(...quotes.map((bid) => Number(bid.bid_price_gbp ?? bid.amount ?? 0))) : 0; const revenue = Number(job.budget_amount ?? 0); const margin = revenue > 0 && cost > 0 ? (revenue - cost) / revenue * 100 : null; return { job, quotes, cost, revenue, margin }; });
    const lowMargin = marginRows.filter((item) => item.margin !== null && item.margin < 10);
    title = 'Carrier sourcing, margin and operational exceptions';
    kpis = [
      { label: 'Loads without quotes', value: noQuotes.length, tone: noQuotes.length ? 'red' : 'green', href: '/broker/loads' },
      { label: 'Awaiting award', value: awaitingAward.length, tone: awaitingAward.length ? 'orange' : 'green', href: '/broker/compare-quotes' },
      { label: 'Low-margin loads', value: lowMargin.length, detail: 'Below 10%', tone: lowMargin.length ? 'red' : 'green', href: '/broker/margins' },
      { label: 'Active jobs', value: active.length, tone: 'green', href: '/broker/jobs' },
      { label: 'POD pending', value: podPending.length, tone: podPending.length ? 'orange' : 'green', href: '/broker/pod-review' },
      { label: 'Customers', value: new Set(data.jobs.map((job) => job.client_name).filter(Boolean)).size, tone: 'navy', href: '/broker/customers' },
    ];
    actions = [
      { label: 'Source carrier capacity', description: 'Published loads without a response', href: '/broker/loads', count: noQuotes.length, tone: 'red' },
      { label: 'Compare and award', description: 'Quotes awaiting a decision', href: '/broker/compare-quotes', count: awaitingAward.length, tone: 'orange' },
      { label: 'Protect margin', description: 'Loads below 10% projected margin', href: '/broker/margins', count: lowMargin.length, tone: 'red' },
      { label: 'Review POD', description: 'Delivered work missing proof', href: '/broker/pod-review', count: podPending.length, tone: 'orange' },
    ];
    columns = ['Customer / route', 'Quotes', 'Revenue', 'Best cost', 'Margin', 'Action'];
    rows = marginRows.filter((item) => item.quotes.length).sort((a, b) => (a.margin ?? 999) - (b.margin ?? 999)).slice(0, 12).map((item) => [<span key="route"><strong style={{ display: 'block' }}>{item.job.client_name ?? 'Customer'}</strong><small style={{ color: workspaceTheme.muted }}>{route(item.job)}</small></span>, item.quotes.length, money(item.revenue), money(item.cost), <StatusBadge key="margin" value={item.margin === null ? 'not priced' : `${item.margin.toFixed(1)}%`} tone={item.margin !== null && item.margin < 10 ? 'red' : 'green'} />, <ActionButton key="action" tone="secondary" onClick={() => router.push(`/broker/compare-quotes?job=${item.job.id}`)}>Review</ActionButton>]);
    panelTitle = 'Commercial risk queue';
  } else {
    const ownerDriver = variant === 'owner_driver';
    const myJobs = data.jobs.filter((job) => !user?.driverId || job.assigned_driver_id === user.driverId || ownerDriver);
    const current = myJobs.find((job) => activeStatuses.has(status(job)));
    const awaiting = myJobs.filter((job) => ['awarded', 'allocated', 'accepted'].includes(status(job)));
    const podPending = myJobs.filter((job) => ['delivered', 'completed'].includes(job.status) && !(job.delivery_photos?.length ?? 0));
    const vehicle = user?.driverId ? data.vehicles.find((item) => item.assigned_driver_id === user.driverId) : data.vehicles[0];
    const myDocs = docs.filter((doc) => (!user?.driverId || doc.driver_id === user.driverId) || Boolean(vehicle?.id && doc.vehicle_id === vehicle.id));
    const myExpiring = myDocs.filter((doc) => { const days = daysUntil(doc.expiry_date); return days !== null && days <= 30; });
    const myNext7 = myJobs.filter((job) => { const time = job.pickup_datetime ? new Date(job.pickup_datetime).getTime() : 0; return time >= now && time <= now + 7 * DAY && !terminalStatuses.has(job.status); });
    title = ownerDriver ? 'Business pipeline, next work and readiness' : 'Next work, POD and readiness';
    kpis = [
      { label: 'Current job', value: current ? 1 : 0, tone: current ? 'green' : 'navy', href: current ? `/driver/jobs/${current.id}` : '/driver/jobs' },
      { label: 'Awaiting start', value: awaiting.length, tone: awaiting.length ? 'orange' : 'green', href: '/driver/jobs' },
      { label: 'Next 7 days', value: myNext7.length, tone: 'blue', href: '/driver/history' },
      { label: 'POD outstanding', value: podPending.length, tone: podPending.length ? 'red' : 'green', href: '/driver/jobs' },
      { label: 'Documents expiring', value: myExpiring.length, tone: myExpiring.length ? 'red' : 'green', href: '/driver/documents' },
      { label: 'Assigned vehicle', value: vehicle?.reg_plate ?? 'Not set', detail: vehicle ? [vehicle.make, vehicle.model, vehicle.type].filter(Boolean).join(' ') : 'Vehicle profile required', tone: 'navy', href: '/driver/vehicles' },
    ];
    if (ownerDriver) kpis.push({ label: 'Overdue invoices', value: overdueInvoices.length, detail: money(overdueInvoices.reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0)), tone: overdueInvoices.length ? 'red' : 'green', href: '/driver/finance' });
    actions = [
      { label: 'Continue current job', description: current ? route(current) : 'No active job', href: current ? `/driver/jobs/${current.id}` : '/driver/jobs', count: current ? 1 : 0, tone: 'green' },
      { label: 'Jobs awaiting start', description: 'Allocated or accepted work', href: '/driver/jobs', count: awaiting.length, tone: 'orange' },
      { label: 'POD outstanding', description: 'Delivered jobs without proof', href: '/driver/jobs', count: podPending.length, tone: 'red' },
      { label: 'Document expiry', description: 'Driver or assigned vehicle files', href: '/driver/documents', count: myExpiring.length, tone: 'red' },
    ];
    if (ownerDriver) actions.push({ label: 'Invoice follow-up', description: 'Outstanding owner-driver invoices', href: '/driver/finance', count: overdueInvoices.length, tone: 'red' });
    rows = jobRows(myNext7, '/driver/jobs', router);
    panelTitle = 'Upcoming driver schedule';
  }

  return <Frame title={title} description={description}>
    {data.error && <AlertBanner tone="danger">{data.error}</AlertBanner>}
    <KpiGrid>{kpis.map((kpi) => <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} detail={kpi.detail} tone={kpi.tone} onClick={kpi.href ? () => router.push(kpi.href as string) : undefined} />)}</KpiGrid>
    <TwoColumn>
      <Panel title={panelTitle} description="Ordered by urgency so the next decision is visible without opening several modules.">
        <DataTable columns={columns} rows={rows} empty={<EmptyState title={emptyTitle} />} />
      </Panel>
      <Panel title="Direct control queues" description="Open the exact workspace area responsible for each exception.">
        <QuickActions actions={actions.map((action) => ({ label: action.label, description: action.description, onClick: () => router.push(action.href), badge: action.count === undefined ? undefined : <StatusBadge value={String(action.count)} tone={action.count ? action.tone ?? 'blue' : 'green'} /> }))} />
      </Panel>
    </TwoColumn>
  </Frame>;
}

function jobRows(jobs: WorkspaceJob[], base: string, router: ReturnType<typeof useRouter>, action = 'Open'): ReactNode[][] {
  return jobs.slice(0, 12).map((job) => [<strong key="route">{route(job)}</strong>, when(job.pickup_datetime), <StatusBadge key="status" value={status(job)} />, <ActionButton key="action" tone="secondary" onClick={() => router.push(base.startsWith('/admin/') ? `${base}?job=${job.id}` : `${base}/${job.id}`)}>{action}</ActionButton>]);
}

function SuperAdminCompletion() {
  const router = useRouter();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [notifications, setNotifications] = useState<PlatformNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) { setError('Your owner session has expired. Please sign in again.'); setLoading(false); return; }
    try {
      const headers = { Authorization: `Bearer ${session.access_token}` };
      const [statsResponse, notificationResponse] = await Promise.all([fetch('/api/super-admin/stats', { headers, cache: 'no-store' }), fetch('/api/super-admin/platform?section=notifications', { headers, cache: 'no-store' })]);
      const statsPayload = await statsResponse.json().catch(() => null) as (PlatformStats & { error?: string }) | null;
      const notificationPayload = await notificationResponse.json().catch(() => null) as { rows?: PlatformNotification[] } | null;
      if (!statsResponse.ok) throw new Error(statsPayload?.error ?? 'Platform statistics could not be loaded.');
      setStats(statsPayload); setNotifications(notificationResponse.ok ? notificationPayload?.rows ?? [] : []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Platform priorities could not be loaded.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const failed = notifications.filter((item) => String(item.status).toLowerCase() === 'failed');
  const pending = notifications.filter((item) => String(item.status).toLowerCase() === 'pending');
  const activation = stats?.companiesTotal ? stats.companiesActive / stats.companiesTotal * 100 : 0;
  const completion = stats?.jobsTotal ? stats.jobsDelivered / stats.jobsTotal * 100 : 0;
  return <Frame title="Owner priority queues and network health" description="Approvals, suspensions, unpaid invoices and failed platform notifications are now visible as decision queues.">
    {error && <AlertBanner tone="danger">{error}</AlertBanner>}
    <KpiGrid>
      <KpiCard label="Company activation" value={loading ? '…' : `${activation.toFixed(1)}%`} detail={`${stats?.companiesActive ?? 0}/${stats?.companiesTotal ?? 0} active`} tone="green" />
      <KpiCard label="Pending approvals" value={loading ? '…' : stats?.companiesPending ?? 0} tone="orange" onClick={() => router.push('/super-admin/companies/approvals')} />
      <KpiCard label="Suspended companies" value={loading ? '…' : stats?.companiesSuspended ?? 0} tone={(stats?.companiesSuspended ?? 0) ? 'red' : 'green'} onClick={() => router.push('/super-admin/companies/suspended')} />
      <KpiCard label="Delivery completion" value={loading ? '…' : `${completion.toFixed(1)}%`} detail={`${stats?.jobsDelivered ?? 0}/${stats?.jobsTotal ?? 0} jobs`} tone="blue" />
      <KpiCard label="Unpaid invoices" value={loading ? '…' : stats?.invoicesUnpaid ?? 0} tone={(stats?.invoicesUnpaid ?? 0) ? 'red' : 'green'} onClick={() => router.push('/super-admin/finance/invoices')} />
      <KpiCard label="Failed notifications" value={loading ? '…' : failed.length} detail={`${pending.length} pending`} tone={failed.length ? 'red' : 'green'} onClick={() => router.push('/super-admin/notifications')} />
    </KpiGrid>
    <TwoColumn>
      <Panel title="Platform delivery failures" description="Recent failed notification events requiring operational or integration follow-up.">
        <DataTable columns={['Event', 'Detail', 'Time', 'Status']} rows={failed.slice(0, 12).map((item) => [item.title || item.type.replace(/_/g, ' '), item.message || 'No detail recorded', when(item.created_at), <StatusBadge key="status" value={item.status} tone="red" />])} empty={<EmptyState title={loading ? 'Loading platform failures…' : 'No failed notification events'} />} />
      </Panel>
      <Panel title="Owner intervention queues" description="Direct access to governance and exception decisions.">
        <QuickActions actions={[
          { label: 'Approve companies', description: `${stats?.companiesPending ?? 0} pending`, onClick: () => router.push('/super-admin/companies/approvals'), badge: <StatusBadge value={String(stats?.companiesPending ?? 0)} tone={(stats?.companiesPending ?? 0) ? 'orange' : 'green'} /> },
          { label: 'Suspended companies', description: 'Review restrictions and reinstatement', onClick: () => router.push('/super-admin/companies/suspended'), badge: <StatusBadge value={String(stats?.companiesSuspended ?? 0)} tone={(stats?.companiesSuspended ?? 0) ? 'red' : 'green'} /> },
          { label: 'Unpaid invoices', description: 'Platform-wide finance exceptions', onClick: () => router.push('/super-admin/finance/invoices'), badge: <StatusBadge value={String(stats?.invoicesUnpaid ?? 0)} tone={(stats?.invoicesUnpaid ?? 0) ? 'red' : 'green'} /> },
          { label: 'POD and delivery exceptions', description: 'Review operational queues', onClick: () => router.push('/super-admin/operations/pods') },
          { label: 'Platform health', description: 'Runtime, webhook and integration status', onClick: () => router.push('/super-admin/health') },
        ]} />
      </Panel>
    </TwoColumn>
  </Frame>;
}
