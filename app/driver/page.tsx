'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthContext';
import { resolveWorkspaceRole } from '../../lib/workspaceRole';
import { canonicalJobStatus, filterJobsForDriver, recentCompletedJobs } from '../../lib/driverDashboard';
import { jobLifecyclePresentationGroup, nextDriverExecutionStatus } from '../../lib/jobs/jobLifecyclePresentation';
import { workspaceJobPresentationStatus } from '../../lib/jobs/workspaceJobStage';
import { VEHICLE_TYPE_LABELS } from '../../lib/vehicleTypes';
import { useCompanyWorkspaceData } from '../components/workspace/useCompanyWorkspaceData';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';
import DriverWorkspaceShell from './_components/DriverWorkspaceShell';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  StatusBadge,
} from '../components/workspace/WorkspaceUI';
import { ConnectedExchangePanel } from '../components/workspace/ConnectedExchangePanel';

type DriverNextAction =
  | { kind: 'transition'; label: string; description: string; resultLabel: string }
  | { kind: 'open'; label: string; description: string };

type DashboardDriverProfile = {
  availability_status: string | null;
  status: string | null;
  future_position: string | null;
  future_position_date: string | null;
};

type DashboardVehicle = {
  id: string;
  type: string | null;
  reg_plate: string | null;
  make: string | null;
  model: string | null;
  assigned_driver_id: string | null;
};

type DashboardMarketplaceLoad = {
  id: string;
  company_id: string;
  status: string;
  vehicle_type: string | null;
  requested_vehicle_type: string | null;
  requested_vehicle_label: string | null;
  pickup_area: string;
  pickup_postcode_area: string | null;
  pickup_datetime: string | null;
  delivery_area: string;
  delivery_postcode_area: string | null;
  delivery_datetime: string | null;
  weight_kg: number | null;
  pallets: number | null;
  budget_amount: number | null;
  currency: string | null;
  exchange_posted_at: string | null;
  member: {
    companyId: string;
    name: string;
    memberId: string | null;
    phone: string | null;
    postedBy: string | null;
  } | null;
};

type DashboardReview = {
  id: string;
  job_id: string | null;
  rating: number | null;
  comment: string | null;
  created_at: string | null;
};

type DashboardContextWarnings = {
  profile?: string;
  vehicle?: string;
  loads?: string;
  feedback?: string;
};

const DOCUMENT_ATTENTION_STATUSES = new Set(['pending', 'rejected', 'expired']);

// Presentation-only action copy. Lifecycle normalization and next-step resolution
// are shared; mutations remain authoritative in driver_update_job_status_atomic.
const NEXT_DRIVER_ACTIONS: Record<string, DriverNextAction> = {
  awarded: {
    kind: 'transition',
    label: 'On my way to pickup',
    description: 'Confirm departure for the collection point.',
    resultLabel: 'On my way to pickup',
  },
  allocated: {
    kind: 'transition',
    label: 'On my way to pickup',
    description: 'Confirm departure for the collection point.',
    resultLabel: 'On my way to pickup',
  },
  on_my_way: {
    kind: 'transition',
    label: 'On site at pickup',
    description: 'Confirm arrival at the collection point.',
    resultLabel: 'On site at pickup',
  },
  on_site_pickup: {
    kind: 'open',
    label: 'Add loading photo',
    description: 'Collection evidence is required before the job can be marked loaded.',
  },
  loaded: {
    kind: 'transition',
    label: 'On my way to delivery',
    description: 'Confirm departure from collection with the load on board.',
    resultLabel: 'On my way to delivery',
  },
  in_transit: {
    kind: 'transition',
    label: 'On site at delivery',
    description: 'Confirm arrival at the delivery point.',
    resultLabel: 'On site at delivery',
  },
  on_site_delivery: {
    kind: 'open',
    label: 'Capture POD',
    description: 'Delivery evidence is required before delivery confirmation.',
  },
  delivered: {
    kind: 'transition',
    label: 'Complete job',
    description: 'Close the delivered job after POD has been captured.',
    resultLabel: 'Completed',
  },
};

function fmtDate(value: string | null | undefined) {
  if (!value) return 'TBC';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'TBC';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtFullDate(value: string | null | undefined) {
  if (!value) return 'Not advertised';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not advertised';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function humanize(value: string | null | undefined) {
  if (!value) return 'Unavailable';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function vehicleLabel(value: string | null | undefined) {
  if (!value) return 'Not assigned';
  return VEHICLE_TYPE_LABELS[value] ?? humanize(value);
}

function normalizeVehicleMatch(value: string | null | undefined) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function loadMatchesAssignedVehicle(load: DashboardMarketplaceLoad, vehicle: DashboardVehicle | null) {
  if (!vehicle?.type) return false;
  const vehicleCandidates = new Set([
    normalizeVehicleMatch(vehicle.type),
    normalizeVehicleMatch(vehicleLabel(vehicle.type)),
  ].filter(Boolean));
  const loadCandidates = [
    load.vehicle_type,
    load.requested_vehicle_type,
    load.requested_vehicle_label,
    vehicleLabel(load.vehicle_type),
    vehicleLabel(load.requested_vehicle_type),
  ].map(normalizeVehicleMatch).filter(Boolean);
  return loadCandidates.some((candidate) => vehicleCandidates.has(candidate));
}

function money(value: number | null | undefined, currency = 'GBP') {
  if (value == null) return 'Open quote';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
}

function statusTone(status: string): 'green' | 'orange' | 'red' | 'purple' | 'blue' | 'grey' {
  const value = status.toLowerCase();
  if (['completed', 'delivered', 'paid', 'accepted', 'approved', 'verified', 'valid', 'active'].includes(value)) return 'green';
  if (['rejected', 'cancelled', 'driver_declined', 'expired'].includes(value)) return 'red';
  if (['submitted', 'awarded', 'allocated', 'on_my_way', 'on_site_pickup', 'loaded', 'in_transit', 'on_site_delivery', 'pending'].includes(value)) return 'orange';
  if (value === 'withdrawn') return 'purple';
  if (value === 'posted') return 'blue';
  return 'grey';
}

export default function DriverDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const workspaceRole = resolveWorkspaceRole(user);
  const ownerDriver = workspaceRole === 'owner_driver';
  const data = useCompanyWorkspaceData();
  const [transitioningJobId, setTransitioningJobId] = useState<string | null>(null);
  const [transitionError, setTransitionError] = useState('');
  const [transitionMessage, setTransitionMessage] = useState('');
  const [driverProfile, setDriverProfile] = useState<DashboardDriverProfile | null>(null);
  const [assignedVehicle, setAssignedVehicle] = useState<DashboardVehicle | null>(null);
  const [relevantLoads, setRelevantLoads] = useState<DashboardMarketplaceLoad[]>([]);
  const [feedback, setFeedback] = useState<DashboardReview[]>([]);
  const [contextWarnings, setContextWarnings] = useState<DashboardContextWarnings>({});
  const [contextLoading, setContextLoading] = useState(true);

  const myJobs = useMemo(
    () => filterJobsForDriver(data.jobs, { driverId: user?.driverId, ownerDriver }),
    [data.jobs, ownerDriver, user?.driverId],
  );

  const currentJob = myJobs.find((job) =>
    jobLifecyclePresentationGroup(workspaceJobPresentationStatus(job)) === 'active'
  );
  const currentStatus = currentJob
    ? canonicalJobStatus(currentJob.current_status, currentJob.status)
    : null;
  const currentAction = currentStatus
    ? NEXT_DRIVER_ACTIONS[currentStatus] ?? {
        kind: 'open' as const,
        label: 'Open job',
        description: 'Continue this job from the full execution screen.',
      }
    : null;

  const todaysJobs = myJobs
    .filter((job) => job.pickup_datetime && new Date(job.pickup_datetime).toDateString() === new Date().toDateString())
    .sort((a, b) => String(a.pickup_datetime ?? '').localeCompare(String(b.pickup_datetime ?? '')));

  const upcomingJobs = myJobs
    .filter((job) =>
      jobLifecyclePresentationGroup(workspaceJobPresentationStatus(job)) === 'upcoming'
      && Boolean(job.pickup_datetime)
      && new Date(job.pickup_datetime as string).getTime() > Date.now()
    )
    .sort((a, b) => String(a.pickup_datetime ?? '').localeCompare(String(b.pickup_datetime ?? '')));

  const recentBookings = [...myJobs]
    .filter((job) => job.id !== currentJob?.id)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 6);

  const recentCompleted = recentCompletedJobs(myJobs).slice(0, 4);
  const myDocuments = data.driverDocuments.filter((document) => !user?.driverId || document.driver_id === user.driverId);
  const now = Date.now();
  const documentAlerts = myDocuments
    .filter((document) => {
      const status = (document.status ?? '').toLowerCase();
      if (DOCUMENT_ATTENTION_STATUSES.has(status)) return true;
      if (!document.expiry_date) return false;
      const expiry = new Date(document.expiry_date).getTime();
      return !Number.isNaN(expiry) && expiry <= now + 30 * 86_400_000;
    })
    .sort((a, b) => {
      const aExpiry = a.expiry_date ? new Date(a.expiry_date).getTime() : Number.POSITIVE_INFINITY;
      const bExpiry = b.expiry_date ? new Date(b.expiry_date).getTime() : Number.POSITIVE_INFINITY;
      return aExpiry - bExpiry;
    })
    .slice(0, 6);
  const pendingDocuments = myDocuments.filter((document) => (document.status ?? '').toLowerCase() === 'pending');
  const rejectedDocuments = myDocuments.filter((document) => (document.status ?? '').toLowerCase() === 'rejected');
  const expiredDocuments = myDocuments.filter((document) => {
    if ((document.status ?? '').toLowerCase() === 'expired') return true;
    if (!document.expiry_date) return false;
    const expiry = new Date(document.expiry_date).getTime();
    return !Number.isNaN(expiry) && expiry < now;
  });
  const dueSoonDocuments = myDocuments.filter((document) => {
    if (!document.expiry_date) return false;
    const expiry = new Date(document.expiry_date).getTime();
    return !Number.isNaN(expiry) && expiry >= now && expiry <= now + 30 * 86_400_000;
  });
  const myJobIds = useMemo(() => myJobs.map((job) => job.id), [myJobs]);

  const loadDashboardContext = useCallback(async () => {
    const driverId = user?.driverId?.trim() ?? '';
    if (!driverId || !isSupabaseConfigured) {
      setDriverProfile(null);
      setAssignedVehicle(null);
      setRelevantLoads([]);
      setFeedback([]);
      setContextWarnings(driverId ? { profile: 'Driver context is unavailable.' } : { profile: 'Driver profile is not available for this account.' });
      setContextLoading(false);
      return;
    }

    setContextLoading(true);
    const warnings: DashboardContextWarnings = {};

    const profilePromise = supabase
      .from('drivers')
      .select('availability_status, status, future_position, future_position_date')
      .eq('id', driverId)
      .maybeSingle();

    const loadsPromise = (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return { data: [] as DashboardMarketplaceLoad[], error: 'Marketplace session could not be verified.' };
      try {
        const response = await fetch('/api/driver/marketplace/loads', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const payload = (await response.json().catch(() => ({}))) as {
          loads?: DashboardMarketplaceLoad[];
          error?: string;
        };
        if (!response.ok) {
          return { data: [] as DashboardMarketplaceLoad[], error: payload.error || 'Relevant marketplace loads could not be loaded.' };
        }
        return { data: payload.loads ?? [], error: null as string | null };
      } catch {
        return { data: [] as DashboardMarketplaceLoad[], error: 'Relevant marketplace loads could not be loaded.' };
      }
    })();

    const feedbackPromise = myJobIds.length
      ? supabase
          .from('reviews')
          .select('id, job_id, rating, comment, created_at')
          .in('job_id', myJobIds)
          .order('created_at', { ascending: false })
          .limit(6)
      : Promise.resolve({ data: [] as DashboardReview[], error: null });

    const vehiclePromise = (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return { vehicle: null as DashboardVehicle | null, error: 'Vehicle session could not be verified.' };
      try {
        const response = await fetch('/api/driver/vehicles', { headers: { Authorization: `Bearer ${token}` } });
        const payload = (await response.json().catch(() => ({}))) as {
          vehicles?: DashboardVehicle[];
          canonicalVehicleId?: string | null;
          canonicalVehicleSignalAvailable?: boolean;
          error?: string;
        };
        if (!response.ok) return { vehicle: null as DashboardVehicle | null, error: payload.error || 'Canonical active vehicle could not be loaded.' };
        if (payload.canonicalVehicleSignalAvailable === false) {
          return { vehicle: null as DashboardVehicle | null, error: 'Canonical active-vehicle signal is temporarily unavailable.' };
        }
        const vehicles = payload.vehicles ?? [];
        const vehicle = payload.canonicalVehicleId
          ? vehicles.find((row) => row.id === payload.canonicalVehicleId) ?? null
          : null;
        return { vehicle, error: null as string | null };
      } catch {
        return { vehicle: null as DashboardVehicle | null, error: 'Canonical active vehicle could not be loaded.' };
      }
    })();

    const [profileRes, loadsRes, feedbackRes, vehicleRes] = await Promise.all([
      profilePromise,
      loadsPromise,
      feedbackPromise,
      vehiclePromise,
    ]);

    if (profileRes.error) {
      warnings.profile = 'Live availability and future position could not be loaded.';
      setDriverProfile(null);
    } else {
      setDriverProfile((profileRes.data as DashboardDriverProfile | null) ?? null);
    }

    if (vehicleRes.error) warnings.vehicle = vehicleRes.error;
    setAssignedVehicle(vehicleRes.vehicle);

    if (feedbackRes.error) {
      warnings.feedback = 'Feedback could not be loaded.';
      setFeedback([]);
    } else {
      setFeedback((feedbackRes.data ?? []) as DashboardReview[]);
    }

    if (loadsRes.error) {
      warnings.loads = loadsRes.error;
      setRelevantLoads([]);
    } else if (!vehicleRes.vehicle) {
      setRelevantLoads([]);
    } else {
      setRelevantLoads((loadsRes.data ?? []).filter((load) => loadMatchesAssignedVehicle(load, vehicleRes.vehicle)).slice(0, 4));
    }

    setContextWarnings(warnings);
    setContextLoading(false);
  }, [myJobIds, user?.driverId]);

  useEffect(() => {
    void loadDashboardContext();
  }, [loadDashboardContext]);

  const runCurrentAction = async () => {
    if (!currentJob || !currentAction || !currentStatus) return;
    if (currentAction.kind === 'open') {
      router.push(`/driver/jobs/${currentJob.id}`);
      return;
    }

    const driverId = user?.driverId?.trim() ?? '';
    if (!driverId) {
      setTransitionError('Your driver profile is not available. Open the job and retry from the execution screen.');
      return;
    }

    const nextStatus = nextDriverExecutionStatus(currentStatus);
    if (!nextStatus) {
      setTransitionError('This lifecycle step must be continued from the full execution screen.');
      return;
    }

    setTransitioningJobId(currentJob.id);
    setTransitionError('');
    setTransitionMessage('');

    const { error } = await supabase.rpc('driver_update_job_status_atomic', {
      p_driver_id: driverId,
      p_job_id: currentJob.id,
      p_next_status: nextStatus,
      p_driver_notes: null,
    });

    if (error) {
      setTransitionError('The job status could not be updated here. Open the job and retry from the execution screen.');
    } else {
      setTransitionMessage(`Job updated: ${currentAction.resultLabel}.`);
      await data.refresh();
    }
    setTransitioningJobId(null);
  };

  const renderJobRow = (
    job: (typeof myJobs)[number],
    actionLabel: string,
  ) => {
    const status = workspaceJobPresentationStatus(job);
    return (
      <article key={job.id} className="driver-load-row" data-state={status}>
        <div className="driver-load-row__top">
          <div className="driver-load-cell">
            <span className="driver-cell-label">From</span>
            <strong className="driver-cell-primary">{job.pickup_location ?? 'Collection TBC'}</strong>
            <span className="driver-cell-secondary">{job.pickup_postcode ?? 'Postcode TBC'} · {fmtDate(job.pickup_datetime)}</span>
          </div>
          <div className="driver-load-cell">
            <span className="driver-cell-label">To</span>
            <strong className="driver-cell-primary">{job.delivery_location ?? 'Delivery TBC'}</strong>
            <span className="driver-cell-secondary">{job.delivery_postcode ?? 'Postcode TBC'} · {fmtDate(job.delivery_datetime)}</span>
          </div>
          <div className="driver-load-cell">
            <span className="driver-cell-label">Vehicle</span>
            <strong className="driver-cell-primary">{vehicleLabel(job.vehicle_type)}</strong>
            <span className="driver-cell-secondary">Assigned work</span>
          </div>
          <div className="driver-load-cell">
            <span className="driver-cell-label">Status</span>
            <strong className="driver-cell-primary">{humanize(status)}</strong>
            <span className="driver-cell-secondary">Job #{job.id.slice(0, 8).toUpperCase()}</span>
          </div>
        </div>
        <div className="driver-load-row__meta">
          <StatusBadge value={humanize(status)} tone={statusTone(status)} />
          <span>Pickup {fmtDate(job.pickup_datetime)}</span>
          <span>Delivery {fmtDate(job.delivery_datetime)}</span>
          <div className="driver-row-actions">
            <ActionButton tone="secondary" onClick={() => router.push(`/driver/jobs/${job.id}`)}>{actionLabel}</ActionButton>
          </div>
        </div>
      </article>
    );
  };

  const renderRelevantLoad = (load: DashboardMarketplaceLoad) => (
    <article key={load.id} className="driver-load-row driver-dashboard-marketplace-row">
      <div className="driver-load-row__top">
        <div className="driver-load-cell">
          <span className="driver-cell-label">From</span>
          <strong className="driver-cell-primary">{load.pickup_area || 'Collection area TBC'}</strong>
          <span className="driver-cell-secondary">{fmtDate(load.pickup_datetime)}</span>
        </div>
        <div className="driver-load-cell">
          <span className="driver-cell-label">To</span>
          <strong className="driver-cell-primary">{load.delivery_area || 'Delivery area TBC'}</strong>
          <span className="driver-cell-secondary">{fmtDate(load.delivery_datetime)}</span>
        </div>
        <div className="driver-load-cell">
          <span className="driver-cell-label">Load</span>
          <strong className="driver-cell-primary">{vehicleLabel(load.requested_vehicle_label ?? load.requested_vehicle_type ?? load.vehicle_type)}</strong>
          <span className="driver-cell-secondary">{load.pallets != null ? `${load.pallets} pallets` : 'Pallets TBC'} · {load.weight_kg != null ? `${load.weight_kg} kg` : 'Weight TBC'}</span>
        </div>
        <div className="driver-load-cell">
          <span className="driver-cell-label">Commercial</span>
          <strong className="driver-cell-primary">{money(load.budget_amount, load.currency ?? 'GBP')}</strong>
          <span className="driver-cell-secondary">Posted {fmtDate(load.exchange_posted_at)}</span>
        </div>
      </div>
      <div className="driver-load-row__meta">
        <StatusBadge value="Vehicle type match" tone="blue" />
        <span>{load.member?.name ?? 'Marketplace member'}{load.member?.phone ? ` · ${load.member.phone}` : ''}</span>
        <span>XDrive XDL-{load.id.slice(0, 8).toUpperCase()}</span>
        <div className="driver-row-actions">
          <ActionButton tone="success" onClick={() => router.push(`/driver/loads/${load.id}`)}>Open load</ActionButton>
        </div>
      </div>
    </article>
  );

  const refreshDashboard = async () => {
    await Promise.all([data.refresh(), loadDashboardContext()]);
  };

  const availabilityValue = driverProfile?.availability_status ? humanize(driverProfile.availability_status) : 'Unavailable';
  const availabilityTone = driverProfile?.availability_status === 'available'
    ? 'green'
    : driverProfile?.availability_status === 'busy'
      ? 'orange'
      : 'grey';
  const driverStatusValue = driverProfile?.status ? humanize(driverProfile.status) : 'Unavailable';
  const assignedVehicleName = assignedVehicle
    ? [vehicleLabel(assignedVehicle.type), assignedVehicle.reg_plate].filter(Boolean).join(' · ')
    : 'Not available';

  return (
    <div className="driver-reference-dashboard">
      <DriverWorkspaceShell
        personaLabel={ownerDriver ? 'Owner-driver workspace' : 'Driver workspace'}
        driverName="Driver Dashboard"
        subtitle="Current execution, bookings, marketplace matching, feedback and compliance signals."
        availabilityLabel={driverProfile?.availability_status ? availabilityValue : undefined}
        headerActions={<ActionButton tone="primary" onClick={() => void refreshDashboard()} disabled={data.loading || contextLoading}>Refresh</ActionButton>}
      >
        {data.error && <AlertBanner tone="danger">{data.error}</AlertBanner>}
        {transitionError && <AlertBanner tone="danger">{transitionError}</AlertBanner>}
        {transitionMessage && <AlertBanner tone="success">{transitionMessage}</AlertBanner>}

        <ConnectedExchangePanel role="driver" title="Connected driver exchange" />

        <div className="driver-dashboard-layout">
          <aside className="driver-dashboard-left" aria-label="Driver operational controls">
            <section className="driver-dashboard-section">
              <div className="driver-dashboard-section__header">
                <span>Status & availability</span>
                <span>{contextLoading ? 'Refreshing…' : 'Live'}</span>
              </div>
              <div className="driver-dashboard-section__body">
                <div className="driver-dashboard-status-primary">
                  <span>Availability</span>
                  <StatusBadge value={availabilityValue} tone={availabilityTone} />
                </div>
                <dl className="driver-dashboard-facts">
                  <div><dt>Driver status</dt><dd>{driverStatusValue}</dd></div>
                  <div><dt>Current job</dt><dd>{currentStatus ? humanize(currentStatus) : 'None'}</dd></div>
                  <div><dt>Jobs today</dt><dd>{todaysJobs.length}</dd></div>
                  <div><dt>Upcoming</dt><dd>{upcomingJobs.length}</dd></div>
                </dl>
                {contextWarnings.profile && <div className="driver-dashboard-inline-warning">{contextWarnings.profile}</div>}
                <div className="driver-dashboard-action-stack">
                  <ActionButton tone="success" onClick={() => router.push('/driver/availability')}>Update availability</ActionButton>
                  {currentJob && <ActionButton tone="secondary" onClick={() => router.push(`/driver/jobs/${currentJob.id}`)}>Open current job</ActionButton>}
                </div>
              </div>
            </section>

            <section className="driver-dashboard-section">
              <div className="driver-dashboard-section__header">
                <span>Canonical active vehicle</span>
                <ActionButton tone="secondary" onClick={() => router.push('/driver/vehicles')}>Vehicle</ActionButton>
              </div>
              <div className="driver-dashboard-section__body">
                <dl className="driver-dashboard-facts">
                  <div><dt>Vehicle</dt><dd>{assignedVehicleName}</dd></div>
                  <div><dt>Type</dt><dd>{assignedVehicle ? vehicleLabel(assignedVehicle.type) : '—'}</dd></div>
                </dl>
                <span style={{ fontSize: 11, color: '#64748b' }}>Vehicle identity only; full operational eligibility is revalidated server-side for quoting and allocation.</span>
                {contextWarnings.vehicle && <div className="driver-dashboard-inline-warning">{contextWarnings.vehicle}</div>}
              </div>
            </section>

            <section className="driver-dashboard-section">
              <div className="driver-dashboard-section__header">
                <span>Journey & position</span>
              </div>
              <div className="driver-dashboard-section__body">
                <div className="driver-dashboard-quick-row">
                  <div>
                    <strong>Return journey</strong>
                    <span>Advertise or manage your empty-vehicle route.</span>
                  </div>
                  <ActionButton tone="secondary" onClick={() => router.push('/driver/returns')}>Open</ActionButton>
                </div>
                <dl className="driver-dashboard-facts">
                  <div><dt>Future position</dt><dd>{driverProfile?.future_position ?? 'Not advertised'}</dd></div>
                  <div><dt>Available from</dt><dd>{fmtFullDate(driverProfile?.future_position_date)}</dd></div>
                </dl>
                <ActionButton tone="secondary" onClick={() => router.push('/driver/availability')}>Manage future position</ActionButton>
              </div>
            </section>
          </aside>

          <main className="driver-dashboard-main">
            <section className="driver-dashboard-section">
              <div className="driver-dashboard-section__header">
                <span>Current execution</span>
                {currentJob && currentStatus && <StatusBadge value={humanize(currentStatus)} tone={statusTone(currentStatus)} />}
              </div>
              <div className="driver-dashboard-section__body">
                {!currentJob || !currentAction ? (
                  <div className="driver-load-row">
                    <EmptyState compact title="No active job" description="Allocated work is shown as upcoming; execution appears here once the job enters an active lifecycle stage." />
                  </div>
                ) : (
                  <>
                    {renderJobRow(currentJob, 'Open full job')}
                    <div className="driver-dashboard-next-action">
                      <span><strong>Next action:</strong> {currentAction.description}</span>
                      <ActionButton
                        tone="success"
                        disabled={transitioningJobId === currentJob.id}
                        onClick={() => void runCurrentAction()}
                      >
                        {transitioningJobId === currentJob.id ? 'Saving…' : currentAction.label}
                      </ActionButton>
                    </div>
                  </>
                )}
              </div>
            </section>

            <section className="driver-dashboard-section">
              <div className="driver-dashboard-section__header">
                <span>Recent bookings</span>
                <ActionButton tone="secondary" onClick={() => router.push('/driver/jobs')}>View all</ActionButton>
              </div>
              <div className="driver-dashboard-section__body">
                {recentBookings.length === 0 ? (
                  <div className="driver-load-row"><EmptyState compact title="No recent bookings" /></div>
                ) : (
                  <div className="driver-load-list">{recentBookings.map((job) => renderJobRow(job, 'Open job'))}</div>
                )}
              </div>
            </section>

            <div className="driver-dashboard-operational-grid">
              <section className="driver-dashboard-section driver-dashboard-relevant-loads">
                <div className="driver-dashboard-section__header">
                  <span>Relevant loads</span>
                  <ActionButton tone="secondary" onClick={() => router.push('/driver/loads')}>All loads</ActionButton>
                </div>
                <div className="driver-dashboard-section__body">
                  {contextWarnings.loads ? (
                    <EmptyState compact title="Relevant loads unavailable" description={contextWarnings.loads} />
                  ) : !assignedVehicle ? (
                    <EmptyState compact title="No vehicle-matched loads" description="A canonical active vehicle is required before Dashboard loads can be matched by vehicle type. Full quote eligibility is revalidated server-side." />
                  ) : relevantLoads.length === 0 ? (
                    <EmptyState compact title="No vehicle-matched loads" description={`No open exchange work currently matches ${vehicleLabel(assignedVehicle.type)}.`} />
                  ) : (
                    <div className="driver-load-list">{relevantLoads.map(renderRelevantLoad)}</div>
                  )}
                </div>
              </section>

              <section className="driver-dashboard-section driver-dashboard-feedback">
                <div className="driver-dashboard-section__header">
                  <span>Feedback</span>
                  <ActionButton tone="secondary" onClick={() => router.push('/driver/history')}>Diary</ActionButton>
                </div>
                <div className="driver-dashboard-section__body">
                  {contextWarnings.feedback ? (
                    <EmptyState compact title="Feedback unavailable" description={contextWarnings.feedback} />
                  ) : feedback.length === 0 ? (
                    <EmptyState compact title="No recent feedback" />
                  ) : (
                    <div className="driver-dashboard-feedback-list">
                      {feedback.map((review) => (
                        <div key={review.id} className="driver-dashboard-feedback-row">
                          <div>
                            <strong>{review.rating != null ? `${review.rating}/5` : 'Feedback received'}</strong>
                            <span>{review.comment?.trim() || 'No written comment supplied.'}</span>
                          </div>
                          <small>{fmtDate(review.created_at)} · {review.job_id ? `Job #${review.job_id.slice(0, 8).toUpperCase()}` : 'Job'}</small>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>

            <section className="driver-dashboard-section driver-dashboard-compliance">
              <div className="driver-dashboard-section__header">
                <span>Compliance & document alerts</span>
                <ActionButton tone="secondary" onClick={() => router.push('/driver/documents')}>Documents</ActionButton>
              </div>
              <div className="driver-dashboard-section__body">
                {data.datasets.driverDocuments.availability === 'unavailable' ? (
                  <EmptyState compact title="Document status unavailable" description="Driver document data could not be loaded." />
                ) : myDocuments.length === 0 ? (
                  <EmptyState compact title="No compliance documents on record" description="Open Documents to upload and manage driver document records. Full operational eligibility is evaluated separately." />
                ) : documentAlerts.length === 0 ? (
                  <div className="driver-dashboard-compliance-ready">
                    <StatusBadge value="No document alert" tone="blue" />
                    <span>{myDocuments.length} document{myDocuments.length === 1 ? '' : 's'} on record with no current review, rejection, expiry or 30-day warning. This is not an operational-eligibility verdict.</span>
                  </div>
                ) : (
                  <div className="driver-dashboard-alert-list">
                    {documentAlerts.map((document) => {
                      const status = (document.status ?? '').toLowerCase();
                      const expiry = document.expiry_date ? new Date(document.expiry_date).getTime() : Number.NaN;
                      const isRejected = status === 'rejected';
                      const isPending = status === 'pending';
                      const isExpired = status === 'expired' || (!Number.isNaN(expiry) && expiry < now);
                      const isDueSoon = !isExpired && !Number.isNaN(expiry) && expiry <= now + 30 * 86_400_000;
                      const alertLabel = isRejected ? 'Rejected' : isExpired ? 'Expired' : isPending ? 'Pending review' : isDueSoon ? 'Due soon' : humanize(status || 'Attention');
                      const alertTone: 'red' | 'orange' | 'grey' = isRejected || isExpired ? 'red' : isPending || isDueSoon ? 'orange' : 'grey';
                      return (
                        <div key={document.id} className="driver-dashboard-alert-row">
                          <div>
                            <strong>{humanize(document.doc_type ?? 'Driver document')}</strong>
                            <span>{document.expiry_date ? `Expiry ${fmtFullDate(document.expiry_date)}` : 'No expiry date recorded'} · {humanize(status || 'Status unavailable')}</span>
                          </div>
                          <StatusBadge value={alertLabel} tone={alertTone} />
                        </div>
                      );
                    })}
                    <div className="driver-dashboard-alert-summary">
                      <span>{pendingDocuments.length} pending · {rejectedDocuments.length} rejected · {expiredDocuments.length} expired · {dueSoonDocuments.length} expiring within 30 days</span>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <div className="driver-dashboard-lower-grid driver-dashboard-secondary-grid">
              <section className="driver-dashboard-section">
                <div className="driver-dashboard-section__header">
                  <span>Quote activity</span>
                  <ActionButton tone="secondary" onClick={() => router.push('/driver/quotes')}>Quotes</ActionButton>
                </div>
                <div className="driver-dashboard-section__body driver-dashboard-table-wrap">
                  {data.bids.length === 0 ? (
                    <EmptyState compact title="No recent quote activity" />
                  ) : (
                    <table>
                      <thead><tr><th>Quote</th><th>Status</th><th>Submitted</th></tr></thead>
                      <tbody>
                        {data.bids.slice(0, 6).map((bid) => (
                          <tr key={bid.id}>
                            <td>£{Number(bid.bid_price_gbp ?? bid.amount ?? 0).toFixed(2)}</td>
                            <td><StatusBadge value={bid.status} tone={statusTone(bid.status)} /></td>
                            <td>{fmtDate(bid.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>

              <section className="driver-dashboard-section">
                <div className="driver-dashboard-section__header">
                  <span>Recent completed work</span>
                  <ActionButton tone="secondary" onClick={() => router.push('/driver/history')}>Diary</ActionButton>
                </div>
                <div className="driver-dashboard-section__body">
                  {recentCompleted.length === 0 ? (
                    <div className="driver-load-row"><EmptyState compact title="No completed jobs yet" /></div>
                  ) : (
                    <div className="driver-load-list">{recentCompleted.map((job) => renderJobRow(job, 'Open'))}</div>
                  )}
                </div>
              </section>
            </div>
          </main>
        </div>
      </DriverWorkspaceShell>
    </div>
  );
}
