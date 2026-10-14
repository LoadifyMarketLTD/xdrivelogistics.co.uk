'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import {
  useCompanyWorkspaceData,
  type WorkspaceJob,
} from './useCompanyWorkspaceData';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  OperationalCard,
  StatusBadge,
} from './WorkspaceUI';
import {
  daysUntil,
  exceptionStatuses,
  metricValue,
  money,
  when,
} from './AdminDashboardShared';
import {
  classifyWorkspaceJobStage,
  fleetQueueStage,
  isCompanyExecutionJob,
  workspaceJobOperationalLabel,
  workspaceJobPresentationStatus,
} from '../../../lib/jobs/workspaceJobStage';
import { toCanonicalInvoiceDisplayStatus } from '../../../lib/invoiceStatus';
import { supabase } from '../../../lib/supabaseClient';

const normalise = (value: string | null | undefined) => String(value ?? '').trim().toLowerCase();
const jobStatus = (job: WorkspaceJob) => normalise(job.current_status ?? job.status);

const isUnallocatedJob = (job: WorkspaceJob) =>
  workspaceJobPresentationStatus(job) === 'awarded' || fleetQueueStage(job) === 'unallocated';

const isDeliveryEvidenceMissingJob = (job: WorkspaceJob) =>
  classifyWorkspaceJobStage(job) === 'completed' && (job.delivery_photos?.length ?? 0) === 0;

const isExceptionJob = (job: WorkspaceJob) => {
  const status = jobStatus(job);
  return status !== 'cancelled' && exceptionStatuses.has(status);
};

export const isCarrierAttentionJob = (job: WorkspaceJob) =>
  isExceptionJob(job) || isUnallocatedJob(job) || isDeliveryEvidenceMissingJob(job);

type FeedbackMode = 'received' | 'given';

type FeedbackSummary = {
  received: { count: number; average: number | null };
  given: { count: number; average: number | null };
};

type WatchlistSummary = {
  total: number;
  fullyCompliant: number;
  aboutToExpire: number;
  updatesNeeded: number;
};

const emptyFeedback: FeedbackSummary = {
  received: { count: 0, average: null },
  given: { count: 0, average: null },
};

const emptyWatchlist: WatchlistSummary = {
  total: 0,
  fullyCompliant: 0,
  aboutToExpire: 0,
  updatesNeeded: 0,
};

function CommercialRow({
  label,
  detail,
  value,
  onClick,
}: {
  label: string;
  detail: string;
  value: ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" className="carrier-cx-list-button" onClick={onClick}>
      <span className="carrier-cx-list-button__copy">
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      <strong className="carrier-cx-list-button__value">{value}</strong>
    </button>
  );
}

function WorkflowLink({
  label,
  detail,
  onClick,
}: {
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="carrier-cx-list-button" onClick={onClick}>
      <span className="carrier-cx-list-button__copy">
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      <span className="carrier-cx-list-button__arrow" aria-hidden="true">›</span>
    </button>
  );
}

function percentage(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : null;
}

export default function CarrierOperationsDashboardHome() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();

  const todayKey = new Date().toISOString().slice(0, 10);
  const [reportFrom, setReportFrom] = useState(() => `${todayKey.slice(0, 8)}01`);
  const [reportTo, setReportTo] = useState(todayKey);

  const [activityIdentity, setActivityIdentity] = useState('');
  const [activityLocation, setActivityLocation] = useState('');
  const [activityReference, setActivityReference] = useState('');

  const [paymentFeedbackMode, setPaymentFeedbackMode] = useState<FeedbackMode>('received');
  const [deliveryFeedbackMode, setDeliveryFeedbackMode] = useState<FeedbackMode>('given');
  const [feedbackSummary, setFeedbackSummary] = useState<FeedbackSummary>(emptyFeedback);
  const [watchlistSummary, setWatchlistSummary] = useState<WatchlistSummary>(emptyWatchlist);
  const [watchlistError, setWatchlistError] = useState('');

  useEffect(() => {
    if (!data.companyId) {
      setFeedbackSummary(emptyFeedback);
      return;
    }

    let cancelled = false;
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    void Promise.all([
      supabase
        .from('reviews')
        .select('rating')
        .eq('company_id', data.companyId)
        .gte('created_at', since),
      supabase
        .from('reviews')
        .select('rating')
        .eq('reviewer_company_id', data.companyId)
        .gte('created_at', since),
    ]).then(([receivedResult, givenResult]) => {
      if (cancelled) return;

      const summarise = (rows: Array<{ rating: number | null }> | null | undefined) => {
        const ratings = (rows ?? [])
          .map((row) => Number(row.rating))
          .filter((rating) => Number.isFinite(rating) && rating >= 1 && rating <= 5);
        const average = ratings.length
          ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10
          : null;
        return { count: ratings.length, average };
      };

      setFeedbackSummary({
        received: receivedResult.error ? emptyFeedback.received : summarise(receivedResult.data),
        given: givenResult.error ? emptyFeedback.given : summarise(givenResult.data),
      });
    });

    return () => {
      cancelled = true;
    };
  }, [data.companyId]);

  useEffect(() => {
    const companyId = data.companyId;
    if (!companyId) {
      setWatchlistSummary(emptyWatchlist);
      setWatchlistError('');
      return;
    }

    let cancelled = false;

    void supabase.auth.getSession().then(async ({ data: authData }) => {
      const token = authData.session?.access_token;
      if (!token) {
        if (!cancelled) setWatchlistError('Watchlist unavailable until the session is refreshed.');
        return;
      }

      const response = await fetch(
        '/api/settings/company-watchlist?companyId=' + encodeURIComponent(companyId),
        {
          headers: { Authorization: 'Bearer ' + token },
          cache: 'no-store',
        },
      );
      const payload = await response.json().catch(() => ({})) as {
        summary?: Partial<WatchlistSummary>;
        error?: string;
      };

      if (cancelled) return;
      if (!response.ok) {
        setWatchlistSummary(emptyWatchlist);
        setWatchlistError(payload.error || 'Supplier watchlist could not be loaded.');
        return;
      }

      setWatchlistError('');
      setWatchlistSummary({
        total: Number(payload.summary?.total ?? 0),
        fullyCompliant: Number(payload.summary?.fullyCompliant ?? 0),
        aboutToExpire: Number(payload.summary?.aboutToExpire ?? 0),
        updatesNeeded: Number(payload.summary?.updatesNeeded ?? 0),
      });
    });

    return () => {
      cancelled = true;
    };
  }, [data.companyId]);

  const carrierExecutionJobs = useMemo(
    () => data.jobs.filter((job) => isCompanyExecutionJob(job, data.companyId)),
    [data.companyId, data.jobs],
  );

  const driverById = useMemo(
    () => new Map(data.drivers.map((driver) => [
      driver.id,
      driver.display_name ?? driver.email ?? 'Driver',
    ])),
    [data.drivers],
  );

  const metrics = useMemo(() => {
    const companyBids = data.bids.filter((bid) => bid.company_id === data.companyId);
    const awardedJobIds = new Set(carrierExecutionJobs.map((job) => job.id));

    const carrierInvoices = data.invoices.filter((invoice) => {
      if (invoice.supplier_company_id) return invoice.supplier_company_id === data.companyId;
      return Boolean(invoice.buyer_company_id)
        && invoice.buyer_company_id !== data.companyId
        && invoice.company_id === data.companyId;
    });

    const overdueInvoices = carrierInvoices.filter((invoice) =>
      toCanonicalInvoiceDisplayStatus(
        invoice.status,
        invoice.due_date,
        invoice.payment_status,
      ) === 'Overdue');

    const overdueExposure = overdueInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.amount ?? invoice.net_amount ?? 0),
      0,
    );

    const wonValue = companyBids
      .filter((bid) => normalise(bid.status) === 'accepted' && awardedJobIds.has(bid.job_id))
      .reduce((sum, bid) => sum + Number(bid.bid_price_gbp ?? bid.amount ?? 0), 0);

    const submittedQuotes = companyBids.filter(
      (bid) => normalise(bid.status) === 'submitted',
    ).length;

    const expiringDocuments = data.driverDocuments
      .concat(data.vehicleDocuments)
      .filter((document) => {
        const days = daysUntil(document.expiry_date);
        return days !== null && days <= 30;
      }).length;

    return {
      companyBids,
      carrierInvoices,
      overdueInvoices,
      overdueExposure,
      wonValue,
      submittedQuotes,
      expiringDocuments,
    };
  }, [carrierExecutionJobs, data]);

  const cxDashboard = useMemo(() => {
    const payables = data.invoices.filter((invoice) =>
      invoice.buyer_company_id === data.companyId
      && Boolean(invoice.supplier_company_id)
      && invoice.supplier_company_id !== data.companyId);

    const fromMs = new Date(`${reportFrom}T00:00:00`).getTime();
    const toMs = new Date(`${reportTo}T23:59:59.999`).getTime();

    const inReportRange = (value: string | null | undefined) => {
      if (!value) return false;
      const timestamp = new Date(value).getTime();
      return Number.isFinite(timestamp) && timestamp >= fromMs && timestamp <= toMs;
    };

    const reportPayables = payables.filter((invoice) =>
      inReportRange(invoice.invoice_date ?? invoice.created_at));

    const payableTotal = reportPayables.reduce(
      (sum, invoice) => sum + Number(invoice.amount ?? invoice.net_amount ?? 0),
      0,
    );

    const currentMonth = new Date();
    const monthlyPayables = payables.filter((invoice) => {
      const source = invoice.invoice_date ?? invoice.created_at;
      const date = source ? new Date(source) : null;
      return Boolean(date)
        && date!.getFullYear() === currentMonth.getFullYear()
        && date!.getMonth() === currentMonth.getMonth();
    });

    const monthlyPayableTotal = monthlyPayables.reduce(
      (sum, invoice) => sum + Number(invoice.amount ?? invoice.net_amount ?? 0),
      0,
    );

    const payableStates = payables.map((invoice) =>
      toCanonicalInvoiceDisplayStatus(
        invoice.status,
        invoice.due_date,
        invoice.payment_status,
      ));

    const paidPayables = payableStates.filter((state) => state === 'Paid').length;
    const overduePayables = payableStates.filter((state) => state === 'Overdue').length;
    const awaitingPayables = payableStates.filter(
      (state) => state !== 'Paid' && state !== 'Overdue',
    ).length;

    const completedJobs = carrierExecutionJobs.filter(
      (job) => classifyWorkspaceJobStage(job) === 'completed',
    );
    const completedWithoutException = completedJobs.filter(
      (job) => !isExceptionJob(job),
    ).length;
    const subcontracted = carrierExecutionJobs.filter(
      (job) => Boolean(job.assigned_company_id)
        && job.assigned_company_id !== data.companyId,
    ).length;
    const allocated = carrierExecutionJobs.filter(
      (job) => Boolean(job.assigned_driver_id),
    ).length;

    const carrierJobIds = new Set(carrierExecutionJobs.map((job) => job.id));
    const reportWonValue = metrics.companyBids
      .filter((bid) =>
        normalise(bid.status) === 'accepted'
        && carrierJobIds.has(bid.job_id)
        && inReportRange(bid.created_at))
      .reduce((sum, bid) => sum + Number(bid.bid_price_gbp ?? bid.amount ?? 0), 0);

    return {
      payables,
      payableTotal,
      monthlyPayableTotal,
      paidPayables,
      overduePayables,
      awaitingPayables,
      completedJobs,
      completedWithoutException,
      subcontracted,
      allocated,
      grossMargin: reportWonValue - payableTotal,
    };
  }, [
    carrierExecutionJobs,
    data.companyId,
    data.invoices,
    metrics.companyBids,
    reportFrom,
    reportTo,
  ]);

  const latestBookings = useMemo(() => {
    const identityQuery = normalise(activityIdentity);
    const locationQuery = normalise(activityLocation);
    const referenceQuery = normalise(activityReference);

    return [...carrierExecutionJobs]
      .filter((job) => {
        if (identityQuery) {
          const driver = job.assigned_driver_id
            ? driverById.get(job.assigned_driver_id) ?? ''
            : '';
          const identity = [
            driver,
            job.client_name,
            job.id,
            job.booking_reference,
            job.customer_reference,
          ].map(normalise).join(' ');
          if (!identity.includes(identityQuery)) return false;
        }

        if (locationQuery) {
          const location = [
            job.pickup_location,
            job.pickup_postcode,
            job.delivery_location,
            job.delivery_postcode,
          ].map(normalise).join(' ');
          if (!location.includes(locationQuery)) return false;
        }

        if (referenceQuery) {
          const reference = [
            job.id,
            job.booking_reference,
            job.customer_reference,
          ].map(normalise).join(' ');
          if (!reference.includes(referenceQuery)) return false;
        }

        return true;
      })
      .sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  }, [
    activityIdentity,
    activityLocation,
    activityReference,
    carrierExecutionJobs,
    driverById,
  ]);

  const paymentPerformance = percentage(
    cxDashboard.paidPayables,
    cxDashboard.paidPayables + cxDashboard.overduePayables,
  );
  const deliveryPerformance = percentage(
    cxDashboard.completedWithoutException,
    cxDashboard.completedJobs.length,
  );

  const paymentFeedback = feedbackSummary[paymentFeedbackMode];
  const deliveryFeedback = feedbackSummary[deliveryFeedbackMode];

  const selectReportRange = (value: string) => {
    const end = new Date();
    const start = new Date(end);

    if (value === 'month') start.setDate(1);
    if (value === '30') start.setDate(start.getDate() - 29);
    if (value === '90') start.setDate(start.getDate() - 89);

    if (value !== 'custom') {
      setReportFrom(start.toISOString().slice(0, 10));
      setReportTo(end.toISOString().slice(0, 10));
    }
  };

  return (
    <div className="xdrive-admin-dashboard-home">
      {data.error ? <AlertBanner>{data.error}</AlertBanner> : null}

      <div className="carrier-cx-dashboard-grid">
        <div className="carrier-cx-dashboard-column carrier-cx-dashboard-column--left">
          <OperationalCard
            title="Reports & Statistics"
            className="carrier-cx-reporting-card"
            flush
          >
            <div className="carrier-cx-reporting-body">
              <div className="carrier-cx-report-controls">
                <input
                  aria-label="Report from date"
                  type="date"
                  value={reportFrom}
                  max={reportTo}
                  onChange={(event) => setReportFrom(event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => {
                    setReportFrom(todayKey);
                    setReportTo(todayKey);
                  }}
                >
                  Today
                </button>
                <select
                  aria-label="Select report date range"
                  defaultValue="custom"
                  onChange={(event) => selectReportRange(event.target.value)}
                >
                  <option value="custom">Select Dates</option>
                  <option value="month">This month</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                </select>
              </div>
              <div className="carrier-cx-stat-grid">
              <button
                type="button"
                className="carrier-cx-stat-card"
                onClick={() => router.push('/admin/won-work')}
              >
                <span>Gross Margin</span>
                <strong>
                  {metricValue(data, ['bids', 'jobs', 'invoices'], () =>
                    money(cxDashboard.grossMargin))}
                </strong>
                <small>Won work less recorded sub-contract spend</small>
                <em>How is this calculated?</em>
              </button>

              <button
                type="button"
                className="carrier-cx-stat-card"
                onClick={() => router.push('/admin/invoices')}
              >
                <span>Sub-contract Spend</span>
                <strong>
                  {metricValue(data, ['invoices'], () =>
                    money(cxDashboard.payableTotal))}
                </strong>
                <small>
                  {cxDashboard.payables.length} supplier invoice
                  {cxDashboard.payables.length === 1 ? '' : 's'}
                </small>
                <em>How is this calculated?</em>
              </button>
              </div>
            </div>
          </OperationalCard>

          <div className="carrier-cx-dashboard-subgrid">
            <OperationalCard title="Accounts Payable" flush>
              <CommercialRow
                label="Latest Invoices Received"
                detail="Supplier invoices visible to this company"
                value={metricValue(data, ['invoices'], () => cxDashboard.payables.length)}
                onClick={() => router.push('/admin/invoices')}
              />
              <CommercialRow
                label="Invoices due for Payment"
                detail="Recorded supplier invoices currently overdue"
                value={metricValue(data, ['invoices'], () => cxDashboard.overduePayables)}
                onClick={() => router.push('/admin/invoices')}
              />
              <CommercialRow
                label="Invoices Awaiting Payment"
                detail="Open supplier invoices not yet overdue"
                value={metricValue(data, ['invoices'], () => cxDashboard.awaitingPayables)}
                onClick={() => router.push('/admin/invoices')}
              />
              <CommercialRow
                label="Monthly Totals"
                detail="Supplier invoice total for the current month"
                value={metricValue(data, ['invoices'], () =>
                  money(cxDashboard.monthlyPayableTotal))}
                onClick={() => router.push('/admin/invoices')}
              />
            </OperationalCard>

            <OperationalCard title="Reports" flush>
              <CommercialRow
                label="Bookings Received"
                detail="Carrier-awarded bookings in this workspace"
                value={metricValue(data, ['jobs'], () => carrierExecutionJobs.length)}
                onClick={() => router.push('/admin/diary')}
              />
              <CommercialRow
                label="Bookings Sub-contracted"
                detail="Awarded work delegated to another company"
                value={metricValue(data, ['jobs'], () => cxDashboard.subcontracted)}
                onClick={() => router.push('/admin/diary')}
              />
              <CommercialRow
                label="Loads Allocated"
                detail="Carrier work with an allocated driver"
                value={metricValue(data, ['jobs'], () => cxDashboard.allocated)}
                onClick={() => router.push('/admin/fleet/assignments')}
              />
              <WorkflowLink
                label="Return Journeys"
                detail="Open the published and available return capacity register"
                onClick={() => router.push('/admin/fleet/returns')}
              />
            </OperationalCard>
          </div>

          <OperationalCard
            title="Feedback in Last 90 Days"
            className="carrier-cx-feedback-card"
            flush
          >
            <div className="carrier-cx-feedback-grid">
              <section className="carrier-cx-feedback-panel">
                <div className="carrier-cx-feedback-panel__toolbar">
                  <strong>Payment Performance</strong>
                  <select
                    aria-label="Payment feedback direction"
                    value={paymentFeedbackMode}
                    onChange={(event) =>
                      setPaymentFeedbackMode(event.target.value as FeedbackMode)}
                  >
                    <option value="received">Received</option>
                    <option value="given">Given</option>
                  </select>
                </div>
                <div className="carrier-cx-performance-chart">
                  <div
                    className="carrier-cx-performance-chart__bar"
                    style={{ width: `${paymentPerformance ?? 0}%` }}
                  />
                  <strong>{paymentPerformance == null ? '—' : `${paymentPerformance}%`}</strong>
                </div>
                <small>
                  {paymentFeedback.count
                    ? `${paymentFeedback.count} feedback · ${paymentFeedback.average?.toFixed(1) ?? '—'} / 5 average`
                    : 'No verified feedback in this direction yet'}
                </small>
              </section>

              <section className="carrier-cx-feedback-panel">
                <div className="carrier-cx-feedback-panel__toolbar">
                  <strong>Delivery Performance</strong>
                  <select
                    aria-label="Delivery feedback direction"
                    value={deliveryFeedbackMode}
                    onChange={(event) =>
                      setDeliveryFeedbackMode(event.target.value as FeedbackMode)}
                  >
                    <option value="received">Received</option>
                    <option value="given">Given</option>
                  </select>
                </div>
                <div className="carrier-cx-performance-chart">
                  <div
                    className="carrier-cx-performance-chart__bar"
                    style={{ width: `${deliveryPerformance ?? 0}%` }}
                  />
                  <strong>{deliveryPerformance == null ? '—' : `${deliveryPerformance}%`}</strong>
                </div>
                <small>
                  {deliveryFeedback.count
                    ? `${deliveryFeedback.count} feedback · ${deliveryFeedback.average?.toFixed(1) ?? '—'} / 5 average`
                    : 'No verified feedback in this direction yet'}
                </small>
              </section>
            </div>
          </OperationalCard>
        </div>

        <div className="carrier-cx-dashboard-column carrier-cx-dashboard-column--right">
          <OperationalCard
            title="Activity at a glance"
            className="carrier-cx-activity-card"
            flush
          >
            <div className="carrier-cx-booking-header">
              <strong>Latest Bookings</strong>
              <button type="button" onClick={() => router.push('/admin/diary')}>
                View All...
              </button>
            </div>

            <div className="carrier-cx-booking-list">
              {latestBookings.map((job) => {
                const completed = classifyWorkspaceJobStage(job) === 'completed';
                const evidenceReady = (job.delivery_photos?.length ?? 0) > 0;
                const needsAllocation = isUnallocatedJob(job);

                return (
                  <article key={job.id} className="carrier-cx-booking-card">
                    <div className="carrier-cx-booking-route">
                      <div>
                        <span>From:</span>
                        <strong>
                          {job.pickup_location ?? job.pickup_postcode ?? 'Collection not supplied'}
                        </strong>
                      </div>
                      <div>
                        <span>To:</span>
                        <strong>
                          {job.delivery_location ?? job.delivery_postcode ?? 'Delivery not supplied'}
                        </strong>
                      </div>
                      <div>
                        <span>Veh:</span>
                        <strong>{(job.vehicle_type ?? 'Not specified').replace(/_/g, ' ')}</strong>
                      </div>
                    </div>

                    <div className="carrier-cx-booking-schedule">
                      <div>
                        <span>Pickup:</span>
                        <strong>{when(job.pickup_datetime)}</strong>
                      </div>
                      <div>
                        <span>Deliver:</span>
                        <strong>{when(job.delivery_datetime)}</strong>
                      </div>
                    </div>

                    <div className="carrier-cx-booking-meta">
                      <StatusBadge
                        value={workspaceJobOperationalLabel(job)}
                        tone={completed ? 'green' : needsAllocation ? 'orange' : undefined}
                      />
                      <div>
                        <span>Load ID:</span>
                        <strong>{job.id.slice(0, 8).toUpperCase()}</strong>
                      </div>
                      <div>
                        <span>Driver:</span>
                        <strong>
                          {job.assigned_driver_id
                            ? driverById.get(job.assigned_driver_id) ?? 'Assigned'
                            : 'Unallocated'}
                        </strong>
                      </div>
                    </div>

                    <div className="carrier-cx-booking-actions">
                      {completed ? (
                        <ActionButton
                          tone="secondary"
                          onClick={() => router.push(`/admin/jobs/${job.id}`)}
                        >
                          {evidenceReady ? 'POD' : 'Enter POD'}
                        </ActionButton>
                      ) : (
                        <ActionButton
                          tone="secondary"
                          onClick={() => router.push(`/admin/jobs/${job.id}`)}
                        >
                          Track
                        </ActionButton>
                      )}

                      <ActionButton
                        tone={needsAllocation ? 'success' : 'secondary'}
                        onClick={() => router.push(
                          needsAllocation
                            ? `/admin/fleet/assignments?job=${job.id}`
                            : `/admin/jobs/${job.id}`,
                        )}
                      >
                        {needsAllocation ? 'Allocate' : 'Open booking'}
                      </ActionButton>
                    </div>
                  </article>
                );
              })}

              {!latestBookings.length ? (
                <EmptyState
                  compact
                  title="No recent carrier bookings"
                  description="Awarded carrier work matching these filters will appear here."
                />
              ) : null}
            </div>
          </OperationalCard>

          <OperationalCard
            title="Compliance - Manage Your Suppliers"
            className="carrier-cx-compliance-card"
            actions={(
              <button
                type="button"
                className="carrier-cx-card-link"
                onClick={() => router.push('/admin/marketplace/directory')}
              >
                Add Members to My Watchlist
              </button>
            )}
            flush
          >
            <div className="carrier-cx-compliance-body">
              <button
                type="button"
                className="carrier-cx-watchlist-orb"
                onClick={() => router.push('/admin/marketplace/directory')}
              >
                <strong>{watchlistSummary.total}</strong>
                <span>Add Members to My Watchlist</span>
              </button>

              <div className="carrier-cx-compliance-legend">
                <button type="button" onClick={() => router.push('/admin/marketplace/directory')}>
                  <span>Fully Compliant ({watchlistSummary.fullyCompliant} suppliers)</span>
                  <i className="carrier-cx-compliance-dot carrier-cx-compliance-dot--green" />
                </button>
                <button type="button" onClick={() => router.push('/admin/marketplace/directory')}>
                  <span>About to Expire ({watchlistSummary.aboutToExpire} suppliers)</span>
                  <i className="carrier-cx-compliance-dot carrier-cx-compliance-dot--amber" />
                </button>
                <button type="button" onClick={() => router.push('/admin/marketplace/directory')}>
                  <span>Updates Needed ({watchlistSummary.updatesNeeded} suppliers)</span>
                  <i className="carrier-cx-compliance-dot carrier-cx-compliance-dot--red" />
                </button>
                {watchlistError ? <small>{watchlistError}</small> : null}
              </div>
            </div>
          </OperationalCard>
        </div>
      </div>
    </div>
  );
}
