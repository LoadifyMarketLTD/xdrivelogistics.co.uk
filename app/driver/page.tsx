'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthContext';
import { resolveWorkspaceRole } from '../../lib/workspaceRole';
import { canonicalJobStatus, filterJobsForDriver } from '../../lib/driverDashboard';
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
  distance_miles: number | null;
  distance_minutes: number | null;
  distance_to_pickup_miles: number | null;
  pickup_eta_minutes: number | null;
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
  allocated: {
    kind: 'transition',
    label: 'Accept job',
    description: 'Accept the allocated job before starting the collection journey.',
    resultLabel: 'Accepted',
  },
  accepted: {
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
  const [workboardView, setWorkboardView] = useState<'attention' | 'upcoming' | 'live' | 'documents' | 'exceptions' | 'all'>('attention');

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

  const _todaysJobs = myJobs
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

  const _renderRelevantLoad = (load: DashboardMarketplaceLoad) => (
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
        <span><strong>To Collection:</strong> {load.distance_to_pickup_miles != null ? `${load.distance_to_pickup_miles.toFixed(1)} mi${load.pickup_eta_minutes != null ? ` · ${Math.round(load.pickup_eta_minutes)} min` : ''}` : 'Not available'}</span>
        <span><strong>Job Distance:</strong> {load.distance_miles != null ? `${load.distance_miles.toFixed(1)} mi${load.distance_minutes != null ? ` · ${Math.round(load.distance_minutes)} min` : ''}` : 'Not available'}</span>
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
  const _availabilityTone = driverProfile?.availability_status === 'available'
    ? 'green'
    : driverProfile?.availability_status === 'busy'
      ? 'orange'
      : 'grey';
  const driverStatusValue = driverProfile?.status ? humanize(driverProfile.status) : 'Unavailable';
  const _assignedVehicleName = assignedVehicle
    ? [vehicleLabel(assignedVehicle.type), assignedVehicle.reg_plate].filter(Boolean).join(' · ')
    : 'Not available';

  const dashboardBookings = recentBookings.filter((job) => job.id !== upcomingJobs[0]?.id).slice(0, 3);
  const latestFeedback = feedback[0] ?? null;
  const quoteRows = data.bids ?? [];
  const openQuotes = quoteRows.filter((bid) => ['submitted', 'pending'].includes(String(bid.status ?? '').toLowerCase())).length;
  const acceptedQuotes = quoteRows.filter((bid) => ['accepted', 'awarded', 'won'].includes(String(bid.status ?? '').toLowerCase())).length;
  const warningCount = Object.values(contextWarnings).filter(Boolean).length + (transitionError ? 1 : 0);
  const liveJobs = currentJob ? [currentJob] : [];
  const needsAttentionCount = (currentJob && currentAction ? 1 : 0) + documentAlerts.length + warningCount;
  const workboardTabs = [
    { id: 'attention' as const, label: 'Needs attention', count: needsAttentionCount },
    { id: 'upcoming' as const, label: 'Upcoming', count: upcomingJobs.length },
    { id: 'live' as const, label: 'Live jobs', count: liveJobs.length },
    { id: 'documents' as const, label: 'Documents', count: documentAlerts.length },
    { id: 'exceptions' as const, label: 'Exceptions', count: warningCount },
    { id: 'all' as const, label: 'All work', count: myJobs.length },
  ];

  const renderWorkboardBody = () => {
    if (workboardView === 'live') {
      return liveJobs.length
        ? <div className="driver-load-list">{liveJobs.map((job) => renderJobRow(job, 'Open job'))}</div>
        : <EmptyState compact title="No live job" description="There is no active execution at the moment." />;
    }
    if (workboardView === 'upcoming') {
      return upcomingJobs.length
        ? <div className="driver-load-list">{upcomingJobs.slice(0, 4).map((job) => renderJobRow(job, 'Open booking'))}</div>
        : <EmptyState compact title="No upcoming bookings" description="No future allocated work is currently scheduled." />;
    }
    if (workboardView === 'documents') {
      return documentAlerts.length
        ? <div className="driver-proto-register">{documentAlerts.map((document) => (
            <button key={document.id} type="button" onClick={() => router.push('/driver/documents')}>
              <div>
                <strong>{humanize(document.doc_type ?? 'Document')}</strong>
                <span>{document.expiry_date ? 'Expiry ' + fmtFullDate(document.expiry_date) : 'No expiry supplied'}</span>
              </div>
              <StatusBadge value={humanize(document.status ?? 'Attention')} tone={statusTone(String(document.status ?? 'pending'))} />
            </button>
          ))}</div>
        : <EmptyState compact title="No document alerts" description="There are no current document actions requiring attention." />;
    }
    if (workboardView === 'exceptions') {
      const warnings = Object.values(contextWarnings).filter(Boolean);
      return warnings.length || transitionError
        ? <div className="driver-proto-exceptions">
            {transitionError && <AlertBanner tone="danger">{transitionError}</AlertBanner>}
            {warnings.map((warning) => <AlertBanner key={warning} tone="warning">{warning}</AlertBanner>)}
          </div>
        : <EmptyState compact title="No active exceptions" description="Driver workspace services are reporting normally." />;
    }
    if (workboardView === 'all') {
      return myJobs.length
        ? <div className="driver-load-list">{myJobs.slice(0, 5).map((job) => renderJobRow(job, 'Open job'))}</div>
        : <EmptyState compact title="No driver work" description="No driver jobs are currently available." />;
    }
    if (currentJob && currentAction) {
      return <>
        {renderJobRow(currentJob, 'Open full job')}
        <div className="driver-proto-next-action">
          <div><span>NEXT ACTION</span><strong>{currentAction.label}</strong><small>{currentAction.description}</small></div>
          <ActionButton tone="success" disabled={transitioningJobId === currentJob.id} onClick={() => void runCurrentAction()}>
            {transitioningJobId === currentJob.id ? 'Saving…' : currentAction.label}
          </ActionButton>
        </div>
      </>;
    }
    if (documentAlerts.length) {
      return <div className="driver-proto-attention-line">
        <div><strong>{documentAlerts.length + ' document alert' + (documentAlerts.length === 1 ? '' : 's') + ' require attention'}</strong><span>Open Documents to review expiry or status issues.</span></div>
        <ActionButton tone="secondary" onClick={() => router.push('/driver/documents')}>Open Documents</ActionButton>
      </div>;
    }
    if (warningCount) {
      return <div className="driver-proto-attention-line">
        <div><strong>{warningCount + ' workspace exception' + (warningCount === 1 ? '' : 's')}</strong><span>Open Exceptions to inspect service availability.</span></div>
        <ActionButton tone="secondary" onClick={() => setWorkboardView('exceptions')}>View exceptions</ActionButton>
      </div>;
    }
    return <EmptyState compact title="Operations queue clear" description="Use Loads to find marketplace work or Diary to review bookings." />;
  };

  const acceptedQuoteValue = quoteRows
    .filter((bid) => ['accepted', 'awarded', 'won'].includes(String(bid.status ?? '').toLowerCase()))
    .reduce((sum, bid) => sum + Number(bid.bid_price_gbp ?? bid.amount ?? 0), 0);
  const completedJobsCount = myJobs.filter((job) => {
    const status = workspaceJobPresentationStatus(job);
    return status === 'completed' || status === 'delivered';
  }).length;
  const compliantDocuments = Math.max(0, myDocuments.length - documentAlerts.length);
  const futurePositionPublished = driverProfile?.future_position ? 1 : 0;

  return (
    <div className="driver-reference-dashboard driver-prototype-dashboard driver-exact-prototype">
      <DriverWorkspaceShell
        personaLabel={ownerDriver ? 'Owner-driver workspace' : 'Driver workspace'}
        driverName="Dashboard"
        subtitle="Live operations, resources, commercial position and compliance at a glance."
        headerActions={<>
          <button type="button" className="btn" onClick={() => router.push('/driver/history')}>Open Diary</button>
          <button type="button" className="btn" onClick={() => router.push('/driver/action-centre')}>Action Centre</button>
          <button type="button" className="btn primary" onClick={() => void refreshDashboard()} disabled={data.loading || contextLoading}>Refresh</button>
        </>}
      >
        {data.error && <AlertBanner tone="danger">{data.error}</AlertBanner>}
        {transitionMessage && <AlertBanner tone="success">{transitionMessage}</AlertBanner>}
        <section className="xd2-hero">
          <div className="xd2-hero-copy">
            <span className="xd2-eyebrow">OPERATIONS CONTROL</span>
            <div className="xd2-hero-line">
              <h2>Today at a glance</h2>
              <span className="xd2-live-chip">LIVE WORKSPACE</span>
            </div>
            <p>Driver work, vehicle readiness, delivery evidence, marketplace activity and compliance in one operating view.</p>
          </div>
          <div className="xd2-hero-actions">
            <button type="button" className="btn" onClick={() => router.push('/driver/loads')}>Find Loads</button>
            <button type="button" className="btn primary" onClick={() => router.push('/driver/history')}>Open Diary</button>
          </div>
        </section>

        <section className="xd2-kpis" aria-label="Driver operational indicators">
          <button type="button" className={'xd2-kpi attention ' + (workboardView === 'attention' ? 'active' : '')} onClick={() => setWorkboardView('attention')}>
            <span className="xd2-kpi-label">Needs Attention</span><b>{needsAttentionCount}</b><small>{needsAttentionCount ? 'Driver actions or alerts' : 'No urgent actions'}</small>
          </button>
          <button type="button" className={'xd2-kpi allocation ' + (workboardView === 'upcoming' ? 'active' : '')} onClick={() => setWorkboardView('upcoming')}>
            <span className="xd2-kpi-label">Upcoming Work</span><b>{upcomingJobs.length}</b><small>Future allocated work</small>
          </button>
          <button type="button" className={'xd2-kpi live ' + (workboardView === 'live' ? 'active' : '')} onClick={() => setWorkboardView('live')}>
            <span className="xd2-kpi-label">Live Jobs</span><b>{liveJobs.length}</b><small>Currently executing</small>
          </button>
          <button type="button" className="xd2-kpi drivers" onClick={() => router.push('/driver/loads')}>
            <span className="xd2-kpi-label">Matching Loads</span><b>{contextWarnings.loads ? '—' : relevantLoads.length}</b><small>{assignedVehicle ? 'For ' + vehicleLabel(assignedVehicle.type) : 'Active vehicle required'}</small>
          </button>
          <button type="button" className={'xd2-kpi photo ' + (workboardView === 'documents' ? 'active' : '')} onClick={() => setWorkboardView('documents')}>
            <span className="xd2-kpi-label">Document Alerts</span><b>{documentAlerts.length}</b><small>{myDocuments.length} on record</small>
          </button>
          <button type="button" className={'xd2-kpi exceptions ' + (workboardView === 'exceptions' ? 'active' : '')} onClick={() => setWorkboardView('exceptions')}>
            <span className="xd2-kpi-label">Exceptions</span><b>{warningCount}</b><small>{warningCount ? 'Service attention' : 'No active exceptions'}</small>
          </button>
        </section>

        <div className="xd2-primary-grid">
          <section className="xd2-card xd2-workboard">
            <div className="xd2-card-head">
              <div><span className="xd2-card-kicker">LIVE OPERATIONS</span><h3>Operational workboard</h3><p>{workboardTabs.find((tab) => tab.id === workboardView)?.label ?? 'Needs attention'} · driver work only</p></div>
              <span className="xd2-count">{workboardTabs.find((tab) => tab.id === workboardView)?.count ?? 0} visible</span>
            </div>
            <div className="xd2-work-tabs">
              {workboardTabs.map((tab) => (
                <button key={tab.id} type="button" className={workboardView === tab.id ? 'active' : ''} onClick={() => setWorkboardView(tab.id)}>{tab.label}</button>
              ))}
            </div>
            <div id="dashWorkRows">
              {workboardView === 'attention' && !currentJob && documentAlerts.length === 0 && warningCount === 0 ? (
                <div className="xd2-empty">
                  <div className="xd2-empty-icon">✓</div>
                  <div><b>No driver work needs attention</b><span>Your operations queue is clear. Find marketplace work or open Diary to review bookings.</span></div>
                  <div className="xd2-empty-actions">
                    <button type="button" className="btn" onClick={() => router.push('/driver/loads')}>Find marketplace work</button>
                    <button type="button" className="btn primary" onClick={() => router.push('/driver/history')}>Open Diary</button>
                  </div>
                </div>
              ) : renderWorkboardBody()}
            </div>
            <div className="xd2-card-foot"><span>Showing live server-authoritative Driver data</span><button type="button" className="text-action" onClick={() => router.push('/driver/jobs')}>Open full jobs register →</button></div>
          </section>

          <section className="xd2-card xd2-readiness">
            <div className="xd2-card-head compact">
              <div><span className="xd2-card-kicker">RESOURCE READINESS</span><h3>Driver & vehicle</h3></div>
              <button type="button" className="text-action" onClick={() => router.push('/driver/availability')}>Live status</button>
            </div>
            <button type="button" className={'xd2-readiness-row ' + (driverProfile?.availability_status === 'available' ? 'good' : 'neutral')} onClick={() => router.push('/driver/availability')}>
              <div><span>Availability</span><small>{driverStatusValue}</small></div><b>{availabilityValue}</b>
            </button>
            <button type="button" className="xd2-readiness-row neutral" onClick={() => router.push('/driver/vehicles')}>
              <div><span>Active vehicle</span><small>{assignedVehicle ? vehicleLabel(assignedVehicle.type) : 'No canonical vehicle selected'}</small></div><b>{assignedVehicle?.reg_plate ?? '—'}</b>
            </button>
            <button type="button" className={'xd2-readiness-row ' + (documentAlerts.length ? 'warn' : 'good')} onClick={() => router.push('/driver/documents')}>
              <div><span>Document alerts</span><small>Documents requiring attention</small></div><b>{documentAlerts.length}</b>
            </button>
            <button type="button" className="xd2-readiness-row neutral" onClick={() => router.push('/driver/availability')}>
              <div><span>Future position</span><small>{driverProfile?.future_position ?? 'Not advertised'}</small></div><b>{futurePositionPublished ? fmtDate(driverProfile?.future_position_date) : '—'}</b>
            </button>
            <div className="xd2-readiness-actions">
              <button type="button" className="btn" onClick={() => router.push('/driver/vehicles')}>Vehicle</button>
              <button type="button" className="btn" onClick={() => router.push('/driver/availability')}>Availability</button>
            </div>
          </section>
        </div>

        <div className="xd2-secondary-grid">
          <section className="xd2-card">
            <div className="xd2-card-head compact"><div><span className="xd2-card-kicker">COMMERCIAL</span><h3>Commercial position</h3></div><button type="button" className="text-action" onClick={() => router.push('/driver/quotes')}>Quotes →</button></div>
            <div className="xd2-metric-list">
              <button type="button" className="xd2-metric" onClick={() => router.push('/driver/quotes')}><div><span>Accepted work value</span><small>Accepted marketplace quotes</small></div><b>{acceptedQuoteValue > 0 ? money(acceptedQuoteValue, 'GBP') : '—'}</b></button>
              <button type="button" className="xd2-metric" onClick={() => router.push('/driver/quotes')}><div><span>Quotes awaiting decision</span><small>Marketplace offers still open</small></div><b>{openQuotes}</b></button>
              <button type="button" className="xd2-metric" onClick={() => router.push('/driver/loads')}><div><span>Matching loads</span><small>Vehicle-matched marketplace work. Full quote eligibility remains server-authoritative.</small></div><b>{contextWarnings.loads ? '—' : relevantLoads.length}</b></button>
            </div>
          </section>

          <section className="xd2-card">
            <div className="xd2-card-head compact"><div><span className="xd2-card-kicker">SERVICE QUALITY</span><h3>Performance & evidence</h3></div></div>
            <div className="xd2-score-grid">
              <div><span>Latest feedback</span><b>{contextWarnings.feedback ? '—' : latestFeedback?.rating != null ? String(latestFeedback.rating) + '/5' : '—'}</b><small>Most recent completed-work rating</small></div>
              <div><span>Completed work</span><b>{completedJobsCount}</b><small>Delivered or completed jobs</small></div>
              <div><span>Document alerts</span><b>{documentAlerts.length}</b><small>Evidence / compliance queue</small></div>
            </div>
          </section>

          <section className="xd2-card">
            <div className="xd2-card-head compact"><div><span className="xd2-card-kicker">SHORTCUTS</span><h3>Driver workflow</h3></div></div>
            <div className="xd2-flow">
              {[
                ['Find marketplace work', 'Search suitable loads and lanes', '/driver/loads'],
                ['Price marketplace work', 'Review and manage submitted quotes', '/driver/quotes'],
                ['Execute allocated work', 'Continue the authoritative job lifecycle', currentJob ? '/driver/jobs/' + currentJob.id : '/driver/jobs'],
                ['Maintain readiness', 'Keep vehicle, availability and documents current', '/driver/documents'],
                ['Review history', 'Review delivered work and evidence', '/driver/history'],
              ].map(([title, description, href], index) => (
                <button key={title} type="button" className="dash-flow-row xd2-flow-row" onClick={() => router.push(href)}>
                  <span>{index + 1}</span><div><b>{title}</b><small>{description}</small></div><em>→</em>
                </button>
              ))}
            </div>
          </section>
        </div>

        <section className="xd2-card xd2-finance">
          <div className="xd2-card-head compact"><div><span className="xd2-card-kicker">DRIVER SNAPSHOT</span><h3>Business snapshot</h3></div><button type="button" className="text-action" onClick={() => router.push('/driver/quotes')}>Open Quotes →</button></div>
          <div className="xd2-finance-grid">
            <div><span>Accepted work value</span><b>{acceptedQuoteValue > 0 ? money(acceptedQuoteValue, 'GBP') : '—'}</b><small>Accepted marketplace pricing</small></div>
            <div><span>Accepted quotes</span><b>{acceptedQuotes}</b><small>Awarded marketplace work</small></div>
            <div><span>Completed jobs</span><b>{completedJobsCount}</b><small>Delivered / completed</small></div>
            <div><span>Documents</span><b>{myDocuments.length}</b><small>Driver compliance records</small></div>
          </div>
          <div className="xd2-report-links">
            {[
              ['My quotes', 'Quotes', '/driver/quotes'],
              ['Bookings', 'Diary', '/driver/history'],
              ['Marketplace loads', 'Loads', '/driver/loads'],
              ['Return journeys', 'Return Journeys', '/driver/returns'],
              ['Documents', 'Readiness', '/driver/documents'],
            ].map(([title, label, href]) => (
              <button key={title} type="button" className="dash-report-btn" onClick={() => router.push(href)}>
                <b>{title}</b><span>{label}</span><em>→</em>
              </button>
            ))}
          </div>
        </section>

        <div className="xd2-bottom-grid">
          <section className="xd2-card">
            <div className="xd2-card-head compact"><div><span className="xd2-card-kicker">RECENT ACTIVITY</span><h3>Latest bookings</h3></div><button type="button" className="text-action" onClick={() => router.push('/driver/history')}>View all</button></div>
            {dashboardBookings.length === 0 ? (
              <div className="xd2-calm-empty"><b>No recent driver bookings</b><span>New allocated and completed work will appear here.</span></div>
            ) : (
              <div className="driver-load-list">{dashboardBookings.map((job) => renderJobRow(job, 'Open job'))}</div>
            )}
          </section>

          <section className="xd2-card">
            <div className="xd2-card-head compact"><div><span className="xd2-card-kicker">COMPLIANCE</span><h3>Driver readiness</h3></div><button type="button" className="text-action" onClick={() => router.push('/driver/documents')}>Documents</button></div>
            <div className="xd2-compliance-grid">
              <div className="good"><span>Compliant records</span><b>{compliantDocuments}</b></div>
              <div className="warn"><span>Require attention</span><b>{documentAlerts.length}</b></div>
              <div className={warningCount ? 'danger' : 'good'}><span>Workspace exceptions</span><b>{warningCount}</b></div>
            </div>
          </section>
        </div>
      </DriverWorkspaceShell>
    </div>
  );
}
