'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '../components/AuthContext';
import { useCompanyWorkspaceData } from '../components/workspace/useCompanyWorkspaceData';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  OperationalCard,
  StatusBadge,
  workspaceTheme,
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

type DriverCommercialSummary = {
  period: string;
  revenueGross: number;
  subcontractSpend: number;
  recordedGrossMargin: number;
  accountsPayable: {
    received: number;
    dueForPayment: number;
    awaitingPayment: number;
    totalGross: number;
  };
  bookingsSubcontracted: number;
  feedback90Days: {
    received: number;
    given: number;
    receivedRatingAverage: number | null;
  };
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

const money = (value: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(value || 0));

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
  const [decliningJobId, setDecliningJobId] = useState<string | null>(null);
  const [transitionError, setTransitionError] = useState('');
  const [transitionMessage, setTransitionMessage] = useState('');
  const [commercialSummary, setCommercialSummary] = useState<DriverCommercialSummary | null>(null);
  const [commercialSummaryLoading, setCommercialSummaryLoading] = useState(false);
  const [commercialSummaryError, setCommercialSummaryError] = useState('');
  const [commercialPeriod, setCommercialPeriod] = useState<'today' | '7d' | '30d' | 'all' | 'custom'>('today');
  const [commercialFrom, setCommercialFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [commercialTo, setCommercialTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [memberNameByJob, setMemberNameByJob] = useState<Record<string, string>>({});
  const [bookingMemberFilter, setBookingMemberFilter] = useState('');
  const [bookingLocationFilter, setBookingLocationFilter] = useState('');
  const [bookingReferenceFilter, setBookingReferenceFilter] = useState('');

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

  const loadCommercialSummary = useCallback(async () => {
    if (!ownerDriver || !isSupabaseConfigured) return;
    setCommercialSummaryLoading(true);
    setCommercialSummaryError('');
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setCommercialSummaryError('Commercial summary session could not be verified.');
      setCommercialSummaryLoading(false);
      return;
    }
    try {
      const params = new URLSearchParams({ period: commercialPeriod });
      if (commercialPeriod === 'custom') {
        params.set('from', commercialFrom);
        params.set('to', commercialTo);
      }
      const response = await fetch(`/api/driver/dashboard/commercial-summary?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => null) as (DriverCommercialSummary & { error?: string }) | null;
      if (!response.ok || !payload) throw new Error(payload?.error ?? 'Commercial summary could not be loaded.');
      setCommercialSummary(payload);
    } catch (reason) {
      setCommercialSummary(null);
      setCommercialSummaryError(reason instanceof Error ? reason.message : 'Commercial summary could not be loaded.');
    } finally {
      setCommercialSummaryLoading(false);
    }
  }, [commercialFrom, commercialPeriod, commercialTo, ownerDriver]);

  const loadDashboardMemberNames = useCallback(async () => {
    if (!ownerDriver || !isSupabaseConfigured) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setMemberNameByJob({});
      return;
    }

    try {
      const response = await fetch('/api/driver/diary/company-names', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => null) as {
        members?: Array<{ jobId: string; name: string | null }>;
      } | null;
      if (!response.ok || !payload?.members) {
        setMemberNameByJob({});
        return;
      }
      setMemberNameByJob(Object.fromEntries(
        payload.members
          .filter((row) => row.name)
          .map((row) => [row.jobId, row.name as string]),
      ));
    } catch {
      setMemberNameByJob({});
    }
  }, [ownerDriver]);

  const latestBookings = useMemo(() => {
    const memberNeedle = bookingMemberFilter.trim().toLowerCase();
    const locationNeedle = bookingLocationFilter.trim().toLowerCase();
    const refNeedle = bookingReferenceFilter.trim().toLowerCase();
    return [...myJobs]
      .filter((job) => {
        const memberText = `${memberNameByJob[job.id] ?? job.client_name ?? ''}`.toLowerCase();
        const locationText = `${job.pickup_location ?? ''} ${job.pickup_postcode ?? ''} ${job.delivery_location ?? ''} ${job.delivery_postcode ?? ''}`.toLowerCase();
        const refText = `${job.id} ${job.booking_reference ?? ''} ${job.customer_reference ?? ''}`.toLowerCase();
        return (!memberNeedle || memberText.includes(memberNeedle))
          && (!locationNeedle || locationText.includes(locationNeedle))
          && (!refNeedle || refText.includes(refNeedle));
      })
      .sort((a, b) => String(b.updated_at ?? b.created_at ?? '').localeCompare(String(a.updated_at ?? a.created_at ?? '')))
      .slice(0, 4);
  }, [bookingLocationFilter, bookingMemberFilter, bookingReferenceFilter, memberNameByJob, myJobs]);

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

  useEffect(() => {
    if (ownerDriver) {
      void loadCommercialSummary();
      void loadDashboardMemberNames();
    }
  }, [loadCommercialSummary, loadDashboardMemberNames, ownerDriver]);

  const refreshDashboard = async () => {
    const tasks: Promise<unknown>[] = [data.refresh(), loadDriverContext()];
    if (ownerDriver) {
      tasks.push(loadCommercialSummary());
      tasks.push(loadDashboardMemberNames());
    }
    await Promise.all(tasks);
  };

  const requestJobCancellation = async (jobId: string) => {
    const rawReason = window.prompt('Reason for declining this booking (minimum 5 characters):');
    if (rawReason === null) return;
    const reason = rawReason.trim();
    if (reason.length < 5) {
      setTransitionError('A cancellation reason of at least 5 characters is required.');
      return;
    }

    setDecliningJobId(jobId);
    setTransitionError('');
    setTransitionMessage('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      let token = sessionData.session?.access_token;
      if (!token) {
        const refreshed = await supabase.auth.refreshSession();
        token = refreshed.data.session?.access_token;
      }
      if (!token) throw new Error('Your session has expired. Sign in again.');

      const response = await fetch(`/api/driver/jobs/${encodeURIComponent(jobId)}/cancellation`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? 'Cancellation could not be requested.');

      setTransitionMessage('Cancellation request submitted.');
      await data.refresh();
    } catch (reasonValue) {
      setTransitionError(reasonValue instanceof Error ? reasonValue.message : 'Cancellation could not be requested.');
    } finally {
      setDecliningJobId(null);
    }
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
  const assignedWorkMetric = jobsDataset.availability !== 'available'
    ? '—'
    : jobsDataset.partialData || jobsDataset.limitedData
      ? 'Partial'
      : myJobs.length;

  const renderJobSummary = (job: (typeof myJobs)[number]) => {
    const status = canonicalJobStatus(job.current_status, job.status);
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
        hideHeader={ownerDriver}
        driverName="Today"
        subtitle={ownerDriver ? undefined : 'Your current job, next action and next booking.'}
        headerActions={ownerDriver ? undefined : (
          <button
            type="button"
            className="btn primary"
            onClick={() => void refreshDashboard()}
            disabled={data.loading || contextLoading}
          >
            Refresh
          </button>
        )}
      >
        {data.error ? <AlertBanner tone="danger">{data.error}</AlertBanner> : null}
        {contextError ? <AlertBanner tone="warning">{contextError}</AlertBanner> : null}
        {transitionError ? <AlertBanner tone="danger">{transitionError}</AlertBanner> : null}
        {transitionMessage ? <AlertBanner tone="success">{transitionMessage}</AlertBanner> : null}

        {!ownerDriver ? <>
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
                : `${activeJobs.length} live · ${upcomingJobs.length} upcoming`}</small>
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
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <ActionButton
                      tone="success"
                      disabled={transitioningJobId === currentJob.id || decliningJobId === currentJob.id}
                      onClick={() => void runCurrentAction()}
                    >
                      {transitioningJobId === currentJob.id ? 'Saving…' : currentAction.label}
                    </ActionButton>
                    {currentStatus != null && ['allocated', 'accepted'].includes(currentStatus) ? (
                      <ActionButton
                        tone="secondary"
                        disabled={decliningJobId === currentJob.id || transitioningJobId === currentJob.id}
                        onClick={() => void requestJobCancellation(currentJob.id)}
                      >
                        {decliningJobId === currentJob.id ? 'Sending…' : 'Decline'}
                      </ActionButton>
                    ) : null}
                  </div>
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
            <button type="button" className="text-action" onClick={() => router.push('/driver/history')}>Open Diary →</button>
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
            <button type="button" className="text-action" onClick={() => router.push('/driver/documents')}>Documents →</button>
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
        </> : null}

        {ownerDriver ? (
          <>
            {commercialSummaryError ? <AlertBanner tone="warning">{commercialSummaryError}</AlertBanner> : null}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: 12, alignItems: 'start' }}>
              <div style={{ display: 'grid', gap: 12 }}>
                <OperationalCard
                  title="Reports & Statistics"
                  actions={(
                    <select
                      aria-label="Reports period"
                      value={commercialPeriod}
                      onChange={(event) => setCommercialPeriod(event.target.value as 'today' | '7d' | '30d' | 'all' | 'custom')}
                      style={{ height: 30, border: `1px solid ${workspaceTheme.border}`, borderRadius: 4, background: workspaceTheme.surface, padding: '0 8px' }}
                    >
                      <option value="today">Today</option>
                      <option value="7d">Last 7 days</option>
                      <option value="30d">Last 30 days</option>
                      <option value="all">All time</option>
                      <option value="custom">Select Dates</option>
                    </select>
                  )}
                >
                  {commercialPeriod === 'custom' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                      <label style={{ fontSize: 10, color: workspaceTheme.muted }}>From<input type="date" value={commercialFrom} onChange={(event) => setCommercialFrom(event.target.value)} style={{ display: 'block', width: '100%', height: 30, marginTop: 3, border: `1px solid ${workspaceTheme.border}`, borderRadius: 4 }} /></label>
                      <label style={{ fontSize: 10, color: workspaceTheme.muted }}>To<input type="date" value={commercialTo} onChange={(event) => setCommercialTo(event.target.value)} style={{ display: 'block', width: '100%', height: 30, marginTop: 3, border: `1px solid ${workspaceTheme.border}`, borderRadius: 4 }} /></label>
                    </div>
                  ) : null}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8 }}>
                    <button type="button" onClick={() => router.push('/driver/finance')} style={{ minHeight: 118, padding: 10, border: `1px solid ${workspaceTheme.border}`, borderRadius: 4, background: '#EFF6FF', textAlign: 'left', cursor: 'pointer' }}>
                      <span style={{ display: 'block', color: workspaceTheme.muted, fontSize: 11 }}>Gross Margin</span>
                      <strong style={{ display: 'block', marginTop: 14, color: workspaceTheme.navy, fontSize: 20 }}>{commercialSummaryLoading ? 'Loading…' : commercialSummary ? money(commercialSummary.recordedGrossMargin) : 'Unavailable'}</strong>
                      <small style={{ display: 'block', marginTop: 12, color: workspaceTheme.muted }}>Recorded invoiced revenue minus recorded subcontract spend.</small>
                    </button>
                    <button type="button" onClick={() => router.push('/driver/finance?view=payables')} style={{ minHeight: 118, padding: 10, border: `1px solid ${workspaceTheme.border}`, borderRadius: 4, background: '#EFF6FF', textAlign: 'left', cursor: 'pointer' }}>
                      <span style={{ display: 'block', color: workspaceTheme.muted, fontSize: 11 }}>Sub-contract Spend</span>
                      <strong style={{ display: 'block', marginTop: 14, color: workspaceTheme.navy, fontSize: 20 }}>{commercialSummaryLoading ? 'Loading…' : commercialSummary ? money(commercialSummary.subcontractSpend) : 'Unavailable'}</strong>
                      <small style={{ display: 'block', marginTop: 12, color: workspaceTheme.muted }}>Recorded supplier cost excluding your own company.</small>
                    </button>
                  </div>
                </OperationalCard>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 12 }}>
                  <OperationalCard title="Accounts Payable" subtitle="Supplier invoices where the owner-driver company is the buyer.">
                    {[
                      ['Latest invoices received', commercialSummary ? `${commercialSummary.accountsPayable.received} received` : commercialSummaryLoading ? 'Loading…' : 'Unavailable'],
                      ['Invoices due for Payment', commercialSummary ? `${commercialSummary.accountsPayable.dueForPayment} due` : commercialSummaryLoading ? 'Loading…' : 'Unavailable'],
                      ['Invoices Awaiting Payment', commercialSummary ? `${commercialSummary.accountsPayable.awaitingPayment} awaiting` : commercialSummaryLoading ? 'Loading…' : 'Unavailable'],
                      ['Monthly Totals', commercialSummary ? `${money(commercialSummary.accountsPayable.totalGross)} supplier gross` : commercialSummaryLoading ? 'Loading…' : 'Unavailable'],
                    ].map(([label, detail]) => (
                      <button key={label} type="button" onClick={() => router.push('/driver/finance?view=payables')} style={{ width: '100%', minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 0', border: 0, borderBottom: `1px solid ${workspaceTheme.divider}`, background: 'transparent', textAlign: 'left', cursor: 'pointer' }}>
                        <span><strong style={{ display: 'block', fontSize: 12 }}>{label}</strong><small style={{ color: workspaceTheme.muted }}>{detail}</small></span>
                        <span aria-hidden="true" style={{ color: workspaceTheme.blue }}>→</span>
                      </button>
                    ))}
                  </OperationalCard>

                  <OperationalCard title="Reports" subtitle="Direct routes to the operational registers behind each report.">
                    {[
                      ['Bookings Received', `${myJobs.length} assigned booking(s)`, '/driver/history'],
                      ['Bookings Sub-contracted', commercialSummary ? `${commercialSummary.bookingsSubcontracted} subcontracted` : commercialSummaryLoading ? 'Loading…' : 'Unavailable', '/driver/history'],
                      ['Loads Allocated', `${activeJobs.length + upcomingJobs.length} active/upcoming`, '/driver/history'],
                      ['Return Journeys', profile?.future_position ? profile.future_position : 'Open register', '/driver/returns'],
                    ].map(([label, detail, href]) => (
                      <button key={label} type="button" onClick={() => router.push(href)} style={{ width: '100%', minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 0', border: 0, borderBottom: `1px solid ${workspaceTheme.divider}`, background: 'transparent', textAlign: 'left', cursor: 'pointer' }}>
                        <span><strong style={{ display: 'block', fontSize: 12 }}>{label}</strong><small style={{ color: workspaceTheme.muted }}>{detail}</small></span>
                        <span aria-hidden="true" style={{ color: workspaceTheme.blue }}>→</span>
                      </button>
                    ))}
                  </OperationalCard>
                </div>

                <OperationalCard title="Feedback in Last 90 Days" subtitle="XDrive currently stores an overall review rating, not separate CX payment and delivery scores.">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
                    <button type="button" onClick={() => router.push('/driver/history')} style={{ minHeight: 64, padding: 10, border: `1px solid ${workspaceTheme.border}`, borderRadius: 4, background: workspaceTheme.surfaceMuted, textAlign: 'left', cursor: 'pointer' }}>
                      <strong style={{ display: 'block' }}>Received</strong>
                      <span style={{ color: workspaceTheme.muted, fontSize: 11 }}>
                        {commercialSummaryLoading
                          ? 'Loading…'
                          : commercialSummary
                            ? `${commercialSummary.feedback90Days.received} review(s) · ${commercialSummary.feedback90Days.receivedRatingAverage === null ? 'No average yet' : `${commercialSummary.feedback90Days.receivedRatingAverage.toFixed(1)}/5 average`}`
                            : 'Unavailable'}
                      </span>
                    </button>
                    <button type="button" onClick={() => router.push('/driver/history')} style={{ minHeight: 64, padding: 10, border: `1px solid ${workspaceTheme.border}`, borderRadius: 4, background: workspaceTheme.surfaceMuted, textAlign: 'left', cursor: 'pointer' }}>
                      <strong style={{ display: 'block' }}>Given</strong>
                      <span style={{ color: workspaceTheme.muted, fontSize: 11 }}>
                        {commercialSummaryLoading ? 'Loading…' : commercialSummary ? `${commercialSummary.feedback90Days.given} review(s) given` : 'Unavailable'}
                      </span>
                    </button>
                  </div>
                </OperationalCard>
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                <OperationalCard
                  title="Activity at a glance"
                  subtitle="Latest assigned bookings"
                  actions={<ActionButton tone="secondary" onClick={() => router.push('/driver/history')}>View all…</ActionButton>}
                  flush
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr)) auto', gap: 6, padding: 8, borderBottom: `1px solid ${workspaceTheme.border}` }}>
                    <input aria-label="Member / Driver / ID" placeholder="Member / Driver / ID" value={bookingMemberFilter} onChange={(event) => setBookingMemberFilter(event.target.value)} style={{ minWidth: 0, height: 30, padding: '0 8px', border: `1px solid ${workspaceTheme.border}`, borderRadius: 4 }} />
                    <input aria-label="Location" placeholder="Location" value={bookingLocationFilter} onChange={(event) => setBookingLocationFilter(event.target.value)} style={{ minWidth: 0, height: 30, padding: '0 8px', border: `1px solid ${workspaceTheme.border}`, borderRadius: 4 }} />
                    <input aria-label="Load ID / Ref" placeholder="Load ID / Ref" value={bookingReferenceFilter} onChange={(event) => setBookingReferenceFilter(event.target.value)} style={{ minWidth: 0, height: 30, padding: '0 8px', border: `1px solid ${workspaceTheme.border}`, borderRadius: 4 }} />
                    <ActionButton tone="secondary" onClick={() => { setBookingMemberFilter(''); setBookingLocationFilter(''); setBookingReferenceFilter(''); }}>Clear</ActionButton>
                  </div>
                  <div style={{ display: 'grid', gap: 6, padding: 8 }}>
                    {latestBookings.length === 0 ? (
                      <EmptyState compact title="No bookings match these filters" />
                    ) : latestBookings.map((job) => {
                      const lifecycleStatus = canonicalJobStatus(job.current_status, job.status);
                      const group = jobLifecyclePresentationGroup(lifecycleStatus);
                      const canDecline = ['allocated', 'accepted'].includes(lifecycleStatus);
                      return (
                        <article key={job.id} style={{ border: `1px solid ${group === 'completed' ? '#79c58a' : canDecline ? '#e5a300' : workspaceTheme.border}`, background: workspaceTheme.surface, borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr .9fr', gap: 10, padding: '8px 10px 6px' }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '34px minmax(0,1fr)', columnGap: 6, rowGap: 2, fontSize: 11 }}>
                                <span style={{ color: workspaceTheme.muted }}>From:</span><strong>{job.pickup_location ?? job.pickup_postcode ?? 'Collection'}</strong>
                                <span style={{ color: workspaceTheme.muted }}>To:</span><strong>{job.delivery_location ?? job.delivery_postcode ?? 'Delivery'}</strong>
                                <span style={{ color: workspaceTheme.muted }}>Veh:</span><span>{vehicleLabel(job.vehicle_type)}</span>
                              </div>
                            </div>
                            <div style={{ minWidth: 0, fontSize: 11 }}>
                              <div><span style={{ color: workspaceTheme.muted }}>Pickup: </span><strong>{formatDate(job.pickup_datetime)}</strong></div>
                              <div style={{ marginTop: 3 }}><span style={{ color: workspaceTheme.muted }}>Deliver: </span><strong>{formatDate(job.delivery_datetime)}</strong></div>
                            </div>
                            <div style={{ minWidth: 0, fontSize: 11 }}>
                              <StatusBadge value={humanize(lifecycleStatus)} tone={group === 'completed' ? 'green' : group === 'active' ? 'blue' : group === 'cancelled' ? 'grey' : 'orange'} />
                              <div style={{ marginTop: 5, color: workspaceTheme.muted }}>{memberNameByJob[job.id] ?? job.client_name ?? 'Member not supplied'}</div>
                              <div style={{ marginTop: 2 }}>Load ID: <strong>XDL-{job.id.slice(0, 8).toUpperCase()}</strong></div>
                              {job.booking_reference || job.customer_reference ? <div style={{ marginTop: 2, color: workspaceTheme.muted }}>Ref: {job.booking_reference ?? job.customer_reference}</div> : null}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', padding: '5px 8px', borderTop: `1px solid ${workspaceTheme.divider}`, background: workspaceTheme.surfaceMuted }}>
                            <ActionButton tone={canDecline ? 'success' : 'secondary'} onClick={() => router.push(`/driver/jobs/${job.id}`)}>
                              {group === 'completed' ? 'POD' : canDecline ? 'Enter POD' : 'Open'}
                            </ActionButton>
                            {canDecline ? (
                              <ActionButton
                                tone="secondary"
                                disabled={decliningJobId === job.id}
                                onClick={() => void requestJobCancellation(job.id)}
                              >
                                {decliningJobId === job.id ? 'Sending…' : 'Decline'}
                              </ActionButton>
                            ) : null}
                            {group === 'active' || canDecline ? <ActionButton tone="secondary" onClick={() => router.push('/driver/freight-vision')}>Track</ActionButton> : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </OperationalCard>

              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push('/driver/messages')}
              aria-label="Open Freight Messenger"
              style={{
                position: 'fixed',
                right: 14,
                bottom: 10,
                zIndex: 1200,
                minHeight: 34,
                padding: '7px 14px',
                border: '1px solid #0B2F6B',
                borderRadius: 4,
                background: '#0B2F6B',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: 12,
                boxShadow: '0 2px 8px rgba(0,0,0,.18)',
                cursor: 'pointer',
              }}
            >
              Freight Messenger
            </button>
          </>
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
