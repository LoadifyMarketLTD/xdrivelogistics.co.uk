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
  const [_feedback, setFeedback] = useState<DashboardReview[]>([]);
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
            <span className="driver-cell-secondary">{job.pickup_postcode ?? 'Postcode TBC'} Â· {fmtDate(job.pickup_datetime)}</span>
          </div>
          <div className="driver-load-cell">
            <span className="driver-cell-label">To</span>
            <strong className="driver-cell-primary">{job.delivery_location ?? 'Delivery TBC'}</strong>
            <span className="driver-cell-secondary">{job.delivery_postcode ?? 'Postcode TBC'} Â· {fmtDate(job.delivery_datetime)}</span>
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
          <span className="driver-cell-secondary">{load.pallets != null ? `${load.pallets} pallets` : 'Pallets TBC'} Â· {load.weight_kg != null ? `${load.weight_kg} kg` : 'Weight TBC'}</span>
        </div>
        <div className="driver-load-cell">
          <span className="driver-cell-label">Commercial</span>
          <strong className="driver-cell-primary">{money(load.budget_amount, load.currency ?? 'GBP')}</strong>
          <span className="driver-cell-secondary">Posted {fmtDate(load.exchange_posted_at)}</span>
        </div>
      </div>
      <div className="driver-load-row__meta">
        <StatusBadge value="Vehicle type match" tone="blue" />
        <span><strong>To Collection:</strong> {load.distance_to_pickup_miles != null ? `${load.distance_to_pickup_miles.toFixed(1)} mi${load.pickup_eta_minutes != null ? ` Â· ${Math.round(load.pickup_eta_minutes)} min` : ''}` : 'Not available'}</span>
        <span><strong>Job Distance:</strong> {load.distance_miles != null ? `${load.distance_miles.toFixed(1)} mi${load.distance_minutes != null ? ` Â· ${Math.round(load.distance_minutes)} min` : ''}` : 'Not available'}</span>
        <span>{load.member?.name ?? 'Marketplace member'}{load.member?.phone ? ` Â· ${load.member.phone}` : ''}</span>
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
    ? [vehicleLabel(assignedVehicle.type), assignedVehicle.reg_plate].filter(Boolean).join(' Â· ')
    : 'Not available';

  const dashboardBookings = recentBookings.filter((job) => job.id !== upcomingJobs[0]?.id).slice(0, 3);
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
            {transitioningJobId === currentJob.id ? 'Savingâ€¦' : currentAction.label}
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

  const compliantDocuments = Math.max(0, myDocuments.length - documentAlerts.length);
  const futurePositionPublished = driverProfile?.future_position ? 1 : 0;
  const ownerInvoices = ownerDriver ? data.invoices : [];
  const ownerPaidInvoices = ownerInvoices.filter((invoice) =>
    String(invoice.payment_status ?? invoice.status ?? '').toLowerCase() === 'paid'
  );
  const ownerOutstandingInvoices = ownerInvoices.filter((invoice) =>
    String(invoice.payment_status ?? invoice.status ?? '').toLowerCase() !== 'paid'
  );
  const ownerOutstandingValue = ownerOutstandingInvoices.reduce(
    (sum, invoice) => sum + Number(invoice.amount ?? invoice.net_amount ?? 0),
    0,
  );

  return (
    <div className="driver-reference-dashboard driver-prototype-dashboard driver-exact-prototype">
      <DriverWorkspaceShell
        personaLabel={ownerDriver ? 'Owner-driver workspace' : 'Driver workspace'}
        driverName="Dashboard"
        subtitle="Live operations, jobs, vehicle readiness and compliance."
        headerActions={<>
          <button type="button" className="btn" onClick={() => router.push('/driver/history')}>Open Diary</button>
          <button type="button" className="btn" onClick={() => router.push('/driver/action-centre')}>Action Centre</button>
          <button type="button" className="btn primary" onClick={() => void refreshDashboard()} disabled={data.loading || contextLoading}>Refresh</button>
        </>}
      >
        {data.error && <AlertBanner tone="danger">{data.error}</AlertBanner>}
        {transitionMessage && <AlertBanner tone="success">{transitionMessage}</AlertBanner>}

        <section className="driver-dashboard-statusbar" aria-label="Driver operational summary">
          <button type="button" onClick={() => router.push('/driver/availability')}>
            <span>Availability</span><strong>{availabilityValue}</strong><small>{driverStatusValue}</small>
          </button>
          <button type="button" onClick={() => router.push('/driver/vehicles')}>
            <span>Active vehicle</span><strong>{assignedVehicle?.reg_plate ?? 'Not assigned'}</strong><small>{assignedVehicle ? vehicleLabel(assignedVehicle.type) : 'Select vehicle'}</small>
          </button>
          <button type="button" onClick={() => setWorkboardView('attention')}>
            <span>Needs attention</span><strong>{needsAttentionCount}</strong><small>{needsAttentionCount ? 'Driver actions or alerts' : 'No urgent actions'}</small>
          </button>
          <button type="button" onClick={() => setWorkboardView('upcoming')}>
            <span>Upcoming work</span><strong>{upcomingJobs.length}</strong><small>Allocated work</small>
          </button>
          <button type="button" onClick={() => setWorkboardView('live')}>
            <span>Live jobs</span><strong>{liveJobs.length}</strong><small>Currently executing</small>
          </button>
          <button type="button" onClick={() => router.push('/driver/loads')}>
            <span>Matching loads</span><strong>{contextWarnings.loads ? 'â€”' : relevantLoads.length}</strong><small>{assignedVehicle ? vehicleLabel(assignedVehicle.type) : 'Active vehicle required'}. Full quote eligibility remains server-authoritative.</small>
          </button>
        </section>

        <section className="driver-dashboard-register">
          <div className="driver-dashboard-register__head">
            <div>
              <strong>My Work</strong>
              <span>Live Driver operations and job lifecycle</span>
            </div>
            <div className="driver-dashboard-register__actions">
              <button type="button" className="btn" onClick={() => router.push('/driver/loads')}>Find Loads</button>
              <button type="button" className="btn" onClick={() => router.push('/driver/history')}>Diary</button>
              <button type="button" className="btn primary" onClick={() => router.push('/driver/jobs')}>Jobs Register</button>
            </div>
          </div>
          <div className="driver-dashboard-tabs" role="tablist" aria-label="Driver work filters">
            {workboardTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                data-active={workboardView === tab.id ? 'true' : 'false'}
                onClick={() => setWorkboardView(tab.id)}
              >
                {tab.label}<span>{tab.count}</span>
              </button>
            ))}
          </div>

          <div className="driver-dashboard-register__body">
            {workboardView === 'attention' && !currentJob && documentAlerts.length === 0 && warningCount === 0 ? (
              <div className="driver-dashboard-clear">
                <strong>No driver work needs attention</strong>
                <span>Your operations queue is clear.</span>
              </div>
            ) : renderWorkboardBody()}
          </div>
        </section>

        <section className="driver-dashboard-register">
          <div className="driver-dashboard-register__head">
            <div>
              <strong>Recent Bookings</strong>
              <span>Latest allocated and completed Driver work</span>
            </div>
            <button type="button" className="text-action" onClick={() => router.push('/driver/history')}>Open Diary â†’</button>
          </div>
          <div className="driver-dashboard-register__body">
            {dashboardBookings.length === 0 ? (
              <EmptyState compact title="No recent driver bookings" description="New allocated and completed work will appear here." />
            ) : (
              <div className="driver-load-list">{dashboardBookings.map((job) => renderJobRow(job, 'Open job'))}</div>
            )}
          </div>
        </section>

        {ownerDriver ? (
          <section className="driver-dashboard-readiness" aria-label="Owner driver commercial position">
            <div className="driver-dashboard-register__head">
              <div>
                <strong>Owner Driver Commercial Position</strong>
                <span>Invoices, payment exposure, business readiness and return capacity.</span>
              </div>
              <button type="button" className="text-action" onClick={() => router.push('/driver/finance')}>Open Finance</button>
            </div>
            <div className="driver-dashboard-readiness__grid">
              <button type="button" onClick={() => router.push('/driver/finance')}>
                <span>Invoice readiness</span><strong>{ownerInvoices.length} invoice{ownerInvoices.length === 1 ? '' : 's'}</strong><small>Owner-driver finance register</small>
              </button>
              <button type="button" onClick={() => router.push('/driver/finance')}>
                <span>Outstanding</span><strong>{money(ownerOutstandingValue)}</strong><small>{ownerOutstandingInvoices.length} awaiting payment</small>
              </button>
              <button type="button" onClick={() => router.push('/driver/finance')}>
                <span>Paid</span><strong>{ownerPaidInvoices.length}</strong><small>Paid invoice records</small>
              </button>
              <button type="button" onClick={() => router.push('/settings/billing')}>
                <span>Business account</span><strong>{driverProfile?.status ?? 'Account active'}</strong><small>Membership & billing</small>
              </button>
              <button type="button" onClick={() => router.push('/driver/returns')}>
                <span>Return capacity</span><strong>{driverProfile?.future_position ?? 'Not advertised'}</strong><small>Return Journeys & future position</small>
              </button>
              <button type="button" onClick={() => router.push('/driver/messages')}>
                <span>Commercial contacts</span><strong>Messages</strong><small>Open job and network conversations</small>
              </button>
            </div>
          </section>
        ) : null}
        <section className="driver-dashboard-readiness">
          <div className="driver-dashboard-register__head">
            <div>
              <strong>Driver & Vehicle Readiness</strong>
              <span>Operational status in one compact register</span>
            </div>
            <button type="button" className="text-action" onClick={() => router.push('/driver/documents')}>Documents â†’</button>
          </div>
          <div className="driver-dashboard-readiness__grid">
            <button type="button" onClick={() => router.push('/driver/availability')}>
              <span>Availability</span><strong>{availabilityValue}</strong><small>{driverStatusValue}</small>
            </button>
            <button type="button" onClick={() => router.push('/driver/vehicles')}>
              <span>Vehicle</span><strong>{assignedVehicle?.reg_plate ?? 'Not assigned'}</strong><small>{assignedVehicle ? vehicleLabel(assignedVehicle.type) : 'No canonical vehicle selected'}</small>
            </button>
            <button type="button" onClick={() => router.push('/driver/documents')}>
              <span>Documents</span><strong>{compliantDocuments} compliant</strong><small>{documentAlerts.length} require attention</small>
            </button>
            <button type="button" onClick={() => router.push('/driver/availability')}>
              <span>Future position</span><strong>{driverProfile?.future_position ?? 'Not advertised'}</strong><small>{futurePositionPublished ? fmtDate(driverProfile?.future_position_date) : 'No future position'}</small>
            </button>
          </div>
        </section>
      </DriverWorkspaceShell>
    </div>
  );
}
