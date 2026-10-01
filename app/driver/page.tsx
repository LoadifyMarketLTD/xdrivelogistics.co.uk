'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '../components/AuthContext';
import { useCompanyWorkspaceData } from '../components/workspace/useCompanyWorkspaceData';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  OperationalCard,
  OperationalToolbar,
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
import PendingBookingOffers from '../components/workspace/PendingBookingOffers';

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

type DriverFinanceSummary = {
  total: number;
  draft: number;
  sent: number;
  overdue: number;
  paid: number;
  disputed: number;
  cancelled: number;
};

type DriverFinanceValues = {
  net: number;
  vat: number;
  gross: number;
  paid: number;
  outstanding: number;
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

const daysUntil = (value: string | null | undefined) => {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.ceil((timestamp - Date.now()) / 86_400_000);
};

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
  const [financeSummary, setFinanceSummary] = useState<DriverFinanceSummary | null>(null);
  const [financeValues, setFinanceValues] = useState<DriverFinanceValues | null>(null);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeError, setFinanceError] = useState('');
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

  const loadFinanceSummary = useCallback(async () => {
    if (!ownerDriver || !isSupabaseConfigured) return;
    setFinanceLoading(true);
    setFinanceError('');
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setFinanceError('Finance session could not be verified.');
      setFinanceLoading(false);
      return;
    }
    try {
      const response = await fetch('/api/driver/finance/invoices', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => null) as {
        invoiceSummary?: DriverFinanceSummary;
        valueSummary?: DriverFinanceValues;
        error?: string;
      } | null;
      if (!response.ok || !payload) throw new Error(payload?.error ?? 'Finance summary could not be loaded.');
      setFinanceSummary(payload.invoiceSummary ?? null);
      setFinanceValues(payload.valueSummary ?? null);
    } catch (reason) {
      setFinanceSummary(null);
      setFinanceValues(null);
      setFinanceError(reason instanceof Error ? reason.message : 'Finance summary could not be loaded.');
    } finally {
      setFinanceLoading(false);
    }
  }, [ownerDriver]);

  const latestBookings = useMemo(() => {
    const memberNeedle = bookingMemberFilter.trim().toLowerCase();
    const locationNeedle = bookingLocationFilter.trim().toLowerCase();
    const refNeedle = bookingReferenceFilter.trim().toLowerCase();
    return [...myJobs]
      .filter((job) => {
        const memberText = `${job.client_name ?? ''}`.toLowerCase();
        const locationText = `${job.pickup_location ?? ''} ${job.pickup_postcode ?? ''} ${job.delivery_location ?? ''} ${job.delivery_postcode ?? ''}`.toLowerCase();
        const refText = `${job.id} ${job.booking_reference ?? ''} ${job.customer_reference ?? ''}`.toLowerCase();
        return (!memberNeedle || memberText.includes(memberNeedle))
          && (!locationNeedle || locationText.includes(locationNeedle))
          && (!refNeedle || refText.includes(refNeedle));
      })
      .sort((a, b) => String(b.updated_at ?? b.created_at ?? '').localeCompare(String(a.updated_at ?? a.created_at ?? '')))
      .slice(0, 4);
  }, [bookingLocationFilter, bookingMemberFilter, bookingReferenceFilter, myJobs]);

  const documentSignals = useMemo(() => {
    const days = data.driverDocuments
      .map((document) => daysUntil(document.expiry_date))
      .filter((value): value is number => value !== null);
    return {
      expired: days.filter((value) => value < 0).length,
      expiring: days.filter((value) => value >= 0 && value <= 30).length,
      total: data.driverDocuments.length,
    };
  }, [data.driverDocuments]);

  const wonWorkValue = useMemo(() => {
    const assignedJobIds = new Set(myJobs.map((job) => job.id));
    return data.bids
      .filter((bid) => assignedJobIds.has(bid.job_id) && String(bid.status).toLowerCase() === 'accepted')
      .reduce((sum, bid) => sum + Number(bid.bid_price_gbp ?? bid.amount ?? 0), 0);
  }, [data.bids, myJobs]);

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
    if (ownerDriver) void loadFinanceSummary();
  }, [loadFinanceSummary, ownerDriver]);

  const refreshDashboard = async () => {
    const tasks: Promise<unknown>[] = [data.refresh(), loadDriverContext()];
    if (ownerDriver) tasks.push(loadFinanceSummary());
    await Promise.all(tasks);
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
                  <ActionButton
                    tone="success"
                    disabled={transitioningJobId === currentJob.id}
                    onClick={() => void runCurrentAction()}
                  >
                    {transitioningJobId === currentJob.id ? 'Saving…' : currentAction.label}
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

        {ownerDriver ? (
          <>
            {financeError ? <AlertBanner tone="warning">{financeError}</AlertBanner> : null}
            <OperationalToolbar>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <strong style={{ color: workspaceTheme.navy }}>Owner Driver business desk</strong>
                <span style={{ color: workspaceTheme.muted, fontSize: 11 }}>CX-style reports, latest bookings, finance, feedback, compliance and messaging</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <ActionButton tone="secondary" onClick={() => router.push('/driver/finance')}>Finance</ActionButton>
                <ActionButton tone="secondary" onClick={() => router.push('/driver/history')}>Diary</ActionButton>
                <ActionButton tone="secondary" onClick={() => router.push('/driver/documents')}>Compliance</ActionButton>
                <ActionButton tone="secondary" onClick={() => router.push('/driver/messages')}>Freight Messenger</ActionButton>
              </div>
            </OperationalToolbar>

            <PendingBookingOffers onChanged={() => void refreshDashboard()} />

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: 12, alignItems: 'start' }}>
              <div style={{ display: 'grid', gap: 12 }}>
                <OperationalCard title="Reports & Statistics">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8 }}>
                    <button type="button" onClick={() => router.push('/driver/won-work')} style={{ minHeight: 74, padding: 10, border: `1px solid ${workspaceTheme.border}`, borderRadius: 4, background: '#EFF6FF', textAlign: 'left', cursor: 'pointer' }}>
                      <span style={{ display: 'block', color: workspaceTheme.muted, fontSize: 11 }}>Won work value</span>
                      <strong style={{ display: 'block', marginTop: 4, color: workspaceTheme.navy, fontSize: 18 }}>{money(wonWorkValue)}</strong>
                      <small style={{ color: workspaceTheme.muted }}>Accepted quotes on assigned work</small>
                    </button>
                    <button type="button" onClick={() => router.push('/driver/finance')} style={{ minHeight: 74, padding: 10, border: `1px solid ${workspaceTheme.border}`, borderRadius: 4, background: '#EFF6FF', textAlign: 'left', cursor: 'pointer' }}>
                      <span style={{ display: 'block', color: workspaceTheme.muted, fontSize: 11 }}>Gross invoiced</span>
                      <strong style={{ display: 'block', marginTop: 4, color: workspaceTheme.navy, fontSize: 18 }}>{financeLoading ? 'Loading…' : financeValues ? money(financeValues.gross) : 'Unavailable'}</strong>
                      <small style={{ color: workspaceTheme.muted }}>Verified Driver Finance summary</small>
                    </button>
                  </div>
                </OperationalCard>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 12 }}>
                  <OperationalCard title="Finance & Accounts" subtitle="Owner-driver invoice lifecycle and payment state.">
                    {[
                      ['Latest invoices', financeSummary ? `${financeSummary.total} total` : financeLoading ? 'Loading…' : 'Unavailable'],
                      ['Invoices awaiting payment', financeSummary ? `${financeSummary.sent + financeSummary.overdue} awaiting` : financeLoading ? 'Loading…' : 'Unavailable'],
                      ['Invoices overdue', financeSummary ? `${financeSummary.overdue} overdue` : financeLoading ? 'Loading…' : 'Unavailable'],
                      ['Monthly totals', financeValues ? `${money(financeValues.paid)} paid` : financeLoading ? 'Loading…' : 'Unavailable'],
                    ].map(([label, detail]) => (
                      <button key={label} type="button" onClick={() => router.push('/driver/finance')} style={{ width: '100%', minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 0', border: 0, borderBottom: `1px solid ${workspaceTheme.divider}`, background: 'transparent', textAlign: 'left', cursor: 'pointer' }}>
                        <span><strong style={{ display: 'block', fontSize: 12 }}>{label}</strong><small style={{ color: workspaceTheme.muted }}>{detail}</small></span>
                        <span aria-hidden="true" style={{ color: workspaceTheme.blue }}>→</span>
                      </button>
                    ))}
                  </OperationalCard>

                  <OperationalCard title="Reports" subtitle="Direct routes to the operational registers behind each report.">
                    {[
                      ['Bookings Received', `${myJobs.length} assigned booking(s)`, '/driver/history'],
                      ['Loads Allocated', `${activeJobs.length + upcomingJobs.length} active/upcoming`, '/driver/history'],
                      ['Return Journeys', profile?.future_position ? profile.future_position : 'Open register', '/driver/returns'],
                      ['Quotes', `${data.bids.length} loaded quote record(s)`, '/driver/quotes'],
                    ].map(([label, detail, href]) => (
                      <button key={label} type="button" onClick={() => router.push(href)} style={{ width: '100%', minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 0', border: 0, borderBottom: `1px solid ${workspaceTheme.divider}`, background: 'transparent', textAlign: 'left', cursor: 'pointer' }}>
                        <span><strong style={{ display: 'block', fontSize: 12 }}>{label}</strong><small style={{ color: workspaceTheme.muted }}>{detail}</small></span>
                        <span aria-hidden="true" style={{ color: workspaceTheme.blue }}>→</span>
                      </button>
                    ))}
                  </OperationalCard>
                </div>

                <OperationalCard title="Feedback in Last 90 Days" subtitle="XDrive does not fabricate payment or delivery scores when the Driver feed has no verified score source.">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
                    <button type="button" onClick={() => router.push('/driver/history')} style={{ minHeight: 64, padding: 10, border: `1px solid ${workspaceTheme.border}`, borderRadius: 4, background: workspaceTheme.surfaceMuted, textAlign: 'left', cursor: 'pointer' }}>
                      <strong style={{ display: 'block' }}>Received</strong>
                      <span style={{ color: workspaceTheme.muted, fontSize: 11 }}>Open Diary feedback records</span>
                    </button>
                    <button type="button" onClick={() => router.push('/driver/history')} style={{ minHeight: 64, padding: 10, border: `1px solid ${workspaceTheme.border}`, borderRadius: 4, background: workspaceTheme.surfaceMuted, textAlign: 'left', cursor: 'pointer' }}>
                      <strong style={{ display: 'block' }}>Given</strong>
                      <span style={{ color: workspaceTheme.muted, fontSize: 11 }}>Open completed bookings and feedback actions</span>
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
                  <DataTable
                    columns={['Route', 'Pickup / Delivery', 'Vehicle', 'Status', 'Actions']}
                    rows={latestBookings.map((job) => {
                      const status = workspaceJobPresentationStatus(job);
                      const group = jobLifecyclePresentationGroup(status);
                      return [
                        <span key="route"><strong>{job.pickup_postcode ?? job.pickup_location ?? 'Collection'} → {job.delivery_postcode ?? job.delivery_location ?? 'Delivery'}</strong><small style={{ display: 'block', color: workspaceTheme.muted }}>XDL-{job.id.slice(0, 8).toUpperCase()}</small></span>,
                        <span key="times"><strong>{formatDate(job.pickup_datetime)}</strong><small style={{ display: 'block', color: workspaceTheme.muted }}>{formatDate(job.delivery_datetime)}</small></span>,
                        vehicleLabel(job.vehicle_type),
                        <StatusBadge key="status" value={humanize(status)} tone={group === 'completed' ? 'green' : group === 'active' ? 'blue' : group === 'cancelled' ? 'grey' : 'orange'} />,
                        <div key="actions" style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          <ActionButton tone="secondary" onClick={() => router.push(`/driver/jobs/${job.id}`)}>{group === 'completed' ? 'POD' : 'Open'}</ActionButton>
                          {group === 'active' ? <ActionButton tone="secondary" onClick={() => router.push('/driver/freight-vision')}>Track</ActionButton> : null}
                        </div>,
                      ];
                    })}
                    empty={<EmptyState compact title="No bookings match these filters" />}
                  />
                </OperationalCard>

                <OperationalCard title="Compliance - Driver & Vehicle" subtitle="Equivalent control area for the owner-driver account.">
                  <div style={{ display: 'grid', gridTemplateColumns: '110px minmax(0,1fr)', gap: 12, alignItems: 'center' }}>
                    <button type="button" onClick={() => router.push('/driver/documents')} style={{ width: 100, height: 100, borderRadius: '50%', border: `1px solid ${workspaceTheme.border}`, background: workspaceTheme.surfaceMuted, cursor: 'pointer' }}>
                      <strong style={{ display: 'block', color: workspaceTheme.navy, fontSize: 22 }}>{documentSignals.expired + documentSignals.expiring}</strong>
                      <span style={{ fontSize: 10, color: workspaceTheme.muted }}>document alerts</span>
                    </button>
                    <div>
                      {[
                        ['Expired documents', `${documentSignals.expired} expired`, '/driver/documents'],
                        ['About to expire', `${documentSignals.expiring} due within 30 days`, '/driver/documents'],
                        ['Driver documents', `${documentSignals.total} loaded`, '/driver/documents'],
                        ['Active vehicle', vehicle?.reg_plate ?? 'Not assigned', '/driver/vehicles'],
                      ].map(([label, detail, href]) => (
                        <button key={label} type="button" onClick={() => router.push(href)} style={{ width: '100%', minHeight: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: 0, borderBottom: `1px solid ${workspaceTheme.divider}`, background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                          <span>{label}</span><strong>{detail}</strong>
                        </button>
                      ))}
                    </div>
                  </div>
                </OperationalCard>

                <OperationalCard title="Network & Freight Messenger" subtitle="CX watchlist/messenger equivalents already present in XDrive.">
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <ActionButton tone="secondary" onClick={() => router.push('/driver/directory')}>Directory / Saved Networks</ActionButton>
                    <ActionButton tone="secondary" onClick={() => router.push('/driver/messages')}>Freight Messenger</ActionButton>
                    <ActionButton tone="secondary" onClick={() => router.push('/driver/notifications')}>Notifications</ActionButton>
                  </div>
                </OperationalCard>
              </div>
            </div>
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
