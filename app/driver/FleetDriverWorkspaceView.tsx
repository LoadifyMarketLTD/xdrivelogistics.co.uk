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
  ProgressSteps,
  QuickActions,
  StatusBadge,
  TwoColumn,
} from '../components/workspace/WorkspaceUI';

const normalize = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();
const formatDateTime = (value: string | null | undefined) => value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set';
const daysUntil = (value: string | null | undefined) => value ? Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000) : null;
const jobStage = (job: WorkspaceJob) => normalize(job.current_status ?? job.status);
const routeLabel = (job: WorkspaceJob) => `${job.pickup_location ?? job.pickup_postcode ?? 'Collection'} → ${job.delivery_location ?? job.delivery_postcode ?? 'Delivery'}`;
const hasPod = (job: WorkspaceJob) => (job.delivery_photos?.length ?? 0) > 0;

const allocatedStatuses = new Set(['awarded', 'allocated']);
const activeStatuses = new Set(['accepted', 'on_my_way', 'on_my_way_to_pickup', 'on_site_pickup', 'loaded', 'collected', 'in_transit', 'on_my_way_to_delivery', 'on_site_delivery']);
const completedStatuses = new Set(['delivered', 'completed', 'invoiced', 'paid']);
const exceptionStatuses = new Set(['cancelled', 'failed', 'exception', 'disputed', 'collection_failed', 'delivery_failed', 'damaged', 'breakdown']);
const unavailableDriverStatuses = new Set(['inactive', 'suspended', 'disabled']);
const invalidDocumentStatuses = new Set(['expired', 'rejected', 'invalid']);
const lifecycleSteps = ['Allocated', 'Accepted', 'To pickup', 'At pickup', 'Loaded', 'To delivery', 'At delivery', 'Delivered'];

const lifecycleIndex = (stage: string) => {
  const map: Record<string, number> = {
    awarded: 0,
    allocated: 0,
    accepted: 1,
    on_my_way: 2,
    on_my_way_to_pickup: 2,
    on_site_pickup: 3,
    loaded: 4,
    collected: 4,
    in_transit: 5,
    on_my_way_to_delivery: 5,
    on_site_delivery: 6,
    delivered: 7,
    completed: 7,
    invoiced: 7,
    paid: 7,
  };
  return map[stage] ?? 0;
};

type TrackingEvent = { id: string; job_id: string; event_type: string | null; message: string | null; created_at: string };
type NotificationEvent = { id: string; event_type: string | null; entity_id: string | null; status: string | null; created_at: string; payload: Record<string, unknown> | null };

export default function FleetDriverWorkspaceView() {
  const router = useRouter();
  const { user } = useAuth();
  const data = useCompanyWorkspaceData();
  const [trackingEvents, setTrackingEvents] = useState<TrackingEvent[]>([]);
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);

  const personalDriver = useMemo(() => {
    if (user?.driverId) return data.drivers.find((driver) => driver.id === user.driverId) ?? null;
    return data.drivers.find((driver) => driver.user_id === user?.id) ?? null;
  }, [data.drivers, user?.driverId, user?.id]);

  const personalDriverId = personalDriver?.id ?? user?.driverId ?? null;
  const myJobs = useMemo(
    () => data.jobs.filter((job) => Boolean(personalDriverId) && job.assigned_driver_id === personalDriverId),
    [data.jobs, personalDriverId]
  );
  const myJobIds = useMemo(() => new Set(myJobs.map((job) => job.id)), [myJobs]);

  useEffect(() => {
    let cancelled = false;
    const loadActivity = async () => {
      const jobIds = [...myJobIds];
      const [trackingResult, notificationResult] = await Promise.all([
        jobIds.length
          ? supabase.from('job_tracking_events').select('id, job_id, event_type, message, created_at').in('job_id', jobIds).order('created_at', { ascending: false }).limit(80)
          : Promise.resolve({ data: [], error: null }),
        data.companyId
          ? supabase.from('notification_events').select('id, event_type, entity_id, status, created_at, payload').eq('company_id', data.companyId).order('created_at', { ascending: false }).limit(80)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (cancelled) return;
      setTrackingEvents((trackingResult.data ?? []) as TrackingEvent[]);
      const scopedNotifications = ((notificationResult.data ?? []) as NotificationEvent[]).filter((event) => {
        if (event.entity_id && myJobIds.has(event.entity_id)) return true;
        const payloadDriverId = event.payload?.driver_id ?? event.payload?.driverId;
        return typeof payloadDriverId === 'string' && payloadDriverId === personalDriverId;
      });
      setNotifications(scopedNotifications);
    };
    void loadActivity();
    return () => { cancelled = true; };
  }, [data.companyId, myJobIds, personalDriverId]);

  const myDriverDocuments = data.driverDocuments.filter((document) => Boolean(personalDriverId) && document.driver_id === personalDriverId);
  const personalVehicles = data.vehicles.filter((vehicle) => Boolean(personalDriverId) && vehicle.assigned_driver_id === personalDriverId);
  const personalVehicleIds = new Set(personalVehicles.map((vehicle) => vehicle.id));
  const myVehicleDocuments = data.vehicleDocuments.filter((document) => Boolean(document.vehicle_id) && personalVehicleIds.has(document.vehicle_id as string));

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
  const expiringDocuments = [...myDriverDocuments, ...myVehicleDocuments].filter((document) => expiringDocument(document.expiry_date));
  const allocated = myJobs.filter((job) => allocatedStatuses.has(jobStage(job)));
  const active = myJobs.filter((job) => activeStatuses.has(jobStage(job)));
  const completed = myJobs.filter((job) => completedStatuses.has(jobStage(job)));
  const deliveredMissingPod = completed.filter((job) => !hasPod(job));
  const overdueDeliveries = active.filter((job) => job.delivery_datetime && new Date(job.delivery_datetime).getTime() < Date.now());
  const hasActiveJob = active.length > 0;
  const currentJob = [...active, ...allocated].sort((a, b) => String(a.pickup_datetime ?? '').localeCompare(String(b.pickup_datetime ?? '')))[0] ?? null;
  const latestLocation = personalDriverId ? data.locations.find((location) => location.driver_id === personalDriverId) ?? null : null;
  const driverReady = Boolean(personalDriver)
    && !unavailableDriverStatuses.has(normalize(personalDriver?.status))
    && normalize(personalDriver?.availability_status) === 'available'
    && !hasActiveJob
    && driverDocumentIssues.length === 0;
  const vehicleReady = personalVehicles.length > 0 && personalVehicles.some((vehicle) => {
    const docs = myVehicleDocuments.filter((document) => document.vehicle_id === vehicle.id);
    return docs.length > 0 && docs.every((document) => !documentIssue(document.status, document.expiry_date));
  }) && !hasActiveJob;

  const attention = [
    ...allocated.map((job) => ({ id: `allocated-${job.id}`, priority: 'Driver action', detail: `Review allocated job: ${routeLabel(job)}`, href: `/driver/jobs/${job.id}`, tone: 'orange' as const })),
    ...overdueDeliveries.map((job) => ({ id: `overdue-${job.id}`, priority: 'ETA overdue', detail: routeLabel(job), href: `/driver/jobs/${job.id}`, tone: 'red' as const })),
    ...myJobs.filter((job) => exceptionStatuses.has(jobStage(job))).map((job) => ({ id: `exception-${job.id}`, priority: 'Delivery exception', detail: routeLabel(job), href: `/driver/jobs/${job.id}`, tone: 'red' as const })),
    ...deliveredMissingPod.map((job) => ({ id: `pod-${job.id}`, priority: 'POD missing', detail: routeLabel(job), href: `/driver/jobs/${job.id}`, tone: 'red' as const })),
    ...driverDocumentIssues.map((document) => ({ id: `driver-doc-${document.id}`, priority: 'Driver compliance', detail: `${document.doc_type?.replace(/_/g, ' ') ?? 'Document'} requires attention`, href: '/driver/documents', tone: 'red' as const })),
    ...vehicleDocumentIssues.map((document) => ({ id: `vehicle-doc-${document.id}`, priority: 'Vehicle compliance', detail: `${document.doc_type?.replace(/_/g, ' ') ?? 'Document'} requires attention`, href: '/driver/documents', tone: 'red' as const })),
  ].slice(0, 10);

  const activity = [
    ...trackingEvents.map((event) => ({ id: `tracking-${event.id}`, title: event.event_type?.replace(/_/g, ' ') ?? 'Job update', detail: event.message ?? `Job ${event.job_id.slice(0, 8).toUpperCase()}`, at: event.created_at })),
    ...notifications.map((event) => ({ id: `notification-${event.id}`, title: event.event_type?.replace(/_/g, ' ') ?? 'Notification', detail: String(event.payload?.message ?? event.payload?.body ?? event.status ?? 'Notification update'), at: event.created_at })),
    ...myJobs.map((job) => ({ id: `job-${job.id}`, title: `Job ${jobStage(job).replace(/_/g, ' ')}`, detail: routeLabel(job), at: job.updated_at })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 8);

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Fleet driver operations"
        title="Fleet Driver Dashboard"
        description="Your assigned work, next operational action, personal readiness, persisted tracking and proof-of-delivery status."
        actions={<><ActionButton tone="secondary" onClick={() => router.push('/driver/jobs')}>My jobs</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/driver/availability')}>Availability</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/driver/messages')}>Messages</ActionButton></>}
      />
      {data.error && <AlertBanner tone="danger">{data.error}</AlertBanner>}

      <KpiGrid>
        <KpiCard label="Allocated" value={allocated.length} detail="Assigned, awaiting driver action" tone="orange" onClick={() => router.push('/driver/jobs')} />
        <KpiCard label="Active" value={active.length} detail="Accepted transport in progress" tone="green" onClick={() => router.push('/driver/jobs')} />
        <KpiCard label="Completed" value={completed.length} detail="Delivered or completed personal jobs" tone="navy" onClick={() => router.push('/driver/history')} />
        <KpiCard label="Missing POD" value={deliveredMissingPod.length} detail="Completed jobs requiring proof" tone={deliveredMissingPod.length ? 'red' : 'green'} />
        <KpiCard label="Driver ready" value={driverReady ? 'Yes' : 'No'} detail={personalDriver ? `${personalDriver.status ?? 'unknown'} · ${personalDriver.availability_status ?? 'not available'}` : 'No personal driver record resolved'} tone={driverReady ? 'green' : 'red'} />
        <KpiCard label="Vehicle ready" value={vehicleReady ? 'Yes' : 'No'} detail={`${personalVehicles.length} assigned vehicle record${personalVehicles.length === 1 ? '' : 's'}`} tone={vehicleReady ? 'green' : 'orange'} />
        <KpiCard label="Compliance" value={driverDocumentIssues.length + vehicleDocumentIssues.length} detail={`${expiringDocuments.length} expiring within 30 days`} tone={driverDocumentIssues.length + vehicleDocumentIssues.length ? 'red' : 'green'} onClick={() => router.push('/driver/documents')} />
        <KpiCard label="Tracking" value={latestLocation ? 'Signal' : 'No signal'} detail={latestLocation ? formatDateTime(latestLocation.recorded_at ?? latestLocation.updated_at) : 'No persisted location available'} tone={latestLocation ? 'green' : 'orange'} />
      </KpiGrid>

      <TwoColumn>
        <Panel title="Attention required" description="Only persisted records requiring your action are listed.">
          <DataTable
            columns={['Priority', 'Detail', 'Action']}
            rows={attention.map((item) => [<StatusBadge key="priority" value={item.priority} tone={item.tone} />, item.detail, <ActionButton key="action" tone="secondary" onClick={() => router.push(item.href)}>Open</ActionButton>])}
            empty={<EmptyState title="No driver action required" description="No allocation, ETA, POD or compliance exception is currently recorded." />}
          />
        </Panel>

        <div style={{ display: 'grid', gap: '0.8rem' }}>
          <Panel title="Personal readiness" description="Readiness uses your actual driver, assigned vehicle and compliance records.">
            <DataTable columns={['Resource', 'State', 'Compliance']} rows={[
              ['Driver', <StatusBadge key="driver" value={personalDriver?.availability_status ?? personalDriver?.status ?? 'not resolved'} tone={driverReady ? 'green' : 'red'} />, driverDocumentIssues.length ? `${driverDocumentIssues.length} issue(s)` : myDriverDocuments.length ? 'Current records' : 'No documents recorded'],
              ['Vehicle', <StatusBadge key="vehicle" value={hasActiveJob ? 'in active use' : vehicleReady ? 'allocation ready' : 'not ready'} tone={vehicleReady ? 'green' : 'orange'} />, vehicleDocumentIssues.length ? `${vehicleDocumentIssues.length} issue(s)` : myVehicleDocuments.length ? 'Current records' : 'No documents recorded'],
            ]} />
          </Panel>
          <Panel title="Quick actions" description="Existing Fleet Driver routes only.">
            <QuickActions actions={[
              { label: 'Open my jobs', description: 'Assigned and active work', onClick: () => router.push('/driver/jobs') },
              { label: 'Update availability', description: 'Set personal operational state', onClick: () => router.push('/driver/availability') },
              { label: 'Review documents', description: 'Personal compliance records', onClick: () => router.push('/driver/documents') },
              { label: 'View assigned vehicle', description: 'Personal vehicle record', onClick: () => router.push('/driver/vehicles') },
              { label: 'Open messages', description: 'Persisted driver communications', onClick: () => router.push('/driver/messages') },
            ]} />
          </Panel>
        </div>
      </TwoColumn>

      <div style={{ marginTop: '0.8rem' }}>
        <Panel title={currentJob ? 'Current delivery lifecycle' : 'No current delivery'} description="Lifecycle, ETA and tracking are read from persisted job and location records.">
          {currentJob ? <div style={{ display: 'grid', gap: '0.8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div><strong>{routeLabel(currentJob)}</strong><div style={{ color: '#64748b', fontSize: '0.72rem', marginTop: '0.25rem' }}>Pickup {formatDateTime(currentJob.pickup_datetime)} · Delivery {formatDateTime(currentJob.delivery_datetime)}</div></div>
              <StatusBadge value={currentJob.current_status ?? currentJob.status} />
            </div>
            <ProgressSteps steps={lifecycleSteps} currentIndex={lifecycleIndex(jobStage(currentJob))} />
            <DataTable columns={['ETA state', 'Tracking', 'POD', 'Action']} rows={[[
              currentJob.delivery_datetime && new Date(currentJob.delivery_datetime).getTime() < Date.now() && !completedStatuses.has(jobStage(currentJob)) ? <StatusBadge key="eta" value="overdue" tone="red" /> : formatDateTime(currentJob.delivery_datetime),
              latestLocation ? `${latestLocation.lat.toFixed(5)}, ${latestLocation.lng.toFixed(5)} · ${formatDateTime(latestLocation.recorded_at ?? latestLocation.updated_at)}` : 'No tracking signal',
              hasPod(currentJob) ? <StatusBadge key="pod" value="POD present" tone="green" /> : 'Not yet recorded',
              <ActionButton key="open" tone="success" onClick={() => router.push(`/driver/jobs/${currentJob.id}`)}>Open job actions</ActionButton>,
            ]]} />
          </div> : <EmptyState title="No allocated or active delivery" description="Your next assigned job will appear here when dispatch allocates it to your personal driver record." />}
        </Panel>
      </div>

      <div style={{ marginTop: '0.8rem' }}>
        <Panel title="Recent activity" description="Persisted job, tracking and notification timestamps only.">
          <DataTable columns={['Activity', 'Detail', 'Time']} rows={activity.map((item) => [<strong key="title">{item.title}</strong>, item.detail, formatDateTime(item.at)])} empty={<EmptyState title="No recent driver activity" description="Persisted job and notification events will appear here." />} />
        </Panel>
      </div>
    </PageFrame>
  );
}
