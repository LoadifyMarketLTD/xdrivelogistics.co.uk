'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { VEHICLE_TYPE_LABELS } from '../../../lib/vehicleTypes';
import { useDriverLocationPublisher } from '../../hooks/useDriverLocationPublisher';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  KpiCard,
  KpiGrid,
  Panel,
  StatusBadge,
} from '../../components/workspace/WorkspaceUI';

type DriverRow = {
  id: string;
  display_name: string | null;
  availability_status: string | null;
  status: string | null;
};

type StatusHistoryEntry = { status: string; timestamp: string };

type JobRow = {
  id: string;
  status: string;
  pickup_location: string | null;
  pickup_postcode: string | null;
  pickup_datetime: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
  delivery_datetime: string | null;
  vehicle_type: string | null;
  cargo_type: string | null;
  load_details: string | null;
  assigned_driver_id: string | null;
  collection_photo_url: string | null;
  delivery_photos: string[] | null;
  status_history: StatusHistoryEntry[] | null;
};

type JobFilter = 'all' | 'active' | 'allocated' | 'collected' | 'in_transit' | 'delivered';

const ACTIVE_STATUSES = ['allocated', 'collected', 'in_transit'];
const VISIBLE_STATUSES = ['allocated', 'collected', 'in_transit', 'delivered'];

const STATUS_LABELS: Record<string, string> = {
  allocated: 'Allocated',
  collected: 'Loaded',
  in_transit: 'In transit',
  delivered: 'Delivered',
  on_my_way_to_pickup: 'On my way to pickup',
  on_site_pickup: 'On site pickup',
  on_my_way_to_delivery: 'On my way to delivery',
  on_site_delivery: 'On site delivery',
};

const FILTERS: Array<{ id: JobFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'allocated', label: 'Allocated' },
  { id: 'collected', label: 'Loaded' },
  { id: 'in_transit', label: 'In transit' },
  { id: 'delivered', label: 'Completed' },
];

function fmtTime(value: string | null) {
  if (!value) return 'TBC';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'TBC';
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(value: string | null) {
  if (!value) return 'TBC';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'TBC';
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
}

function sameDay(value: string | null, today = new Date()) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
}

function hasEvent(job: JobRow | null, event: string) {
  return Array.isArray(job?.status_history) && job.status_history.some((entry) => entry.status === event);
}

function routeLabel(job: JobRow) {
  return `${job.pickup_location ?? 'Collection'} → ${job.delivery_location ?? 'Delivery'}`;
}

export default function DriverJobsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const driverId = typeof user?.driverId === 'string' ? user.driverId.trim() : '';

  const [driver, setDriver] = useState<DriverRow | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState<JobFilter>('all');

  const loadJobs = useCallback(async () => {
    if (!isSupabaseConfigured || !driverId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const [driverRes, jobsRes] = await Promise.all([
      supabase
        .from('drivers')
        .select('id, display_name, availability_status, status')
        .eq('id', driverId)
        .maybeSingle(),
      supabase
        .from('jobs')
        .select('id, status, pickup_location, pickup_postcode, pickup_datetime, delivery_location, delivery_postcode, delivery_datetime, vehicle_type, cargo_type, load_details, assigned_driver_id, collection_photo_url, delivery_photos, status_history')
        .eq('assigned_driver_id', driverId)
        .in('status', VISIBLE_STATUSES)
        .order('pickup_datetime', { ascending: true })
        .limit(50),
    ]);

    if (driverRes.error) {
      setError('Your driver status could not be loaded.');
    } else {
      setDriver(driverRes.data as DriverRow | null);
    }

    if (jobsRes.error) {
      setError('Assigned jobs could not be loaded. Refresh the page or try again shortly.');
      setJobs([]);
    } else {
      setJobs((jobsRes.data ?? []) as JobRow[]);
    }

    setLoading(false);
  }, [driverId]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const activeJob = useMemo(
    () => jobs.find((job) => ACTIVE_STATUSES.includes(job.status)) ?? null,
    [jobs]
  );

  useDriverLocationPublisher(activeJob?.status, Boolean(activeJob));

  const todaysJobs = useMemo(
    () => jobs.filter((job) => sameDay(job.pickup_datetime) || sameDay(job.delivery_datetime) || ACTIVE_STATUSES.includes(job.status)),
    [jobs]
  );

  const filteredJobs = useMemo(() => {
    if (filter === 'all') return jobs;
    if (filter === 'active') return jobs.filter((job) => ACTIVE_STATUSES.includes(job.status));
    return jobs.filter((job) => job.status === filter);
  }, [filter, jobs]);

  const updateJob = async (job: JobRow, nextStatus: string, eventOnly = false) => {
    if (!driverId || actionLoading) return;

    setActionLoading(true);
    setError('');
    setMessage('');

    const history = Array.isArray(job.status_history) ? job.status_history : [];
    const nextHistory = [...history, { status: nextStatus, timestamp: new Date().toISOString() }];
    const update = eventOnly ? { status_history: nextHistory } : { status: nextStatus, status_history: nextHistory };

    const { error: updateError } = await supabase
      .from('jobs')
      .update(update)
      .eq('id', job.id)
      .eq('assigned_driver_id', driverId);

    if (updateError) {
      setError('That job update could not be saved. Please retry before continuing the journey.');
    } else {
      setMessage(`${STATUS_LABELS[nextStatus] ?? nextStatus} recorded.`);
      await loadJobs();
      window.setTimeout(() => setMessage(''), 3000);
    }
    setActionLoading(false);
  };

  const driverStatus = driver?.availability_status ?? driver?.status ?? 'active';
  const activeVehicle = activeJob?.vehicle_type
    ? (VEHICLE_TYPE_LABELS[activeJob.vehicle_type] ?? activeJob.vehicle_type.replace(/_/g, ' '))
    : 'Not assigned';

  const activePickupEvent = 'on_my_way_to_pickup';
  const activeArrivalEvent = activeJob?.status === 'in_transit' ? 'on_site_delivery' : 'on_site_pickup';
  const activeRouteEvent = activeJob?.status === 'in_transit' ? 'on_my_way_to_delivery' : activePickupEvent;

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        driverName={driver?.display_name ?? undefined}
        availabilityLabel={driverStatus}
        subtitle="Execute assigned work from one operational view: route, timing, status, tracking and POD hand-off."
        headerActions={<ActionButton tone="primary" onClick={() => void loadJobs()} disabled={loading}>Refresh</ActionButton>}
      >
        {error && <AlertBanner tone="danger">{error}</AlertBanner>}
        {message && <AlertBanner tone="success">{message}</AlertBanner>}

        <KpiGrid>
          <KpiCard label="Active job" value={activeJob ? 1 : 0} detail="Current execution" tone={activeJob ? 'green' : 'navy'} onClick={activeJob ? () => router.push(`/driver/jobs/${activeJob.id}`) : undefined} />
          <KpiCard label="Today" value={todaysJobs.length} detail="Pickup or delivery today" tone="blue" />
          <KpiCard label="Awaiting pickup" value={jobs.filter((job) => job.status === 'allocated').length} detail="Allocated work" tone="orange" />
          <KpiCard label="In transit" value={jobs.filter((job) => job.status === 'in_transit').length} detail="Moving to delivery" tone="green" />
          <KpiCard label="Completed" value={jobs.filter((job) => job.status === 'delivered').length} detail="Delivered work" tone="navy" onClick={() => router.push('/driver/history')} />
          <KpiCard label="Vehicle" value={activeVehicle} detail="Current job requirement" tone="purple" />
        </KpiGrid>

        <div className="driver-ops-grid-2">
          <Panel
            title="Current execution"
            description="Authoritative next action for the active job."
            actions={activeJob ? <ActionButton tone="secondary" onClick={() => router.push(`/driver/jobs/${activeJob.id}`)}>Open full job</ActionButton> : undefined}
          >
            {loading ? (
              <EmptyState title="Loading assigned work" />
            ) : activeJob ? (
              <div>
                <div className="driver-current-route">
                  <div className="driver-route-stop">
                    <span className="driver-cell-label">Pickup</span>
                    <strong className="driver-cell-primary">{activeJob.pickup_location ?? 'Collection'}</strong>
                    <span className="driver-cell-secondary">{activeJob.pickup_postcode ?? 'Postcode TBC'} · {fmtDate(activeJob.pickup_datetime)} {fmtTime(activeJob.pickup_datetime)}</span>
                  </div>
                  <span className="driver-route-arrow">→</span>
                  <div className="driver-route-stop">
                    <span className="driver-cell-label">Delivery</span>
                    <strong className="driver-cell-primary">{activeJob.delivery_location ?? 'Delivery'}</strong>
                    <span className="driver-cell-secondary">{activeJob.delivery_postcode ?? 'Postcode TBC'} · {fmtDate(activeJob.delivery_datetime)} {fmtTime(activeJob.delivery_datetime)}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', paddingTop: '6px', borderTop: '1px solid #e5e7eb' }}>
                  <StatusBadge value={STATUS_LABELS[activeJob.status] ?? activeJob.status} />
                  <span style={{ color: '#64748b', fontSize: '11px' }}>{activeJob.cargo_type?.replace(/_/g, ' ') ?? 'Cargo not specified'}</span>
                  <span style={{ color: '#64748b', fontSize: '11px' }}>{activeVehicle}</span>
                </div>

                <div className="driver-action-grid">
                  <ActionButton
                    tone="primary"
                    disabled={actionLoading || hasEvent(activeJob, activeRouteEvent)}
                    onClick={() => void updateJob(activeJob, activeRouteEvent, true)}
                  >
                    {activeJob.status === 'in_transit' ? 'On way to delivery' : 'On way to pickup'}
                  </ActionButton>
                  <ActionButton
                    tone="secondary"
                    disabled={actionLoading || hasEvent(activeJob, activeArrivalEvent)}
                    onClick={() => void updateJob(activeJob, activeArrivalEvent, true)}
                  >
                    {activeJob.status === 'in_transit' ? 'On site delivery' : 'On site pickup'}
                  </ActionButton>
                  <ActionButton
                    tone="success"
                    disabled={actionLoading || activeJob.status !== 'allocated'}
                    onClick={() => void updateJob(activeJob, 'collected')}
                  >
                    Loaded
                  </ActionButton>
                  <ActionButton tone="warning" disabled={actionLoading} onClick={() => router.push(`/driver/jobs/${activeJob.id}`)}>
                    Delivered / POD
                  </ActionButton>
                </div>
              </div>
            ) : (
              <EmptyState title="No active job" description="Allocated work appears here immediately and becomes the primary execution card." />
            )}
          </Panel>

          <Panel title="Today's schedule" description="Pickup and delivery work due today, in operational order.">
            {todaysJobs.length === 0 ? (
              <EmptyState title="No jobs scheduled today" description="Keep availability current so dispatch and marketplace matching remain accurate." />
            ) : (
              <div className="driver-ops-table-wrap">
                <table className="driver-ops-table">
                  <thead>
                    <tr>
                      <th>Route</th>
                      <th>Pickup</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todaysJobs.map((job) => (
                      <tr key={job.id}>
                        <td><strong>{routeLabel(job)}</strong></td>
                        <td>{fmtTime(job.pickup_datetime)}</td>
                        <td><StatusBadge value={STATUS_LABELS[job.status] ?? job.status} /></td>
                        <td><ActionButton tone="secondary" onClick={() => router.push(`/driver/jobs/${job.id}`)}>Open</ActionButton></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <div className="driver-status-tabs" aria-label="Job status filters">
          {FILTERS.map((item) => (
            <button key={item.id} type="button" data-active={filter === item.id} onClick={() => setFilter(item.id)}>
              {item.label} {item.id === 'all' ? jobs.length : item.id === 'active' ? jobs.filter((job) => ACTIVE_STATUSES.includes(job.status)).length : jobs.filter((job) => job.status === item.id).length}
            </button>
          ))}
        </div>

        <Panel
          title="Assigned work register"
          description="Compact operational list. Open a job for notes, POD, documents and full history."
          actions={<ActionButton tone="secondary" onClick={() => router.push('/driver/history')}>Job history</ActionButton>}
          flush
        >
          {loading ? (
            <div style={{ padding: '20px' }}><EmptyState title="Loading jobs" /></div>
          ) : filteredJobs.length === 0 ? (
            <div style={{ padding: '20px' }}><EmptyState title="No jobs in this status" /></div>
          ) : (
            <div className="driver-ops-table-wrap">
              <table className="driver-ops-table">
                <thead>
                  <tr>
                    <th>Route</th>
                    <th>Pickup</th>
                    <th>Delivery</th>
                    <th>Vehicle</th>
                    <th>Status</th>
                    <th>POD</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.map((job) => {
                    const hasPod = Array.isArray(job.delivery_photos) && job.delivery_photos.length > 0;
                    return (
                      <tr key={job.id}>
                        <td><strong>{routeLabel(job)}</strong></td>
                        <td>{fmtDate(job.pickup_datetime)} {fmtTime(job.pickup_datetime)}</td>
                        <td>{fmtDate(job.delivery_datetime)} {fmtTime(job.delivery_datetime)}</td>
                        <td>{job.vehicle_type ? (VEHICLE_TYPE_LABELS[job.vehicle_type] ?? job.vehicle_type.replace(/_/g, ' ')) : 'TBC'}</td>
                        <td><StatusBadge value={STATUS_LABELS[job.status] ?? job.status} /></td>
                        <td>{hasPod ? <StatusBadge value="POD captured" tone="green" /> : <span style={{ color: '#64748b' }}>—</span>}</td>
                        <td><ActionButton tone="secondary" onClick={() => router.push(`/driver/jobs/${job.id}`)}>Open</ActionButton></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
