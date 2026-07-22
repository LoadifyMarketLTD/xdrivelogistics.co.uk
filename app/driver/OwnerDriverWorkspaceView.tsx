'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { useCompanyWorkspaceData, type WorkspaceJob } from '../components/workspace/useCompanyWorkspaceData';
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
} from '../components/workspace/WorkspaceUI';

const awardedStatuses = new Set(['awarded']);
const allocatedStatuses = new Set(['allocated']);
const activeStatuses = new Set(['accepted', 'on_my_way', 'on_my_way_to_pickup', 'on_site_pickup', 'loaded', 'collected', 'in_transit', 'on_my_way_to_delivery', 'on_site_delivery']);
const completedStatuses = new Set(['delivered', 'completed', 'invoiced', 'paid']);
const exceptionStatuses = new Set(['cancelled', 'failed', 'exception', 'disputed', 'collection_failed', 'delivery_failed', 'damaged', 'breakdown']);
const unavailableDriverStatuses = new Set(['inactive', 'suspended', 'disabled']);
const invalidDocumentStatuses = new Set(['expired', 'rejected', 'invalid']);

const normalize = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();
const formatDateTime = (value: string | null | undefined) => value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set';
const money = (value: number | null | undefined) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(value ?? 0));
const daysUntil = (value: string | null | undefined) => value ? Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000) : null;
const hasPod = (job: WorkspaceJob) => (job.delivery_photos?.length ?? 0) > 0;

function jobStage(job: WorkspaceJob) {
  return normalize(job.current_status ?? job.status);
}

function routeLabel(job: WorkspaceJob) {
  return `${job.pickup_location ?? job.pickup_postcode ?? 'Collection'} → ${job.delivery_location ?? job.delivery_postcode ?? 'Delivery'}`;
}

type TrackingEvent = { id: string; job_id: string; event_type: string | null; message: string | null; created_at: string };
type NotificationEvent = { id: string; event_type: string | null; entity_id: string | null; status: string | null; created_at: string; payload: Record<string, unknown> | null };

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
  const ownBidJobIds = useMemo(() => new Set(data.bids.filter((bid) => bid.company_id === data.companyId).map((bid) => bid.job_id)), [data.bids, data.companyId]);
  const acceptedBidJobIds = useMemo(() => new Set(data.bids.filter((bid) => bid.company_id === data.companyId && normalize(bid.status) === 'accepted').map((bid) => bid.job_id)), [data.bids, data.companyId]);

  const myJobs = useMemo(() => data.jobs.filter((job) => {
    if (personalDriverId && job.assigned_driver_id === personalDriverId) return true;
    return acceptedBidJobIds.has(job.id) && job.awarded_carrier_company_id === data.companyId;
  }), [acceptedBidJobIds, data.companyId, data.jobs, personalDriverId]);

  useEffect(() => {
    let cancelled = false;
    const loadActivity = async () => {
      const jobIds = myJobs.map((job) => job.id);
      const [trackingResult, notificationResult] = await Promise.all([
        jobIds.length ? supabase.from('job_tracking_events').select('id, job_id, event_type, message, created_at').in('job_id', jobIds).order('created_at', { ascending: false }).limit(80) : Promise.resolve({ data: [], error: null }),
        data.companyId ? supabase.from('notification_events').select('id, event_type, entity_id, status, created_at, payload').eq('company_id', data.companyId).order('created_at', { ascending: false }).limit(40) : Promise.resolve({ data: [], error: null }),
      ]);
      if (!cancelled) {
        setTrackingEvents((trackingResult.data ?? []) as TrackingEvent[]);
        setNotifications((notificationResult.data ?? []) as NotificationEvent[]);
      }
    };
    void loadActivity();
    return () => { cancelled = true; };
  }, [data.companyId, myJobs]);

  const myDriverDocuments = data.driverDocuments.filter((document) => !personalDriverId || document.driver_id === personalDriverId);
  const personalVehicles = data.vehicles.filter((vehicle) => !personalDriverId || vehicle.assigned_driver_id === personalDriverId);
  const personalVehicleIds = new Set(personalVehicles.map((vehicle) => vehicle.id));
  const myVehicleDocuments = data.vehicleDocuments.filter((document) => document.vehicle_id && personalVehicleIds.has(document.vehicle_id));
  const hasActiveJob = myJobs.some((job) => activeStatuses.has(jobStage(job)));

  const documentIssue = (status: string | null, expiry: string | null) => {
    const days = daysUntil(expiry);
    return invalidDocumentStatuses.has(normalize(status)) || (days !== null && days < 0);
  };
  const expiringDocument = (expiry: string | null) => {
    const days = daysUntil(expiry);
    return days !== null && days >= 0 && days <= 30;
  };

  const driverDocumentIssues = myDriverDocuments.filter((document) => documentIssue(document.status, document.expiry_date));
  const vehicleDocumentIssues = myVehicleDocuments.filter((document) => documentIssue(document.status, document.expiry_date));
  const driverReady = Boolean(personalDriver) && !unavailableDriverStatuses.has(normalize(personalDriver?.status)) && normalize(personalDriver?.availability_status) === 'available' && !hasActiveJob && driverDocumentIssues.length === 0;
  const vehicleReady = personalVehicles.length > 0 && personalVehicles.some((vehicle) => {
    const docs = myVehicleDocuments.filter((document) => document.vehicle_id === vehicle.id);
    return docs.length > 0 && docs.every((document) => !documentIssue(document.status, document.expiry_date));
  }) && !hasActiveJob;

  const quoted = data.bids.filter((bid) => bid.company_id === data.companyId && ['submitted', 'pending'].includes(normalize(bid.status)));
  const awarded = myJobs.filter((job) => awardedStatuses.has(jobStage(job)) && !job.assigned_driver_id);
  const allocated = myJobs.filter((job) => allocatedStatuses.has(jobStage(job)) || (jobStage(job) === 'awarded' && Boolean(job.assigned_driver_id)));
  const active = myJobs.filter((job) => activeStatuses.has(jobStage(job)));
  const deliveredMissingPod = myJobs.filter((job) => completedStatuses.has(jobStage(job)) && !hasPod(job));
  const overdueDeliveries = active.filter((job) => job.delivery_datetime && new Date(job.delivery_datetime).getTime() < Date.now());
  const unpaidInvoices = data.invoices.filter((invoice) => invoice.company_id === data.companyId && normalize(invoice.payment_status) !== 'paid' && !['paid', 'void'].includes(normalize(invoice.status)));
  const overdueInvoices = unpaidInvoices.filter((invoice) => invoice.due_date && new Date(invoice.due_date).getTime() < Date.now());
  const latestLocation = personalDriverId ? data.locations.find((location) => location.driver_id === personalDriverId) ?? null : null;

  const attention = [
    ...allocated.map((job) => ({ id: `allocated-${job.id}`, priority: 'Driver action', detail: `Accept allocated job: ${routeLabel(job)}`, href: `/driver/jobs/${job.id}`, tone: 'orange' as const })),
    ...overdueDeliveries.map((job) => ({ id: `overdue-${job.id}`, priority: 'ETA overdue', detail: routeLabel(job), href: `/driver/jobs/${job.id}`, tone: 'red' as const })),
    ...active.filter((job) => exceptionStatuses.has(jobStage(job))).map((job) => ({ id: `exception-${job.id}`, priority: 'Delivery exception', detail: routeLabel(job), href: `/driver/jobs/${job.id}`, tone: 'red' as const })),
    ...deliveredMissingPod.map((job) => ({ id: `pod-${job.id}`, priority: 'POD missing', detail: routeLabel(job), href: `/driver/jobs/${job.id}`, tone: 'red' as const })),
    ...driverDocumentIssues.map((document) => ({ id: `driver-doc-${document.id}`, priority: 'Driver compliance', detail: `${document.doc_type?.replace(/_/g, ' ') ?? 'Document'} requires attention`, href: '/driver/documents', tone: 'red' as const })),
    ...vehicleDocumentIssues.map((document) => ({ id: `vehicle-doc-${document.id}`, priority: 'Vehicle compliance', detail: `${document.doc_type?.replace(/_/g, ' ') ?? 'Document'} requires attention`, href: '/driver/documents', tone: 'red' as const })),
    ...overdueInvoices.map((invoice) => ({ id: `invoice-${invoice.id}`, priority: 'Invoice overdue', detail: `${invoice.invoice_number ?? 'Invoice'} · ${money(invoice.amount)}`, href: '/driver/finance', tone: 'red' as const })),
  ].slice(0, 10);

  const activity = [
    ...trackingEvents.map((event) => ({ id: `tracking-${event.id}`, title: event.event_type?.replace(/_/g, ' ') ?? 'Job update', detail: event.message ?? `Job ${event.job_id.slice(0, 8).toUpperCase()}`, at: event.created_at })),
    ...notifications.map((event) => ({ id: `notification-${event.id}`, title: event.event_type?.replace(/_/g, ' ') ?? 'Notification', detail: String(event.payload?.message ?? event.payload?.body ?? event.status ?? 'Notification update'), at: event.created_at })),
    ...data.bids.filter((bid) => bid.company_id === data.companyId).map((bid) => ({ id: `bid-${bid.id}`, title: `Quote ${bid.status}`, detail: `Job ${bid.job_id.slice(0, 8).toUpperCase()}`, at: bid.created_at })),
    ...unpaidInvoices.map((invoice) => ({ id: `invoice-activity-${invoice.id}`, title: `Invoice ${invoice.status}`, detail: invoice.invoice_number ?? 'Carrier invoice', at: invoice.created_at })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 8);

  return (
    <PageFrame>
      <PageHeader eyebrow="Owner-driver business" title="Owner Driver Dashboard" description="Find work, manage personal readiness, execute awarded jobs, complete secure POD and follow carrier invoice payment state." actions={<><ActionButton tone="success" onClick={() => router.push('/driver/loads')}>Find loads</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/driver/jobs')}>My jobs</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/driver/finance')}>Finance</ActionButton></>} />
      {data.error && <AlertBanner tone="danger">{data.error}</AlertBanner>}
      <KpiGrid>
        <KpiCard label="Quoted" value={quoted.length} detail="Submitted or pending quotes" tone="purple" onClick={() => router.push('/driver/quotes')} />
        <KpiCard label="Awarded" value={awarded.length} detail="Won work awaiting personal allocation" tone="orange" onClick={() => router.push('/driver/won-work')} />
        <KpiCard label="Allocated" value={allocated.length} detail="Awaiting driver acceptance" tone="orange" onClick={() => router.push('/driver/jobs')} />
        <KpiCard label="Active" value={active.length} detail="Accepted transport in progress" tone="green" onClick={() => router.push('/driver/jobs')} />
        <KpiCard label="Missing POD" value={deliveredMissingPod.length} detail="Delivered jobs requiring proof" tone={deliveredMissingPod.length ? 'red' : 'green'} />
        <KpiCard label="Driver ready" value={driverReady ? 'Yes' : 'No'} detail={personalDriver ? `${personalDriver.status ?? 'unknown'} · ${personalDriver.availability_status ?? 'not marked available'}` : 'No personal driver record resolved'} tone={driverReady ? 'green' : 'red'} />
        <KpiCard label="Vehicle ready" value={vehicleReady ? 'Yes' : 'No'} detail={`${personalVehicles.length} personal vehicle record${personalVehicles.length === 1 ? '' : 's'}`} tone={vehicleReady ? 'green' : 'red'} />
        <KpiCard label="Unpaid invoices" value={unpaidInvoices.length} detail={`${overdueInvoices.length} overdue`} tone={overdueInvoices.length ? 'red' : 'navy'} onClick={() => router.push('/driver/finance')} />
      </KpiGrid>

      <TwoColumn>
        <Panel title="Attention required" description="Only persisted records requiring owner-driver action are shown.">
          <DataTable columns={['Priority', 'Detail', 'Action']} rows={attention.map((item) => [<StatusBadge key="priority" value={item.priority} tone={item.tone} />, item.detail, <ActionButton key="action" tone="secondary" onClick={() => router.push(item.href)}>Open</ActionButton>])} empty={<EmptyState title="No owner-driver action required" description="No allocation, delivery, POD, compliance or invoice exceptions are currently recorded." />} />
        </Panel>
        <div style={{ display: 'grid', gap: '0.9rem' }}>
          <Panel title="Personal readiness" description="Availability and compliance use the same personal records that govern operational work.">
            <DataTable columns={['Resource', 'Operational state', 'Compliance']} rows={[
              ['Driver', <StatusBadge key="driver-state" value={personalDriver?.availability_status ?? personalDriver?.status ?? 'not resolved'} tone={driverReady ? 'green' : 'red'} />, driverDocumentIssues.length ? `${driverDocumentIssues.length} issue(s)` : myDriverDocuments.length ? 'Current records' : 'No documents recorded'],
              ['Vehicle', <StatusBadge key="vehicle-state" value={hasActiveJob ? 'assigned to active job' : vehicleReady ? 'allocation ready' : 'not ready'} tone={vehicleReady ? 'green' : 'orange'} />, vehicleDocumentIssues.length ? `${vehicleDocumentIssues.length} issue(s)` : myVehicleDocuments.length ? 'Current records' : 'No documents recorded'],
            ]} />
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}><ActionButton tone="secondary" onClick={() => router.push('/driver/availability')}>Availability</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/driver/vehicles')}>Vehicle</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/driver/documents')}>Documents</ActionButton></div>
          </Panel>
          <Panel title="Latest tracking signal" description="No live position is inferred when the driver application has not published a signal.">
            {latestLocation ? <div style={{ display: 'grid', gap: '0.45rem', fontSize: '0.78rem' }}><strong>{latestLocation.lat.toFixed(5)}, {latestLocation.lng.toFixed(5)}</strong><span>Last signal: {formatDateTime(latestLocation.recorded_at ?? latestLocation.updated_at)}</span>{latestLocation.job_id && <ActionButton tone="secondary" onClick={() => router.push(`/driver/jobs/${latestLocation.job_id}`)}>Open linked job</ActionButton>}</div> : <EmptyState title="No tracking signal" description="A position will appear only after the driver application publishes valid coordinates." />}
          </Panel>
        </div>
      </TwoColumn>

      <TwoColumn>
        <Panel title="Active delivery lifecycle" description="Awarded, allocated, accepted, active and delivered stages remain distinct.">
          <DataTable columns={['Route', 'Pickup', 'Delivery / ETA', 'Status', 'POD', 'Action']} rows={[...allocated, ...active].map((job) => [<strong key="route">{routeLabel(job)}</strong>, formatDateTime(job.pickup_datetime), formatDateTime(job.delivery_datetime), <StatusBadge key="status" value={jobStage(job)} />, hasPod(job) ? 'Present' : completedStatuses.has(jobStage(job)) ? 'Missing' : 'Pending completion', <ActionButton key="action" tone="secondary" onClick={() => router.push(`/driver/jobs/${job.id}`)}>Open</ActionButton>])} empty={<EmptyState title="No allocated or active deliveries" />} />
        </Panel>
        <Panel title="Recent activity" description="Ordered only by persisted job, notification, quote and invoice timestamps.">
          {activity.map((item) => <div key={item.id} style={{ padding: '0.62rem 0', borderBottom: '1px solid #eef2f6' }}><strong style={{ display: 'block', fontSize: '0.78rem' }}>{item.title}</strong><span style={{ display: 'block', color: '#64748b', fontSize: '0.72rem', marginTop: '0.2rem' }}>{item.detail}</span><span style={{ display: 'block', color: '#94a3b8', fontSize: '0.68rem', marginTop: '0.2rem' }}>{formatDateTime(item.at)}</span></div>)}
          {activity.length === 0 && <EmptyState title="No recent persisted activity" />}
          <div style={{ marginTop: '0.75rem' }}><ActionButton tone="secondary" onClick={() => router.push('/driver/messages')}>Open messages</ActionButton></div>
        </Panel>
      </TwoColumn>

      <Panel title="Carrier invoices" description="Amounts, due dates and payment states come directly from existing invoice records.">
        <DataTable columns={['Invoice', 'Linked job', 'Amount', 'Due', 'Invoice status', 'Payment', 'Action']} rows={data.invoices.filter((invoice) => invoice.company_id === data.companyId).slice(0, 8).map((invoice) => [invoice.invoice_number ?? invoice.id.slice(0, 8).toUpperCase(), invoice.job_id ? <button key="job" type="button" onClick={() => router.push(`/driver/jobs/${invoice.job_id}`)} style={{ border: 0, background: 'transparent', padding: 0, color: '#1d4ed8', cursor: 'pointer' }}>{invoice.job_id.slice(0, 8).toUpperCase()}</button> : 'Not linked', money(invoice.amount), formatDateTime(invoice.due_date), <StatusBadge key="status" value={invoice.status} />, <StatusBadge key="payment" value={invoice.payment_status ?? 'unpaid'} />, <ActionButton key="action" tone="secondary" onClick={() => router.push('/driver/finance')}>Open finance</ActionButton>])} empty={<EmptyState title="No carrier invoices recorded" />} />
      </Panel>

      <Panel title="Quick actions" description="Every action uses an existing Owner Driver route.">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}><ActionButton tone="success" onClick={() => router.push('/driver/loads')}>Available loads</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/driver/quotes')}>My quotes</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/driver/won-work')}>Won work</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/driver/jobs')}>My jobs</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/driver/history')}>Diary</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/driver/returns')}>Return journeys</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/driver/vehicles')}>Vehicle</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/driver/documents')}>Documents</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/driver/finance')}>Invoices</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/driver/profile')}>Account</ActionButton></div>
      </Panel>
    </PageFrame>
  );
}
