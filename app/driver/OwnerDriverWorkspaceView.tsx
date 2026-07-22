'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { useCompanyWorkspaceData, type WorkspaceJob } from '../components/workspace/useCompanyWorkspaceData';
import { ActionButton, AlertBanner, DataTable, EmptyState, KpiCard, KpiGrid, PageFrame, PageHeader, Panel, StatusBadge, TwoColumn } from '../components/workspace/WorkspaceUI';

const activeStatuses = new Set(['accepted', 'on_my_way', 'on_my_way_to_pickup', 'on_site_pickup', 'loaded', 'collected', 'in_transit', 'on_my_way_to_delivery', 'on_site_delivery']);
const completedStatuses = new Set(['delivered', 'completed', 'invoiced', 'paid']);
const exceptionStatuses = new Set(['cancelled', 'failed', 'exception', 'disputed', 'collection_failed', 'delivery_failed', 'damaged', 'breakdown']);
const unavailableDriverStatuses = new Set(['inactive', 'suspended', 'disabled']);
const invalidDocumentStatuses = new Set(['expired', 'rejected', 'invalid']);
const normalize = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();
const formatDateTime = (value: string | null | undefined) => value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set';
const money = (value: number | null | undefined) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(value ?? 0));
const daysUntil = (value: string | null | undefined) => value ? Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000) : null;
const jobStage = (job: WorkspaceJob) => normalize(job.current_status ?? job.status);
const hasPod = (job: WorkspaceJob) => (job.delivery_photos?.length ?? 0) > 0;
const routeLabel = (job: WorkspaceJob) => `${job.pickup_location ?? job.pickup_postcode ?? 'Collection'} → ${job.delivery_location ?? job.delivery_postcode ?? 'Delivery'}`;

type TrackingEvent = { id: string; job_id: string; event_type: string | null; message: string | null; created_at: string };
type NotificationEvent = { id: string; event_type: string | null; status: string | null; created_at: string; payload: Record<string, unknown> | null };

export default function OwnerDriverWorkspaceView() {
  const router = useRouter();
  const { user } = useAuth();
  const data = useCompanyWorkspaceData();
  const [trackingEvents, setTrackingEvents] = useState<TrackingEvent[]>([]);
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);

  const personalDriver = useMemo(() => {
    if (user?.driverId) return data.drivers.find((driver) => driver.id === user.driverId) ?? null;
    return data.drivers.find((driver) => driver.user_id === user?.id) ?? (data.drivers.length === 1 ? data.drivers[0] : null);
  }, [data.drivers, user?.driverId, user?.id]);
  const personalDriverId = personalDriver?.id ?? user?.driverId ?? null;
  const acceptedBidJobIds = useMemo(() => new Set(data.bids.filter((bid) => bid.company_id === data.companyId && normalize(bid.status) === 'accepted').map((bid) => bid.job_id)), [data.bids, data.companyId]);
  const myJobs = useMemo(() => data.jobs.filter((job) => (personalDriverId && job.assigned_driver_id === personalDriverId) || (acceptedBidJobIds.has(job.id) && job.awarded_carrier_company_id === data.companyId)), [acceptedBidJobIds, data.companyId, data.jobs, personalDriverId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const ids = myJobs.map((job) => job.id);
      const [tracking, notice] = await Promise.all([
        ids.length ? supabase.from('job_tracking_events').select('id, job_id, event_type, message, created_at').in('job_id', ids).order('created_at', { ascending: false }).limit(80) : Promise.resolve({ data: [], error: null }),
        data.companyId ? supabase.from('notification_events').select('id, event_type, status, created_at, payload').eq('company_id', data.companyId).order('created_at', { ascending: false }).limit(40) : Promise.resolve({ data: [], error: null }),
      ]);
      if (!cancelled) {
        setTrackingEvents((tracking.data ?? []) as TrackingEvent[]);
        setNotifications((notice.data ?? []) as NotificationEvent[]);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [data.companyId, myJobs]);

  const driverDocs = data.driverDocuments.filter((document) => !personalDriverId || document.driver_id === personalDriverId);
  const vehicles = data.vehicles.filter((vehicle) => !personalDriverId || vehicle.assigned_driver_id === personalDriverId);
  const vehicleIds = new Set(vehicles.map((vehicle) => vehicle.id));
  const vehicleDocs = data.vehicleDocuments.filter((document) => document.vehicle_id && vehicleIds.has(document.vehicle_id));
  const documentIssue = (status: string | null, expiry: string | null) => invalidDocumentStatuses.has(normalize(status)) || ((daysUntil(expiry) ?? 0) < 0 && Boolean(expiry));
  const driverIssues = driverDocs.filter((document) => documentIssue(document.status, document.expiry_date));
  const vehicleIssues = vehicleDocs.filter((document) => documentIssue(document.status, document.expiry_date));
  const active = myJobs.filter((job) => activeStatuses.has(jobStage(job)));
  const hasActiveJob = active.length > 0;
  const driverReady = Boolean(personalDriver) && !unavailableDriverStatuses.has(normalize(personalDriver?.status)) && normalize(personalDriver?.availability_status) === 'available' && !hasActiveJob && driverIssues.length === 0;
  const vehicleReady = vehicles.some((vehicle) => {
    const docs = vehicleDocs.filter((document) => document.vehicle_id === vehicle.id);
    return docs.length > 0 && docs.every((document) => !documentIssue(document.status, document.expiry_date));
  }) && !hasActiveJob;

  const quoted = data.bids.filter((bid) => bid.company_id === data.companyId && ['submitted', 'pending'].includes(normalize(bid.status)));
  const awarded = myJobs.filter((job) => jobStage(job) === 'awarded' && !job.assigned_driver_id);
  const allocated = myJobs.filter((job) => jobStage(job) === 'allocated' || (jobStage(job) === 'awarded' && Boolean(job.assigned_driver_id)));
  const missingPod = myJobs.filter((job) => completedStatuses.has(jobStage(job)) && !hasPod(job));
  const overdueDeliveries = active.filter((job) => job.delivery_datetime && new Date(job.delivery_datetime).getTime() < Date.now());
  const unpaidInvoices = data.invoices.filter((invoice) => invoice.company_id === data.companyId && normalize(invoice.payment_status) !== 'paid' && !['paid', 'void'].includes(normalize(invoice.status)));
  const overdueInvoices = unpaidInvoices.filter((invoice) => invoice.due_date && new Date(invoice.due_date).getTime() < Date.now());
  const latestLocation = personalDriverId ? data.locations.find((location) => location.driver_id === personalDriverId) ?? null : null;

  const attention = [
    ...allocated.map((job) => ({ id: `allocated-${job.id}`, label: 'Driver action', detail: `Accept allocated job: ${routeLabel(job)}`, href: `/driver/jobs/${job.id}` })),
    ...overdueDeliveries.map((job) => ({ id: `overdue-${job.id}`, label: 'ETA overdue', detail: routeLabel(job), href: `/driver/jobs/${job.id}` })),
    ...active.filter((job) => exceptionStatuses.has(jobStage(job))).map((job) => ({ id: `exception-${job.id}`, label: 'Delivery exception', detail: routeLabel(job), href: `/driver/jobs/${job.id}` })),
    ...missingPod.map((job) => ({ id: `pod-${job.id}`, label: 'POD missing', detail: routeLabel(job), href: `/driver/jobs/${job.id}` })),
    ...driverIssues.map((document) => ({ id: `driver-doc-${document.id}`, label: 'Driver compliance', detail: `${document.doc_type?.replace(/_/g, ' ') ?? 'Document'} requires attention`, href: '/driver/documents' })),
    ...vehicleIssues.map((document) => ({ id: `vehicle-doc-${document.id}`, label: 'Vehicle compliance', detail: `${document.doc_type?.replace(/_/g, ' ') ?? 'Document'} requires attention`, href: '/driver/documents' })),
    ...overdueInvoices.map((invoice) => ({ id: `invoice-${invoice.id}`, label: 'Invoice overdue', detail: `${invoice.invoice_number ?? 'Invoice'} · ${money(invoice.amount)}`, href: '/driver/finance' })),
  ].slice(0, 10);

  const activity = [
    ...trackingEvents.map((event) => ({ id: `tracking-${event.id}`, title: event.event_type?.replace(/_/g, ' ') ?? 'Job update', detail: event.message ?? `Job ${event.job_id.slice(0, 8).toUpperCase()}`, at: event.created_at })),
    ...notifications.map((event) => ({ id: `notification-${event.id}`, title: event.event_type?.replace(/_/g, ' ') ?? 'Notification', detail: String(event.payload?.message ?? event.payload?.body ?? event.status ?? 'Notification update'), at: event.created_at })),
    ...data.bids.filter((bid) => bid.company_id === data.companyId).map((bid) => ({ id: `bid-${bid.id}`, title: `Quote ${bid.status}`, detail: `Job ${bid.job_id.slice(0, 8).toUpperCase()}`, at: bid.created_at })),
    ...unpaidInvoices.map((invoice) => ({ id: `invoice-${invoice.id}`, title: `Invoice ${invoice.status}`, detail: invoice.invoice_number ?? 'Carrier invoice', at: invoice.created_at })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 8);

  return <PageFrame>
    <PageHeader eyebrow="Owner-driver business" title="Owner Driver Dashboard" description="Find work, manage personal readiness, execute awarded jobs, complete secure POD and follow carrier invoice payment state." actions={<><ActionButton tone="success" onClick={() => router.push('/driver/loads')}>Find loads</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/driver/jobs')}>My jobs</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/driver/finance')}>Finance</ActionButton></>} />
    {data.error && <AlertBanner tone="danger">{data.error}</AlertBanner>}
    <KpiGrid>
      <KpiCard label="Quoted" value={quoted.length} detail="Submitted or pending quotes" tone="purple" onClick={() => router.push('/driver/quotes')} />
      <KpiCard label="Awarded" value={awarded.length} detail="Won work awaiting personal allocation" tone="orange" onClick={() => router.push('/driver/won-work')} />
      <KpiCard label="Allocated" value={allocated.length} detail="Awaiting driver acceptance" tone="orange" onClick={() => router.push('/driver/jobs')} />
      <KpiCard label="Active" value={active.length} detail="Accepted transport in progress" tone="green" onClick={() => router.push('/driver/jobs')} />
      <KpiCard label="Missing POD" value={missingPod.length} detail="Delivered jobs requiring proof" tone={missingPod.length ? 'red' : 'green'} />
      <KpiCard label="Driver ready" value={driverReady ? 'Yes' : 'No'} detail={personalDriver ? `${personalDriver.status ?? 'unknown'} · ${personalDriver.availability_status ?? 'not marked available'}` : 'No personal driver record resolved'} tone={driverReady ? 'green' : 'red'} />
      <KpiCard label="Vehicle ready" value={vehicleReady ? 'Yes' : 'No'} detail={`${vehicles.length} personal vehicle record${vehicles.length === 1 ? '' : 's'}`} tone={vehicleReady ? 'green' : 'red'} />
      <KpiCard label="Unpaid invoices" value={unpaidInvoices.length} detail={`${overdueInvoices.length} overdue`} tone={overdueInvoices.length ? 'red' : 'navy'} onClick={() => router.push('/driver/finance')} />
    </KpiGrid>
    <TwoColumn>
      <Panel title="Attention required" description="Only persisted records requiring owner-driver action are shown."><DataTable columns={['Priority', 'Detail', 'Action']} rows={attention.map((item) => [<StatusBadge key="priority" value={item.label} tone="red" />, item.detail, <ActionButton key="action" tone="secondary" onClick={() => router.push(item.href)}>Open</ActionButton>])} empty={<EmptyState title="No owner-driver action required" />} /></Panel>
      <div style={{ display: 'grid', gap: '0.9rem' }}>
        <Panel title="Personal readiness" description="Availability and compliance use the same personal records that govern operational work."><DataTable columns={['Resource', 'Operational state', 'Compliance']} rows={[["Driver", <StatusBadge key="driver" value={personalDriver?.availability_status ?? personalDriver?.status ?? 'not resolved'} tone={driverReady ? 'green' : 'red'} />, driverIssues.length ? `${driverIssues.length} issue(s)` : driverDocs.length ? 'Current records' : 'No documents recorded'], ["Vehicle", <StatusBadge key="vehicle" value={hasActiveJob ? 'assigned to active job' : vehicleReady ? 'allocation ready' : 'not ready'} tone={vehicleReady ? 'green' : 'orange'} />, vehicleIssues.length ? `${vehicleIssues.length} issue(s)` : vehicleDocs.length ? 'Current records' : 'No documents recorded']]} /><div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}><ActionButton tone="secondary" onClick={() => router.push('/driver/availability')}>Availability</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/driver/vehicles')}>Vehicle</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/driver/documents')}>Documents</ActionButton></div></Panel>
        <Panel title="Latest tracking signal" description="No live position is inferred when no signal exists.">{latestLocation ? <div style={{ display: 'grid', gap: '0.45rem', fontSize: '0.78rem' }}><strong>{latestLocation.lat.toFixed(5)}, {latestLocation.lng.toFixed(5)}</strong><span>Last signal: {formatDateTime(latestLocation.recorded_at ?? latestLocation.updated_at)}</span></div> : <EmptyState title="No tracking signal" description="A position appears only after the driver application publishes valid coordinates." />}</Panel>
      </div>
    </TwoColumn>
    <TwoColumn>
      <Panel title="Active delivery lifecycle" description="Awarded, allocated, accepted, active and delivered stages remain distinct."><DataTable columns={['Route', 'Pickup', 'Delivery / ETA', 'Status', 'POD', 'Action']} rows={[...allocated, ...active].map((job) => [<strong key="route">{routeLabel(job)}</strong>, formatDateTime(job.pickup_datetime), formatDateTime(job.delivery_datetime), <StatusBadge key="status" value={jobStage(job)} />, hasPod(job) ? 'Present' : completedStatuses.has(jobStage(job)) ? 'Missing' : 'Pending completion', <ActionButton key="action" tone="secondary" onClick={() => router.push(`/driver/jobs/${job.id}`)}>Open</ActionButton>])} empty={<EmptyState title="No allocated or active deliveries" />} /></Panel>
      <Panel title="Recent activity" description="Ordered only by persisted timestamps.">{activity.map((item) => <div key={item.id} style={{ padding: '0.62rem 0', borderBottom: '1px solid #eef2f6' }}><strong style={{ display: 'block', fontSize: '0.78rem' }}>{item.title}</strong><span style={{ display: 'block', color: '#64748b', fontSize: '0.72rem' }}>{item.detail}</span><span style={{ display: 'block', color: '#94a3b8', fontSize: '0.68rem' }}>{formatDateTime(item.at)}</span></div>)}{activity.length === 0 && <EmptyState title="No recent persisted activity" />}</Panel>
    </TwoColumn>
    <Panel title="Carrier invoices" description="Amounts, due dates and payment states come directly from existing invoice records."><DataTable columns={['Invoice', 'Linked job', 'Amount', 'Due', 'Invoice status', 'Payment', 'Action']} rows={data.invoices.filter((invoice) => invoice.company_id === data.companyId).slice(0, 8).map((invoice) => [invoice.invoice_number ?? invoice.id.slice(0, 8).toUpperCase(), invoice.job_id ?? 'Not linked', money(invoice.amount), formatDateTime(invoice.due_date), <StatusBadge key="status" value={invoice.status} />, <StatusBadge key="payment" value={invoice.payment_status ?? 'unpaid'} />, <ActionButton key="action" tone="secondary" onClick={() => router.push('/driver/finance')}>Open finance</ActionButton>])} empty={<EmptyState title="No carrier invoices recorded" />} /></Panel>
    <Panel title="Quick actions" description="Every action uses an existing Owner Driver route."><div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}><ActionButton tone="success" onClick={() => router.push('/driver/loads')}>Available loads</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/driver/quotes')}>My quotes</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/driver/won-work')}>Won work</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/driver/jobs')}>My jobs</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/driver/history')}>Diary</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/driver/returns')}>Return journeys</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/driver/vehicles')}>Vehicle</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/driver/documents')}>Documents</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/driver/finance')}>Invoices</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/driver/messages')}>Messages</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/driver/profile')}>Account</ActionButton></div></Panel>
  </PageFrame>;
}
