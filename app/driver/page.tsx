'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthContext';
import { resolveWorkspaceRole } from '../../lib/workspaceRole';
import { canonicalJobStatus, filterJobsForDriver, recentCompletedJobs } from '../../lib/driverDashboard';
import { useCompanyWorkspaceData } from '../components/workspace/useCompanyWorkspaceData';
import { supabase } from '../../lib/supabaseClient';
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

function statusTone(status: string): 'green' | 'orange' | 'red' | 'purple' | 'blue' | 'grey' {
  const value = status.toLowerCase();
  if (['completed', 'delivered', 'paid', 'accepted'].includes(value)) return 'green';
  if (['rejected', 'cancelled', 'driver_declined'].includes(value)) return 'red';
  if (['submitted', 'awarded', 'allocated', 'on_my_way', 'on_site_pickup', 'loaded', 'in_transit', 'on_site_delivery'].includes(value)) return 'orange';
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

  const nextBookings = [...todaysJobs, ...upcomingJobs.filter((job) => !todaysJobs.some((today) => today.id === job.id))]
    .filter((job) => job.id !== currentJob?.id)
    .slice(0, 6);

  const recentCompleted = recentCompletedJobs(myJobs).slice(0, 6);
  const submittedQuotes = data.bids.filter((quote) => quote.status === 'submitted');
  const acceptedQuotes = data.bids.filter((quote) => quote.status === 'accepted');
  const myDocuments = data.driverDocuments.filter((document) => !user?.driverId || document.driver_id === user.driverId);
  const expiringDocuments = myDocuments.filter(
    (document) => document.expiry_date && new Date(document.expiry_date).getTime() < Date.now() + 30 * 86_400_000,
  );

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
            <strong className="driver-cell-primary">{job.vehicle_type?.replace(/_/g, ' ') ?? 'TBC'}</strong>
            <span className="driver-cell-secondary">Assigned work</span>
          </div>
          <div className="driver-load-cell">
            <span className="driver-cell-label">Status</span>
            <strong className="driver-cell-primary">{status.replace(/_/g, ' ')}</strong>
            <span className="driver-cell-secondary">Job #{job.id.slice(0, 8).toUpperCase()}</span>
          </div>
        </div>
        <div className="driver-load-row__meta">
          <StatusBadge value={status.replace(/_/g, ' ')} tone={statusTone(status)} />
          <span>Pickup {fmtDate(job.pickup_datetime)}</span>
          <span>Delivery {fmtDate(job.delivery_datetime)}</span>
          <div className="driver-row-actions">
            <ActionButton tone="secondary" onClick={() => router.push(`/driver/jobs/${job.id}`)}>{actionLabel}</ActionButton>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="driver-reference-page driver-reference-dashboard">
      <DriverWorkspaceShell
        personaLabel={ownerDriver ? 'Owner-driver workspace' : 'Driver workspace'}
        driverName="Driver Dashboard"
        subtitle="Live work, next bookings, marketplace activity and readiness."
        availabilityLabel={currentJob ? 'On a job' : 'Available'}
        headerActions={<ActionButton tone="primary" onClick={() => void data.refresh()}>Refresh</ActionButton>}
      >
        {data.error && <AlertBanner tone="danger">{data.error}</AlertBanner>}
        {transitionError && <AlertBanner tone="danger">{transitionError}</AlertBanner>}
        {transitionMessage && <AlertBanner tone="success">{transitionMessage}</AlertBanner>}

        <div className="driver-board-layout">
          <aside className="driver-filter-rail" aria-label="Driver shift controls">
            <div className="driver-filter-rail__header">Shift controls</div>
            <div className="driver-filter-rail__body">
              <button
                type="button"
                className="driver-side-tab"
                data-active={!currentJob ? 'true' : 'false'}
                onClick={() => router.push('/driver/availability')}
              >
                <span>{currentJob ? 'On a job' : 'Available'}</span>
                <strong>{currentJob ? 1 : '✓'}</strong>
              </button>
              <button type="button" className="driver-side-tab" onClick={() => router.push('/driver/jobs')}>
                <span>Jobs today</span>
                <strong>{todaysJobs.length}</strong>
              </button>
              <button type="button" className="driver-side-tab" onClick={() => router.push('/driver/quotes')}>
                <span>Quotes open</span>
                <strong>{submittedQuotes.length}</strong>
              </button>
              <button type="button" className="driver-side-tab" onClick={() => router.push('/driver/documents')}>
                <span>Documents due</span>
                <strong>{expiringDocuments.length}</strong>
              </button>

              <div className="driver-filter-actions">
                <ActionButton tone="success" onClick={() => currentJob ? router.push(`/driver/jobs/${currentJob.id}`) : router.push('/driver/availability')}>
                  {currentJob ? 'Current job' : 'Update status'}
                </ActionButton>
                <ActionButton tone="secondary" onClick={() => router.push('/driver/returns')}>Return journey</ActionButton>
              </div>
            </div>
          </aside>

          <main className="driver-board-main">
            <div className="driver-tab-strip" role="tablist" aria-label="Dashboard work areas">
              <button type="button" data-active="true">Current Work <span>{currentJob ? 1 : 0}</span></button>
              <button type="button" onClick={() => router.push('/driver/jobs')}>Jobs <span>{myJobs.length}</span></button>
              <button type="button" onClick={() => router.push('/driver/quotes')}>Quotes <span>{data.bids.length}</span></button>
              <button type="button" onClick={() => router.push('/driver/history')}>Diary</button>
            </div>

            <div className="driver-board-summary">
              <span>{todaysJobs.length} today · {upcomingJobs.length} upcoming · {acceptedQuotes.length} won · {expiringDocuments.length} document alert{expiringDocuments.length === 1 ? '' : 's'}</span>
              <span>{data.loading ? 'Refreshing…' : 'Live workspace data'}</span>
            </div>

            <section className="driver-dashboard-section">
              <div className="driver-filter-rail__header">
                <span>Current execution</span>
                {currentJob && currentStatus && <StatusBadge value={currentStatus.replace(/_/g, ' ')} tone={statusTone(currentStatus)} />}
              </div>
              <div className="driver-dashboard-section__body">
                {!currentJob || !currentAction ? (
                  <div className="driver-load-row">
                    <EmptyState compact title="No active job" description="Allocated work will appear here as the primary execution row." />
                  </div>
                ) : (
                  <>
                    {renderJobRow(currentJob, 'Open full job')}
                    <div className="driver-inline-quote driver-dashboard-next-action">
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
              <div className="driver-filter-rail__header">
                <span>Next bookings</span>
                <ActionButton tone="secondary" onClick={() => router.push('/driver/jobs')}>View all</ActionButton>
              </div>
              <div className="driver-dashboard-section__body">
                {nextBookings.length === 0 ? (
                  <div className="driver-load-row"><EmptyState compact title="No bookings scheduled" /></div>
                ) : (
                  <div className="driver-load-list">{nextBookings.map((job) => renderJobRow(job, 'Open job'))}</div>
                )}
              </div>
            </section>

            <div className="driver-dashboard-lower-grid">
              <section className="driver-dashboard-section">
                <div className="driver-filter-rail__header">
                  <span>Marketplace activity</span>
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
                <div className="driver-filter-rail__header">
                  <span>Readiness</span>
                  <ActionButton tone="secondary" onClick={() => router.push('/driver/account')}>Account</ActionButton>
                </div>
                <div className="driver-dashboard-section__body driver-dashboard-table-wrap">
                  <table>
                    <tbody>
                      <tr><td>Driver documents</td><td><strong>{myDocuments.length}</strong></td><td><ActionButton tone="secondary" onClick={() => router.push('/driver/documents')}>Open</ActionButton></td></tr>
                      <tr><td>Expiring within 30 days</td><td><strong>{expiringDocuments.length}</strong></td><td><StatusBadge value={expiringDocuments.length ? 'Attention' : 'Ready'} tone={expiringDocuments.length ? 'orange' : 'green'} /></td></tr>
                      <tr><td>Availability</td><td colSpan={2}><ActionButton tone="secondary" onClick={() => router.push('/driver/availability')}>Manage</ActionButton></td></tr>
                      <tr><td>Vehicle</td><td colSpan={2}><ActionButton tone="secondary" onClick={() => router.push('/driver/vehicles')}>Open vehicle</ActionButton></td></tr>
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <section className="driver-dashboard-section">
              <div className="driver-filter-rail__header">
                <span>Recent completed work</span>
                <ActionButton tone="secondary" onClick={() => router.push('/driver/history')}>History</ActionButton>
              </div>
              <div className="driver-dashboard-section__body">
                {recentCompleted.length === 0 ? (
                  <div className="driver-load-row"><EmptyState compact title="No completed jobs yet" /></div>
                ) : (
                  <div className="driver-load-list">{recentCompleted.map((job) => renderJobRow(job, 'Open'))}</div>
                )}
              </div>
            </section>
          </main>
        </div>
      </DriverWorkspaceShell>
    </div>
  );
}
