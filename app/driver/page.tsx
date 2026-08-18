'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthContext';
import { resolveWorkspaceRole } from '../../lib/workspaceRole';
import { canonicalJobStatus, filterJobsForDriver, recentCompletedJobs } from '../../lib/driverDashboard';
import { useCompanyWorkspaceData } from '../components/workspace/useCompanyWorkspaceData';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';
import DriverWorkspaceShell from './_components/DriverWorkspaceShell';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  StatusBadge,
} from '../components/workspace/WorkspaceUI';

type OwnerBid = {
  id: string;
  job_id: string;
  bid_price_gbp: number | null;
  status: string;
  created_at: string;
  jobs?: {
    pickup_location: string | null;
    delivery_location: string | null;
    pickup_datetime: string | null;
    status: string;
  }[] | null;
};

type DriverFinanceInvoice = {
  status: string;
  payment_status?: string | null;
  amount: number | null;
};

type DriverNextAction =
  | { kind: 'transition'; nextStatus: string; label: string; description: string; resultLabel: string }
  | { kind: 'open'; label: string; description: string };

const activeStatuses = new Set([
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

const upcomingStatuses = new Set(['awarded', 'allocated', 'accepted']);
const completedStatuses = new Set(['completed', 'invoiced', 'paid']);

const BID_STATUS_TONE: Record<string, 'green' | 'orange' | 'red' | 'purple'> = {
  accepted: 'green',
  submitted: 'orange',
  rejected: 'red',
  withdrawn: 'purple',
};

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
    label: 'Add loading photo & confirm loaded',
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
    label: 'Capture POD & confirm delivered',
    description: 'Delivery photo, recipient name and signature are required before delivery confirmation.',
  },
  delivered: {
    kind: 'transition',
    nextStatus: 'completed',
    label: 'Complete job',
    description: 'Close the delivered job after the delivery evidence has been captured.',
    resultLabel: 'Completed',
  },
  accepted: {
    kind: 'open',
    label: 'Open job details',
    description: 'This accepted-state record is continued from the full execution screen; no direct dashboard transition is attempted.',
  },
  on_my_way_to_pickup: {
    kind: 'open',
    label: 'Open pickup details',
    description: 'This pickup-state alias is continued from the full execution screen; no direct dashboard transition is attempted.',
  },
  collected: {
    kind: 'open',
    label: 'Open delivery details',
    description: 'This collected-state record is continued from the full execution screen; no direct dashboard transition is attempted.',
  },
  on_my_way_to_delivery: {
    kind: 'open',
    label: 'Open delivery details',
    description: 'This delivery-state alias is continued from the full execution screen; no direct dashboard transition is attempted.',
  },
};

function money(value: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
}

function formatDateTime(value: string | null | undefined) {
  return value
    ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not set';
}

export default function DriverDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const workspaceRole = resolveWorkspaceRole(user);
  const ownerDriver = workspaceRole === 'owner_driver';
  const data = useCompanyWorkspaceData();
  const [ownerBids, setOwnerBids] = useState<OwnerBid[]>([]);
  const [financeInvoices, setFinanceInvoices] = useState<DriverFinanceInvoice[]>([]);
  const [financeAvailable, setFinanceAvailable] = useState(false);
  const [transitioningJobId, setTransitioningJobId] = useState<string | null>(null);
  const [transitionError, setTransitionError] = useState('');
  const [transitionMessage, setTransitionMessage] = useState('');

  const fetchOwnerBids = useCallback(async () => {
    if (!ownerDriver || !user?.id || !isSupabaseConfigured) return;

    const { data: rows } = await supabase
      .from('job_bids')
      .select('id, job_id, bid_price_gbp, status, created_at, jobs(pickup_location, delivery_location, pickup_datetime, status)')
      .eq('bidder_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    setOwnerBids((rows ?? []) as OwnerBid[]);
  }, [ownerDriver, user?.id]);

  const fetchDriverFinance = useCallback(async () => {
    if (!user?.id || !isSupabaseConfigured) {
      setFinanceInvoices([]);
      setFinanceAvailable(false);
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setFinanceInvoices([]);
      setFinanceAvailable(false);
      return;
    }

    try {
      const response = await fetch('/api/driver/finance/invoices?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => ({}))) as {
        rows?: DriverFinanceInvoice[];
      };
      if (!response.ok) {
        setFinanceInvoices([]);
        setFinanceAvailable(false);
        return;
      }
      setFinanceInvoices(payload.rows ?? []);
      setFinanceAvailable(true);
    } catch {
      setFinanceInvoices([]);
      setFinanceAvailable(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void fetchOwnerBids();
  }, [fetchOwnerBids]);

  useEffect(() => {
    void fetchDriverFinance();
  }, [fetchDriverFinance]);

  const myJobs = useMemo(
    () => filterJobsForDriver(data.jobs, { driverId: user?.driverId, ownerDriver }),
    [data.jobs, ownerDriver, user?.driverId],
  );

  const currentJob = myJobs.find((job) => activeStatuses.has(canonicalJobStatus(job.current_status, job.status)));
  const currentStatus = currentJob ? canonicalJobStatus(currentJob.current_status, currentJob.status).toLowerCase() : null;
  const currentAction = currentStatus
    ? NEXT_DRIVER_ACTIONS[currentStatus] ?? {
        kind: 'open' as const,
        label: 'Open job details',
        description: 'Review this job state in the full execution screen; the dashboard will not guess an unsupported transition.',
      }
    : null;
  const todaysJobs = myJobs
    .filter((job) => job.pickup_datetime && new Date(job.pickup_datetime).toDateString() === new Date().toDateString())
    .sort((a, b) => String(a.pickup_datetime ?? '').localeCompare(String(b.pickup_datetime ?? '')));
  const upcomingJobs = myJobs
    .filter((job) => {
      const status = canonicalJobStatus(job.current_status, job.status);
      return upcomingStatuses.has(status) && Boolean(job.pickup_datetime) && new Date(job.pickup_datetime as string).getTime() > Date.now();
    })
    .sort((a, b) => String(a.pickup_datetime ?? '').localeCompare(String(b.pickup_datetime ?? '')));
  const recentCompleted = recentCompletedJobs(myJobs);
  const nextBookings = [...todaysJobs, ...upcomingJobs.filter((job) => !todaysJobs.some((today) => today.id === job.id))].slice(0, 4);

  const myQuotes = data.bids;
  const myDocuments = data.driverDocuments.filter((document) => !user?.driverId || document.driver_id === user.driverId);
  const expiringDocuments = myDocuments.filter(
    (document) => document.expiry_date && new Date(document.expiry_date).getTime() < Date.now() + 30 * 86_400_000,
  );
  const completedJobs = myJobs.filter((job) => completedStatuses.has(canonicalJobStatus(job.current_status, job.status))).length;
  const submittedQuotes = myQuotes.filter((quote) => quote.status === 'submitted').length;
  const wonWork = myQuotes.filter((quote) => quote.status === 'accepted').length;
  const pendingInvoiceRows = financeInvoices.filter((invoice) => {
    const status = String(invoice.status ?? '').toLowerCase();
    const paymentStatus = String(invoice.payment_status ?? '').toLowerCase();
    return !['paid', 'cancelled'].includes(status) && paymentStatus !== 'paid';
  });
  const pendingInvoices = financeAvailable ? pendingInvoiceRows.length : null;
  const pendingInvoiceValue = financeAvailable
    ? pendingInvoiceRows.reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0)
    : null;

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
      setTransitionError('The job status could not be updated from the dashboard. Open the job and retry from the execution screen.');
    } else {
      setTransitionMessage(`Job updated: ${currentAction.resultLabel}.`);
      await data.refresh();
    }
    setTransitioningJobId(null);
  };

  return (
    <DriverWorkspaceShell
      personaLabel={ownerDriver ? 'Owner-driver workspace' : 'Driver workspace'}
      driverName="Today"
      subtitle="Your workday at a glance: live status, next bookings, current execution and readiness."
      headerActions={
        <>
          {ownerDriver && <ActionButton tone="success" onClick={() => router.push('/driver/loads')}>Find loads</ActionButton>}
          <ActionButton tone="secondary" onClick={() => router.push('/driver/jobs')}>Diary</ActionButton>
        </>
      }
    >
      {data.error && <AlertBanner tone="danger">{data.error}</AlertBanner>}
      {transitionError && <AlertBanner tone="danger">{transitionError}</AlertBanner>}
      {transitionMessage && <AlertBanner tone="success">{transitionMessage}</AlertBanner>}

      <div className="driver-dash-metrics" aria-label="Driver activity summary">
        <div className="driver-dash-metric"><span>Jobs today</span><strong>{todaysJobs.length}</strong></div>
        <div className="driver-dash-metric"><span>Active / allocated</span><strong>{currentJob ? 1 : upcomingJobs.length}</strong></div>
        <div className="driver-dash-metric"><span>Won work</span><strong>{wonWork}</strong></div>
        <div className="driver-dash-metric"><span>Completed</span><strong>{completedJobs}</strong></div>
      </div>

      <div className="driver-exchange-dashboard">
        <aside className="driver-exchange-left">
          <section className="driver-dash-box">
            <div className="driver-dash-box__head"><strong>Update my current status</strong><StatusBadge value={currentJob ? 'On a job' : 'Available'} tone={currentJob ? 'orange' : 'green'} /></div>
            <div className="driver-dash-box__body">
              <div className="driver-dash-status">
                <div>
                  <strong>{currentJob ? 'Executing assigned work' : 'Available for new work'}</strong>
                  <span>{currentJob ? 'Your active job is controlling your live operational state.' : 'Keep location, radius and vehicle readiness current for marketplace matching.'}</span>
                </div>
              </div>
              <div className="driver-dash-actions">
                <ActionButton tone="success" onClick={() => currentJob ? router.push(`/driver/jobs/${currentJob.id}`) : router.push('/driver/availability')}>{currentJob ? 'Current job' : 'Update status'}</ActionButton>
                <ActionButton tone="secondary" onClick={() => router.push('/driver/vehicles')}>Vehicle</ActionButton>
              </div>
            </div>
          </section>

          <section className="driver-dash-box">
            <div className="driver-dash-box__head"><strong>Advertise availability & return journey</strong></div>
            <div className="driver-dash-box__body">
              <div className="driver-dash-note">Publish where your empty vehicle will be after the next delivery so matching work can be surfaced faster.</div>
              <div className="driver-dash-actions">
                <ActionButton tone="primary" onClick={() => router.push('/driver/returns')}>Return journey</ActionButton>
                <ActionButton tone="secondary" onClick={() => router.push('/driver/returns')}>Future position</ActionButton>
              </div>
            </div>
          </section>

          <section className="driver-dash-box">
            <div className="driver-dash-box__head"><strong>Business & readiness</strong></div>
            <div className="driver-dash-box__body">
              <table className="driver-dash-table">
                <tbody>
                  <tr><td>Quotes awaiting decision</td><td><strong>{submittedQuotes}</strong></td></tr>
                  <tr><td>Pending invoices</td><td><strong>{pendingInvoices ?? '—'}</strong></td></tr>
                  <tr><td>Invoice value</td><td><strong>{pendingInvoiceValue == null ? '—' : money(pendingInvoiceValue)}</strong></td></tr>
                  <tr><td>Documents expiring</td><td><strong>{expiringDocuments.length}</strong></td></tr>
                </tbody>
              </table>
              <div className="driver-dash-actions">
                <ActionButton tone="secondary" onClick={() => router.push('/driver/documents')}>Documents</ActionButton>
                <ActionButton tone="secondary" onClick={() => router.push('/driver/finance')}>Invoices</ActionButton>
              </div>
            </div>
          </section>

          <section className="driver-dash-box">
            <div className="driver-dash-box__head"><strong>Quick actions</strong></div>
            <div className="driver-dash-box__body">
              <div className="driver-dash-actions">
                {ownerDriver && <ActionButton tone="success" onClick={() => router.push('/driver/loads')}>Available loads</ActionButton>}
                <ActionButton tone="secondary" onClick={() => router.push('/driver/jobs')}>My jobs</ActionButton>
                <ActionButton tone="secondary" onClick={() => router.push('/driver/history')}>History</ActionButton>
                <ActionButton tone="secondary" onClick={() => router.push('/driver/account')}>Account</ActionButton>
              </div>
            </div>
          </section>
        </aside>

        <main className="driver-exchange-main">
          <section className="driver-dash-box">
            <div className="driver-dash-box__head">
              <strong>My activity at a glance</strong>
              <ActionButton tone="secondary" onClick={() => router.push('/driver/jobs')}>View all</ActionButton>
            </div>
            <div className="driver-dash-box__body">
              {nextBookings.length === 0 ? (
                <EmptyState compact title="No bookings scheduled" description="Allocated and accepted work will appear here in pickup-time order." />
              ) : (
                <div className="driver-booking-list">
                  {nextBookings.map((job) => (
                    <button key={job.id} type="button" className="driver-booking-row" onClick={() => router.push(`/driver/jobs/${job.id}`)} style={{ width: '100%', padding: 0, textAlign: 'left', cursor: 'pointer', color: 'inherit' }}>
                      <div className="driver-booking-route">
                        <span>From</span>
                        <strong>{job.pickup_location ?? 'Collection'}</strong>
                        <span>To</span>
                        <strong>{job.delivery_location ?? 'Delivery'}</strong>
                      </div>
                      <div className="driver-booking-time">
                        <span>Pickup</span><strong>{formatDateTime(job.pickup_datetime)}</strong>
                        <span>Deliver</span><strong>{formatDateTime(job.delivery_datetime)}</strong>
                      </div>
                      <div>
                        <StatusBadge value={job.current_status ?? job.status} />
                        <span className="driver-dash-note" style={{ display: 'block', marginTop: '3px' }}>Open job →</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {currentJob && currentAction && (
            <section className="driver-dash-box">
              <div className="driver-dash-box__head"><strong>Current job execution</strong><StatusBadge value={currentStatus ?? currentJob.status} tone="orange" /></div>
              <div className="driver-dash-box__body">
                <div className="driver-current-route">
                  <div className="driver-route-stop">
                    <span className="driver-cell-label">Pickup</span>
                    <strong className="driver-cell-primary">{currentJob.pickup_location ?? 'Collection'}</strong>
                    <span className="driver-cell-secondary">{formatDateTime(currentJob.pickup_datetime)}</span>
                  </div>
                  <span className="driver-route-arrow">→</span>
                  <div className="driver-route-stop">
                    <span className="driver-cell-label">Delivery</span>
                    <strong className="driver-cell-primary">{currentJob.delivery_location ?? 'Delivery'}</strong>
                    <span className="driver-cell-secondary">{formatDateTime(currentJob.delivery_datetime)}</span>
                  </div>
                </div>
                <div className="driver-dash-note" style={{ marginTop: '7px' }}><strong>Next action:</strong> {currentAction.description}</div>
                <div className="driver-dash-actions" style={{ marginTop: '7px' }}>
                  <ActionButton tone="success" disabled={transitioningJobId === currentJob.id} onClick={() => void runCurrentAction()}>{transitioningJobId === currentJob.id ? 'Saving…' : currentAction.label}</ActionButton>
                  <ActionButton tone="secondary" onClick={() => router.push(`/driver/jobs/${currentJob.id}`)}>Open full job</ActionButton>
                </div>
              </div>
            </section>
          )}

          <div className="driver-ops-grid-2">
            <section className="driver-dash-box">
              <div className="driver-dash-box__head"><strong>Recent marketplace activity</strong>{ownerDriver && <ActionButton tone="secondary" onClick={() => router.push('/driver/quotes')}>Quotes</ActionButton>}</div>
              <div className="driver-dash-box__body" style={{ padding: 0 }}>
                {!ownerDriver || ownerBids.length === 0 ? (
                  <div style={{ padding: '7px' }}><EmptyState compact title="No recent quote activity" /></div>
                ) : (
                  <table className="driver-dash-table">
                    <thead><tr><th>Route</th><th>Quote</th><th>Result</th></tr></thead>
                    <tbody>
                      {ownerBids.slice(0, 6).map((bid) => {
                        const job = Array.isArray(bid.jobs) ? bid.jobs[0] : bid.jobs;
                        return (
                          <tr key={bid.id}>
                            <td><strong>{job?.pickup_location ?? 'Collection'} → {job?.delivery_location ?? 'Delivery'}</strong></td>
                            <td>{money(Number(bid.bid_price_gbp ?? 0))}</td>
                            <td><StatusBadge value={bid.status} tone={BID_STATUS_TONE[bid.status]} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            <section className="driver-dash-box">
              <div className="driver-dash-box__head"><strong>Readiness & compliance</strong></div>
              <div className="driver-dash-box__body" style={{ padding: 0 }}>
                <table className="driver-dash-table">
                  <tbody>
                    <tr><td>Driver documents</td><td><strong>{myDocuments.length}</strong></td><td><ActionButton tone="secondary" onClick={() => router.push('/driver/documents')}>Open</ActionButton></td></tr>
                    <tr><td>Expiring within 30 days</td><td><strong>{expiringDocuments.length}</strong></td><td><StatusBadge value={expiringDocuments.length ? 'Attention' : 'Ready'} tone={expiringDocuments.length ? 'orange' : 'green'} /></td></tr>
                    <tr><td>Vehicle readiness</td><td colSpan={2}><ActionButton tone="secondary" onClick={() => router.push('/driver/vehicles')}>Check vehicle</ActionButton></td></tr>
                    <tr><td>Availability profile</td><td colSpan={2}><ActionButton tone="secondary" onClick={() => router.push('/driver/availability')}>Update</ActionButton></td></tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <section className="driver-dash-box">
            <div className="driver-dash-box__head"><strong>Recent completed work</strong><ActionButton tone="secondary" onClick={() => router.push('/driver/history')}>History</ActionButton></div>
            <div className="driver-dash-box__body" style={{ padding: 0 }}>
              {recentCompleted.length === 0 ? (
                <div style={{ padding: '7px' }}><EmptyState compact title="No completed jobs yet" /></div>
              ) : (
                <table className="driver-dash-table">
                  <thead><tr><th>Route</th><th>Delivered</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>
                    {recentCompleted.slice(0, 6).map((job) => (
                      <tr key={job.id}>
                        <td><strong>{job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}</strong></td>
                        <td>{formatDateTime(job.delivery_datetime)}</td>
                        <td><StatusBadge value={job.current_status ?? job.status} /></td>
                        <td><ActionButton tone="secondary" onClick={() => router.push(`/driver/jobs/${job.id}`)}>Open</ActionButton></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </main>
      </div>
    </DriverWorkspaceShell>
  );
}
