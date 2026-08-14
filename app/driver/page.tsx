'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthContext';
import { resolveWorkspaceRole } from '../../lib/workspaceRole';
import { canonicalJobStatus, filterJobsForDriver, recentCompletedJobs } from '../../lib/driverDashboard';
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
  | { kind: 'transition'; nextStatus: string; label: string; description: string; resultLabel: string }
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
  pickup_location: string | null;
  pickup_postcode: string | null;
  pickup_datetime: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
  delivery_datetime: string | null;
  weight_kg: number | null;
  pallets: number | null;
  budget_amount: number | null;
  is_fixed_price: boolean | null;
  currency: string | null;
  exchange_posted_at: string | null;
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

const ACTIVE_STATUSES = new Set([
  'awarded',
  'allocated',
  'accepted',
  'on_my_way',
  'on_my_way_to_pickup',
  'on_site_pickup',
  'loaded',
  'collected',
  'in_transit',
  'on_my_way_to_delivery',
  'on_site_delivery',
  'delivered',
]);

const UPCOMING_STATUSES = new Set(['awarded', 'allocated', 'accepted']);

const NEXT_DRIVER_ACTIONS: Record<string, DriverNextAction> = {
  awarded: {
    kind: 'transition',
    nextStatus: 'on_my_way',
    label: 'On my way to pickup',
    description: 'Confirm departure for the collection point.',
    resultLabel: 'On my way to pickup',
  },
  allocated: {
    kind: 'transition',
    nextStatus: 'on_my_way',
    label: 'On my way to pickup',
    description: 'Confirm departure for the collection point.',
    resultLabel: 'On my way to pickup',
  },
  on_my_way: {
    kind: 'transition',
    nextStatus: 'on_site_pickup',
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
    nextStatus: 'in_transit',
    label: 'On my way to delivery',
    description: 'Confirm departure from collection with the load on board.',
    resultLabel: 'On my way to delivery',
  },
  in_transit: {
    kind: 'transition',
    nextStatus: 'on_site_delivery',
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
    nextStatus: 'completed',
    label: 'Complete job',
    description: 'Close the delivered job after POD has been captured.',
    resultLabel: 'Completed',
  },
  accepted: {
    kind: 'open',
    label: 'Open job',
    description: 'Continue this accepted job from the full execution screen.',
  },
  on_my_way_to_pickup: {
    kind: 'open',
    label: 'Open pickup',
    description: 'Continue this pickup state from the full execution screen.',
  },
  collected: {
    kind: 'open',
    label: 'Open delivery',
    description: 'Continue this delivery state from the full execution screen.',
  },
  on_my_way_to_delivery: {
    kind: 'open',
    label: 'Open delivery',
    description: 'Continue this delivery state from the full execution screen.',
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

function money(value: number | null | undefined) {
  if (value == null) return 'Open quote';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
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

  const currentJob = myJobs.find((job) => ACTIVE_STATUSES.has(canonicalJobStatus(job.current_status, job.status)));
  const currentStatus = currentJob ? canonicalJobStatus(currentJob.current_status, currentJob.status).toLowerCase() : null;
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
    .filter((job) => {
      const status = canonicalJobStatus(job.current_status, job.status);
      return UPCOMING_STATUSES.has(status)
        && Boolean(job.pickup_datetime)
        && new Date(job.pickup_datetime as string).getTime() > Date.now();
    })
    .sort((a, b) => String(a.pickup_datetime ?? '').localeCompare(String(b.pickup_datetime ?? '')));

  const recentBookings = [...myJobs]
    .filter((job) => job.id !== currentJob?.id)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 6);

  const recentCompleted = recentCompletedJobs(myJobs).slice(0, 4);
  const submittedQuotes = data.bids.filter((quote) => quote.status === 'submitted');
  const acceptedQuotes = data.bids.filter((quote) => quote.status === 'accepted');
  const myDocuments = data.driverDocuments.filter((document) => !user?.driverId || document.driver_id === user.driverId);
  const now = Date.now();
  const documentAlerts = myDocuments
    .filter((document) => {
      if (!document.expiry_date) return false;
      const expiry = new Date(document.expiry_date).getTime();
      return !Number.isNaN(expiry) && expiry <= now + 30 * 86_400_000;
    })
    .sort((a, b) => new Date(a.expiry_date ?? 0).getTime() - new Date(b.expiry_date ?? 0).getTime())
    .slice(0, 6);
  const expiredDocuments = documentAlerts.filter((document) => new Date(document.expiry_date ?? 0).getTime() < now);
  const myJobIds = useMemo(() => myJobs.map((job) => job.id), [myJobs]);
  const activeCompanyId = data.companyId ?? user?.companyId ?? null;

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

    const loadsPromise = supabase
      .from('jobs')
      .select('id, company_id, status, vehicle_type, pickup_location, pickup_postcode, pickup_datetime, delivery_location, delivery_postcode, delivery_datetime, weight_kg, pallets, budget_amount, is_fixed_price, currency, exchange_posted_at')
      .not('exchange_posted_at', 'is', null)
      .is('awarded_carrier_company_id', null)
      .in('status', ['posted'])
      .order('exchange_posted_at', { ascending: false })
      .limit(40);

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
          assignedVehicleId?: string | null;
          error?: string;
        };
        if (!response.ok) return { vehicle: null as DashboardVehicle | null, error: payload.error || 'Assigned vehicle could not be loaded.' };
        const vehicles = payload.vehicles ?? [];
        const vehicle = vehicles.find((row) => row.id === payload.assignedVehicleId)
          ?? vehicles.find((row) => row.assigned_driver_id === driverId)
          ?? null;
        return { vehicle, error: null as string | null };
      } catch {
        return { vehicle: null as DashboardVehicle | null, error: 'Assigned vehicle could not be loaded.' };
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
      warnings.loads = 'Relevant marketplace loads could not be loaded.';
      setRelevantLoads([]);
    } else {
      const marketplaceLoads = ((loadsRes.data ?? []) as DashboardMarketplaceLoad[])
        .filter((load) => !activeCompanyId || load.company_id !== activeCompanyId);
      const matched = vehicleRes.vehicle?.type
        ? marketplaceLoads.filter((load) => !load.vehicle_type || load.vehicle_type === vehicleRes.vehicle?.type)
        : [];
      setRelevantLoads(matched.slice(0, 4));
    }

    setContextWarnings(warnings);
    setContextLoading(false);
  }, [activeCompanyId, myJobIds, user?.driverId]);

  useEffect(() => {
    void loadDashboardContext();
  }, [loadDashboardContext]);

  const runCurrentAction = async () => {
    if (!currentJob || !currentAction) return;
    if (currentAction.kind === 'open') {
      router.push(`/driver/jobs/${currentJob.id}`);
      return;
    }

    const driverId = user?.driverId?.trim() ?? '';
    if (!driverId) {
      setTransitionError('Your driver profile is not available. Open the job and retry from the execution screen.');
      return;
    }

    setTransitioningJobId(currentJob.id);
    setTransitionError('');
    setTransitionMessage('');

    const { error } = await supabase.rpc('driver_update_job_status_atomic', {
      p_driver_id: driverId,
      p_job_id: currentJob.id,
      p_next_status: currentAction.nextStatus,
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
    const status = canonicalJobStatus(job.current_status, job.status);
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
          <strong className="driver-cell-primary">{load.pickup_location ?? 'Collection TBC'}</strong>
          <span className="driver-cell-secondary">{load.pickup_postcode ?? 'Postcode TBC'} · {fmtDate(load.pickup_datetime)}</span>
        </div>
        <div className="driver-load-cell">
          <span className="driver-cell-label">To</span>
          <strong className="driver-cell-primary">{load.delivery_location ?? 'Delivery TBC'}</strong>
          <span className="driver-cell-secondary">{load.delivery_postcode ?? 'Postcode TBC'} · {fmtDate(load.delivery_datetime)}</span>
        </div>
        <div className="driver-load-cell">
          <span className="driver-cell-label">Load</span>
          <strong className="driver-cell-primary">{vehicleLabel(load.vehicle_type)}</strong>
          <span className="driver-cell-secondary">{load.pallets != null ? `${load.pallets} pallets` : 'Pallets TBC'} · {load.weight_kg != null ? `${load.weight_kg} kg` : 'Weight TBC'}</span>
        </div>
        <div className="driver-load-cell">
          <span className="driver-cell-label">Commercial</span>
          <strong className="driver-cell-primary">{money(load.budget_amount)}</strong>
          <span className="driver-cell-secondary">Posted {fmtDate(load.exchange_posted_at)}</span>
        </div>
      </div>
      <div className="driver-load-row__meta">
        <StatusBadge value="Vehicle match" tone="blue" />
        <span>Load #{load.id.slice(0, 8).toUpperCase()}</span>
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
    : 'Not assigned';

  return (
    <div className="driver-reference-dashboard">
      <DriverWorkspaceShell
        personaLabel={ownerDriver ? 'Owner-driver workspace' : 'Driver workspace'}
        driverName="Driver Dashboard"
        subtitle="Current execution, bookings, marketplace matching, feedback and compliance readiness."
        availabilityLabel={driverProfile?.availability_status ? availabilityValue : (currentJob ? 'On a job' : undefined)}
        headerActions={<ActionButton tone="primary" onClick={() => void refreshDashboard()} disabled={data.loading || contextLoading}>Refresh</ActionButton>}
      >
        {data.error && <AlertBanner tone="danger">{data.error}</AlertBanner>}
        {transitionError && <AlertBanner tone="danger">{transitionError}</AlertBanner>}
        {transitionMessage && <AlertBanner tone="success">{transitionMessage}</AlertBanner>}

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
                <span>Assigned vehicle</span>
                <ActionButton tone="secondary" onClick={() => router.push('/driver/vehicles')}>Vehicle</ActionButton>
              </div>
              <div className="driver-dashboard-section__body">
                <dl className="driver-dashboard-facts">
                  <div><dt>Vehicle</dt><dd>{assignedVehicleName}</dd></div>
                  <div><dt>Type</dt><dd>{assignedVehicle ? vehicleLabel(assignedVehicle.type) : '—'}</dd></div>
                </dl>
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
                    <EmptyState compact title="No active job" description="Allocated work will appear here as the primary execution record." />
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
                    <EmptyState compact title="Assign a vehicle to enable load matching" description="The Dashboard only labels marketplace work as relevant when it matches your assigned vehicle." />
                  ) : relevantLoads.length === 0 ? (
                    <EmptyState compact title="No matching live loads" description={`No open marketplace work currently matches ${vehicleLabel(assignedVehicle.type)}.`} />
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
                ) : documentAlerts.length === 0 ? (
                  <div className="driver-dashboard-compliance-ready">
                    <StatusBadge value="Ready" tone="green" />
                    <span>No driver documents expire within the next 30 days.</span>
                  </div>
                ) : (
                  <div className="driver-dashboard-alert-list">
                    {documentAlerts.map((document) => {
                      const expiry = new Date(document.expiry_date ?? 0).getTime();
                      const expired = expiry < now;
                      return (
                        <div key={document.id} className="driver-dashboard-alert-row">
                          <div>
                            <strong>{humanize(document.doc_type ?? 'Driver document')}</strong>
                            <span>{expired ? 'Expired' : 'Expires'} {fmtFullDate(document.expiry_date)}</span>
                          </div>
                          <StatusBadge value={expired ? 'Expired' : 'Due soon'} tone={expired ? 'red' : 'orange'} />
                        </div>
                      );
                    })}
                    <div className="driver-dashboard-alert-summary">
                      <span>{expiredDocuments.length} expired · {documentAlerts.length - expiredDocuments.length} due within 30 days</span>
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
