'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '../components/AuthContext';
import { useCompanyWorkspaceData } from '../components/workspace/useCompanyWorkspaceData';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
} from '../components/workspace/WorkspaceUI';
import { canonicalJobStatus, filterJobsForDriver } from '../../lib/driverDashboard';
import {
  jobLifecyclePresentationGroup,
  nextDriverExecutionStatus,
} from '../../lib/jobs/jobLifecyclePresentation';
import { workspaceJobPresentationStatus } from '../../lib/jobs/workspaceJobStage';
import { resolveWorkspaceRole } from '../../lib/workspaceRole';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';
import { VEHICLE_TYPE_LABELS } from '../../lib/vehicleTypes';
import DriverWorkspaceShell from './_components/DriverWorkspaceShell';

type DriverProfile = {
  availability_status: string | null;
  status: string | null;
  future_position: string | null;
  future_position_date: string | null;
};

type DriverVehicle = {
  id: string;
  type: string | null;
  reg_plate: string | null;
  make: string | null;
  model: string | null;
};

type DriverAction = {
  label: string;
  description: string;
  mode: 'transition' | 'open';
};

const ACTIONS: Readonly<Record<string, DriverAction>> = {
  allocated: {
    label: 'Accept job',
    description: 'Accept this booking before starting the collection journey.',
    mode: 'transition',
  },
  accepted: {
    label: 'On my way to pickup',
    description: 'Confirm departure for the collection point.',
    mode: 'transition',
  },
  on_my_way: {
    label: 'On site at pickup',
    description: 'Confirm arrival at the collection point.',
    mode: 'transition',
  },
  on_site_pickup: {
    label: 'Add collection evidence',
    description: 'Open the job to add collection evidence before loading.',
    mode: 'open',
  },
  loaded: {
    label: 'On my way to delivery',
    description: 'Confirm departure from collection with the goods on board.',
    mode: 'transition',
  },
  in_transit: {
    label: 'On site at delivery',
    description: 'Confirm arrival at the delivery point.',
    mode: 'transition',
  },
  on_site_delivery: {
    label: 'Capture POD',
    description: 'Open the job to capture delivery evidence and signature.',
    mode: 'open',
  },
  delivered: {
    label: 'Complete job',
    description: 'Close the delivered job after POD has been captured.',
    mode: 'transition',
  },
};

const humanize = (value: string | null | undefined) =>
  value ? value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase()) : 'Unavailable';

const formatDate = (value: string | null | undefined) => {
  if (!value) return 'TBC';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'TBC';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const vehicleLabel = (value: string | null | undefined) =>
  value ? (VEHICLE_TYPE_LABELS[value] ?? humanize(value)) : 'Not assigned';

export default function DriverDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const data = useCompanyWorkspaceData();

  const workspaceRole = resolveWorkspaceRole(user);
  const ownerDriver = workspaceRole === 'owner_driver';
  const commercialAccess = ownerDriver || user?.canCommercialBid === true;

  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [vehicle, setVehicle] = useState<DriverVehicle | null>(null);
  const [contextError, setContextError] = useState('');
  const [contextLoading, setContextLoading] = useState(true);
  const [transitioningJobId, setTransitioningJobId] = useState<string | null>(null);
  const [transitionError, setTransitionError] = useState('');
  const [transitionMessage, setTransitionMessage] = useState('');

  const myJobs = useMemo(
    () => filterJobsForDriver(data.jobs, { driverId: user?.driverId, ownerDriver }),
    [data.jobs, ownerDriver, user?.driverId],
  );

  const activeJobs = useMemo(
    () => myJobs
      .filter((job) => jobLifecyclePresentationGroup(workspaceJobPresentationStatus(job)) === 'active')
      .sort((a, b) => String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? ''))),
    [myJobs],
  );

  const upcomingJobs = useMemo(
    () => myJobs
      .filter((job) => jobLifecyclePresentationGroup(workspaceJobPresentationStatus(job)) === 'upcoming')
      .sort((a, b) => String(a.pickup_datetime ?? '').localeCompare(String(b.pickup_datetime ?? ''))),
    [myJobs],
  );

  const currentJob = activeJobs[0] ?? upcomingJobs[0] ?? null;
  const nextBooking = currentJob
    ? upcomingJobs.find((job) => job.id !== currentJob.id) ?? null
    : upcomingJobs[0] ?? null;

  const currentStatus = currentJob
    ? canonicalJobStatus(currentJob.current_status, currentJob.status)
    : null;
  const currentAction = currentStatus
    ? ACTIONS[currentStatus] ?? {
        label: 'Open job',
        description: 'Continue this booking from the full job screen.',
        mode: 'open' as const,
      }
    : null;

  const loadDriverContext = useCallback(async () => {
    const driverId = user?.driverId?.trim() ?? '';
    if (!driverId || !isSupabaseConfigured) {
      setProfile(null);
      setVehicle(null);
      setContextError(driverId ? 'Driver context is unavailable.' : 'Driver profile is not available for this account.');
      setContextLoading(false);
      return;
    }

    setContextLoading(true);
    setContextError('');

    const profilePromise = supabase
      .from('drivers')
      .select('availability_status, status, future_position, future_position_date')
      .eq('id', driverId)
      .maybeSingle();

    const vehiclePromise = (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return { vehicle: null as DriverVehicle | null, error: 'Vehicle session could not be verified.' };

      try {
        const response = await fetch('/api/driver/vehicles', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => ({})) as {
          vehicles?: DriverVehicle[];
          canonicalVehicleId?: string | null;
          error?: string;
        };

        if (!response.ok) {
          return { vehicle: null as DriverVehicle | null, error: payload.error || 'Active vehicle could not be loaded.' };
        }

        const vehicles = payload.vehicles ?? [];
        const activeVehicle = payload.canonicalVehicleId
          ? vehicles.find((candidate) => candidate.id === payload.canonicalVehicleId) ?? null
          : null;

        return { vehicle: activeVehicle, error: null as string | null };
      } catch {
        return { vehicle: null as DriverVehicle | null, error: 'Active vehicle could not be loaded.' };
      }
    })();

    const [profileResult, vehicleResult] = await Promise.all([profilePromise, vehiclePromise]);

    if (profileResult.error) {
      setProfile(null);
      setContextError('Availability could not be loaded.');
    } else {
      setProfile((profileResult.data as DriverProfile | null) ?? null);
    }

    if (vehicleResult.error) {
      setVehicle(null);
      setContextError((current) => current || vehicleResult.error || 'Active vehicle could not be loaded.');
    } else {
      setVehicle(vehicleResult.vehicle);
    }

    setContextLoading(false);
  }, [user?.driverId]);

  useEffect(() => {
    void loadDriverContext();
  }, [loadDriverContext]);

  const refreshDashboard = async () => {
    await Promise.all([data.refresh(), loadDriverContext()]);
  };

  const runCurrentAction = async () => {
    if (!currentJob || !currentAction || !currentStatus) return;

    if (currentAction.mode === 'open') {
      router.push(`/driver/jobs/${currentJob.id}`);
      return;
    }

    const driverId = user?.driverId?.trim() ?? '';
    const nextStatus = nextDriverExecutionStatus(currentStatus);
    if (!driverId || !nextStatus) {
      setTransitionError('Open the full job to continue this lifecycle step.');
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
      setTransitionError('The job status could not be updated here. Open the full job and retry.');
    } else {
      setTransitionMessage(`Job updated: ${humanize(nextStatus)}.`);
      await data.refresh();
    }

    setTransitioningJobId(null);
  };

  const jobsDataset = data.datasets.jobs;
  const invoicesDataset = data.datasets.invoices;
  const assignedWorkMetric = jobsDataset.availability !== 'available'
    ? 'â€”'
    : jobsDataset.partialData || jobsDataset.limitedData
      ? 'Partial'
      : myJobs.length;
  const ownerInvoices = ownerDriver ? data.invoices : [];
  const ownerOutstandingInvoices = ownerInvoices.filter(
    (invoice) => String(invoice.payment_status ?? invoice.status ?? '').toLowerCase() !== 'paid',
  );
  const ownerInvoiceMetric = invoicesDataset.availability !== 'available'
    ? 'â€”'
    : invoicesDataset.partialData || invoicesDataset.limitedData
      ? 'Partial'
      : ownerOutstandingInvoices.length;

  const renderJobSummary = (job: (typeof myJobs)[number]) => {
    const status = workspaceJobPresentationStatus(job);
    return (
      <div className="driver-load-row">
        <div className="driver-load-row__top">
          <div className="driver-load-cell">
            <span className="driver-cell-label">Collection</span>
            <strong className="driver-cell-primary">{job.pickup_postcode ?? job.pickup_location ?? 'TBC'}</strong>
            <span className="driver-cell-secondary">{formatDate(job.pickup_datetime)}</span>
          </div>
          <div className="driver-load-cell">
            <span className="driver-cell-label">Delivery</span>
            <strong className="driver-cell-primary">{job.delivery_postcode ?? job.delivery_location ?? 'TBC'}</strong>
            <span className="driver-cell-secondary">{formatDate(job.delivery_datetime)}</span>
          </div>
          <div className="driver-load-cell">
            <span className="driver-cell-label">Vehicle</span>
            <strong className="driver-cell-primary">{vehicleLabel(job.vehicle_type)}</strong>
            <span className="driver-cell-secondary">XDL-{job.id.slice(0, 8).toUpperCase()}</span>
          </div>
          <div className="driver-load-cell">
            <span className="driver-cell-label">Status</span>
            <strong className="driver-cell-primary">{humanize(status)}</strong>
            <span className="driver-cell-secondary">Shared job lifecycle</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="driver-reference-dashboard driver-prototype-dashboard driver-exact-prototype">
      <DriverWorkspaceShell
        personaLabel={ownerDriver ? 'Owner-driver workspace' : 'Driver workspace'}
        driverName="Today"
        subtitle="Your current job, next action and next booking."
        headerActions={
          <>
            <button
              type="button"
              className="btn primary"
              onClick={() => void refreshDashboard()}
              disabled={data.loading || contextLoading}
            >
              Refresh
            </button>
          </>
        }
      >
        {data.error ? <AlertBanner tone="danger">{data.error}</AlertBanner> : null}
        {contextError ? <AlertBanner tone="warning">{contextError}</AlertBanner> : null}
        {transitionError ? <AlertBanner tone="danger">{transitionError}</AlertBanner> : null}
        {transitionMessage ? <AlertBanner tone="success">{transitionMessage}</AlertBanner> : null}

        <section className="driver-dashboard-statusbar" aria-label="Driver status">
          <button type="button" onClick={() => router.push('/driver/availability')}>
            <span>Availability</span>
            <strong>{humanize(profile?.availability_status)}</strong>
            <small>{humanize(profile?.status)}</small>
          </button>
          <button type="button" onClick={() => router.push('/driver/vehicles')}>
            <span>Active vehicle</span>
            <strong>{vehicle?.reg_plate ?? 'Not assigned'}</strong>
            <small>{vehicle ? vehicleLabel(vehicle.type) : 'Select vehicle'}</small>
          </button>
          <button type="button" onClick={() => router.push('/driver/jobs')}>
            <span>Assigned work</span>
            <strong>{assignedWorkMetric}</strong>
            <small>{jobsDataset.availability !== 'available'
              ? 'Assignment data unavailable'
              : jobsDataset.partialData || jobsDataset.limitedData
                ? 'Assignment data partial'
                : `${activeJobs.length} live Â· ${upcomingJobs.length} upcoming`}</small>
          </button>
        </section>

        <section className="driver-dashboard-register">
          <div className="driver-dashboard-register__head">
            <div>
              <strong>Current assignment</strong>
              <span>The job and action that matter now</span>
            </div>
            {currentJob ? (
              <button type="button" className="text-action" onClick={() => router.push(`/driver/jobs/${currentJob.id}`)}>
                Open full job
              </button>
            ) : null}
          </div>
          <div className="driver-dashboard-register__body">
            {currentJob && currentAction ? (
              <>
                {renderJobSummary(currentJob)}
                <div className="driver-proto-next-action">
                  <div>
                    <span>NEXT ACTION</span>
                    <strong>{currentAction.label}</strong>
                    <small>{currentAction.description}</small>
                  </div>
                  <ActionButton
                    tone="success"
                    disabled={transitioningJobId === currentJob.id}
                    onClick={() => void runCurrentAction()}
                  >
                    {transitioningJobId === currentJob.id ? 'Savingâ€¦' : currentAction.label}
                  </ActionButton>
                </div>
              </>
            ) : jobsDataset.availability !== 'available' ? (
              <EmptyState
                compact
                title="Assignment data unavailable"
                description="The dashboard cannot confirm that there is no current assignment until the jobs source is available."
              />
            ) : jobsDataset.partialData || jobsDataset.limitedData ? (
              <EmptyState
                compact
                title="Assignment data is partial"
                description="The visible jobs dataset is incomplete, so the dashboard does not claim that there is no current assignment."
              />
            ) : (
              <EmptyState
                compact
                title="No current assignment"
                description="There is no allocated or active job requiring action."
              />
            )}
          </div>
        </section>

        <section className="driver-dashboard-register">
          <div className="driver-dashboard-register__head">
            <div>
              <strong>Next booking</strong>
              <span>Your next allocated collection after the current assignment</span>
            </div>
            <button type="button" className="text-action" onClick={() => router.push('/driver/history')}>Open Diary â†’</button>
          </div>
          <div className="driver-dashboard-register__body">
            {nextBooking ? (
              <>
                {renderJobSummary(nextBooking)}
                <div className="driver-row-actions">
                  <ActionButton tone="secondary" onClick={() => router.push(`/driver/jobs/${nextBooking.id}`)}>
                    View booking
                  </ActionButton>
                </div>
              </>
            ) : jobsDataset.availability !== 'available' ? (
              <EmptyState compact title="Booking data unavailable" description="The next booking cannot be confirmed until the jobs source is available." />
            ) : jobsDataset.partialData || jobsDataset.limitedData ? (
              <EmptyState compact title="Booking data is partial" description="The visible jobs dataset is incomplete, so the dashboard does not claim that there is no next booking." />
            ) : (
              <EmptyState compact title="No next booking" description="No additional allocated work is scheduled." />
            )}
          </div>
        </section>

        <section className="driver-dashboard-readiness">
          <div className="driver-dashboard-register__head">
            <div>
              <strong>Driver readiness</strong>
              <span>Only the essentials required to execute customer work</span>
            </div>
            <button type="button" className="text-action" onClick={() => router.push('/driver/documents')}>Documents â†’</button>
          </div>
          <div className="driver-dashboard-readiness__grid">
            <button type="button" onClick={() => router.push('/driver/availability')}>
              <span>Availability</span>
              <strong>{humanize(profile?.availability_status)}</strong>
              <small>Update your working status</small>
            </button>
            <button type="button" onClick={() => router.push('/driver/vehicles')}>
              <span>Vehicle</span>
              <strong>{vehicle?.reg_plate ?? 'Not assigned'}</strong>
              <small>{vehicle ? vehicleLabel(vehicle.type) : 'Active vehicle required'}</small>
            </button>
            <button type="button" onClick={() => router.push('/driver/documents')}>
              <span>Documents</span>
              <strong>Open</strong>
              <small>Check driver and vehicle evidence</small>
            </button>
          </div>
        </section>

        {ownerDriver ? (
          <section className="driver-dashboard-register">
            <div className="driver-dashboard-register__head">
              <div>
                <strong>Owner Driver Commercial Position</strong>
                <span>Business signals kept separate from employed-driver execution.</span>
              </div>
            </div>
            <div className="driver-dashboard-readiness__grid">
              <button type="button" onClick={() => router.push('/driver/finance')}>
                <span>Invoice readiness</span>
                <strong>{invoicesDataset.availability !== 'available'
                  ? 'Unavailable'
                  : invoicesDataset.partialData || invoicesDataset.limitedData
                    ? 'Partial'
                    : 'Ready'}</strong>
                <small>Only complete finance data is presented as exact.</small>
              </button>
              <button type="button" onClick={() => router.push('/driver/finance')}>
                <span>Outstanding</span>
                <strong>{ownerInvoiceMetric}</strong>
                <small>Owner-driver invoices requiring settlement.</small>
              </button>
              <button type="button" onClick={() => router.push('/driver/returns')}>
                <span>Return capacity</span>
                <strong>{profile?.future_position ?? 'Not published'}</strong>
                <small>{profile?.future_position_date ? formatDate(profile.future_position_date) : 'No future destination published'}</small>
              </button>
            </div>
          </section>
        ) : null}

        {commercialAccess && !ownerDriver ? (
          <section className="driver-dashboard-register">
            <div className="driver-dashboard-register__head">
              <div>
                <strong>Commercial tools</strong>
                <span>Visible only where commercial bidding authority is enabled</span>
              </div>
            </div>
            <div className="driver-dashboard-register__body">
              <div className="driver-action-grid">
                <ActionButton tone="secondary" onClick={() => router.push('/driver/loads')}>Find Loads</ActionButton>
                <ActionButton tone="secondary" onClick={() => router.push('/driver/quotes')}>My Quotes</ActionButton>
                <ActionButton tone="secondary" onClick={() => router.push('/driver/won-work')}>Won Work</ActionButton>
                <ActionButton tone="secondary" onClick={() => router.push('/driver/nearby')}>Who's Nearby</ActionButton>
                <ActionButton tone="secondary" onClick={() => router.push('/driver/returns')}>Return Journeys</ActionButton>
              </div>
            </div>
          </section>
        ) : null}

      </DriverWorkspaceShell>
    </div>
  );
}
