'use client';

import { useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  getWorkspaceDatasetMetricValue,
  getWorkspaceMetricPresentationStatus,
  isCustomerVisibleWorkspaceInvoice,
  useCompanyWorkspaceData,
  type WorkspaceJob,
} from './useCompanyWorkspaceData';
import { AlertBanner } from './WorkspaceUI';
import carrierStyles from './CarrierDashboard.module.css';
import {
  daysUntil,
  exceptionStatuses,
  metricValue as sharedMetricValue,
  money,
  when,
} from './AdminDashboardShared';
import {
  classifyWorkspaceJobStage,
  fleetQueueStage,
  workspaceJobPresentationStatus,
} from '../../../lib/jobs/workspaceJobStage';
import { toCanonicalInvoiceDisplayStatus } from '../../../lib/invoiceStatus';

const metricValue = (...args: Parameters<typeof sharedMetricValue>) => args[0].loading ? 'Loading' : sharedMetricValue(...args);

const normalise = (value: string | null | undefined) => String(value ?? '').trim().toLowerCase();
const jobStatus = (job: WorkspaceJob) => normalise(job.current_status ?? job.status);

const isActiveAvailableDriver = (driver: { status: string | null; availability_status: string | null }) =>
  normalise(driver.status) === 'active' && normalise(driver.availability_status) === 'available';
const isActiveBusyDriver = (driver: { status: string | null; availability_status: string | null }) =>
  normalise(driver.status) === 'active' && normalise(driver.availability_status) === 'busy';

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

const moneyOrDash = (value: number) => (value > 0 ? money(value) : '—');

function CarrierPanel({
  title,
  subtitle,
  children,
  flush = false,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  flush?: boolean;
  action?: ReactNode;
}) {
  return (
    <section className={carrierStyles.panel} aria-label={title}>
      <header className={carrierStyles.panelHeader}>
        <div className={carrierStyles.panelHeaderText}>
          <h2 className={carrierStyles.panelTitle}>{title}</h2>
          {subtitle ? <p className={carrierStyles.panelSubtitle}>{subtitle}</p> : null}
        </div>
        {action}
      </header>
      <div className={flush ? carrierStyles.panelBodyFlush : carrierStyles.panelBody}>{children}</div>
    </section>
  );
}

function MetricTile({
  label,
  value,
  detail,
  onClick,
}: {
  label: string;
  value: ReactNode;
  detail: ReactNode;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className={carrierStyles.metricTileLabel}>{label}</span>
      <strong className={carrierStyles.metricTileValue}>{value}</strong>
      <span className={carrierStyles.metricTileDetail}>{detail}</span>
    </>
  );

  return onClick ? (
    <button type="button" className={carrierStyles.metricTile} aria-label={label} onClick={onClick}>{content}</button>
  ) : (
    <div className={carrierStyles.metricTile}>{content}</div>
  );
}

function ReportLink({ label, detail, onClick }: { label: string; detail: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className={carrierStyles.reportLink} aria-label={label} onClick={onClick}>
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      <span aria-hidden="true">→</span>
    </button>
  );
}

function BookingCard({ job, onOpen }: { job: WorkspaceJob; onOpen: () => void }) {
  const presentation = workspaceJobPresentationStatus(job);
  const completed = classifyWorkspaceJobStage(job) === 'completed';
  return (
    <article className={carrierStyles.bookingCard}>
      <div className={carrierStyles.bookingRoute}>
        <span><small>From</small><strong>{job.pickup_location ?? job.pickup_postcode ?? 'Collection'}</strong></span>
        <span><small>To</small><strong>{job.delivery_location ?? job.delivery_postcode ?? 'Delivery'}</strong></span>
        <span><small>Veh</small><span>{(job.vehicle_type ?? 'Not specified').replace(/_/g, ' ')}</span></span>
      </div>
      <div className={carrierStyles.bookingTiming}>
        <span><small>Pickup</small><strong>{when(job.pickup_datetime)}</strong></span>
        <span><small>Deliver</small><strong>{when(job.delivery_datetime)}</strong></span>
      </div>
      <div className={carrierStyles.bookingStatus}>
        <strong>{presentation}</strong>
        <span>{completed ? ((job.delivery_photos?.length ?? 0) > 0 ? 'Evidence recorded' : 'Evidence attention') : 'Carrier-awarded work'}</span>
        <small>Job ID: {job.id.slice(0, 8).toUpperCase()}</small>
      </div>
      <div className={carrierStyles.bookingActions}>
        <button type="button" onClick={onOpen}>{isUnallocatedJob(job) ? 'Allocate' : completed ? 'POD' : 'Open'}</button>
      </div>
    </article>
  );
}

export default function CarrierOperationsDashboardHome() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();

  const carrierExecutionJobs = useMemo(
    () => data.jobs.filter((job) => Boolean(data.companyId) && job.awarded_carrier_company_id === data.companyId),
    [data.companyId, data.jobs],
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
      toCanonicalInvoiceDisplayStatus(invoice.status, invoice.due_date, invoice.payment_status) === 'Overdue');
    const payables = data.invoices.filter((invoice) => isCustomerVisibleWorkspaceInvoice(invoice, data.companyId)
      && invoice.supplier_company_id !== data.companyId
      && toCanonicalInvoiceDisplayStatus(invoice.status, invoice.due_date, invoice.payment_status) !== 'Cancelled');
    const overduePayables = payables.filter((invoice) =>
      toCanonicalInvoiceDisplayStatus(invoice.status, invoice.due_date, invoice.payment_status) === 'Overdue');
    const awaitingPayment = payables.filter((invoice) => {
      const status = toCanonicalInvoiceDisplayStatus(invoice.status, invoice.due_date, invoice.payment_status);
      return status === 'Sent' || status === 'Overdue';
    });
    const wonValue = companyBids
      .filter((bid) => normalise(bid.status) === 'accepted' && awardedJobIds.has(bid.job_id))
      .reduce((sum, bid) => sum + Number(bid.bid_price_gbp ?? bid.amount ?? 0), 0);
    const documentDays = data.driverDocuments.concat(data.vehicleDocuments)
      .map((document) => daysUntil(document.expiry_date))
      .filter((days): days is number => days !== null);
    const expiredDocuments = documentDays.filter((days) => days < 0).length;
    const expiringDocuments = documentDays.filter((days) => days >= 0 && days <= 30).length;

    return {
      carrierInvoices,
      overdueInvoices,
      payables,
      overduePayables,
      awaitingPayment,
      wonValue,
      expiredDocuments,
      expiringDocuments,
    };
  }, [carrierExecutionJobs, data]);

  const latestBookings = useMemo(
    () => [...carrierExecutionJobs]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 4),
    [carrierExecutionJobs],
  );

  const jobDataStatus = getWorkspaceMetricPresentationStatus([data.datasets.jobs]);
  const unavailableJobs = jobDataStatus === 'unavailable' || jobDataStatus === 'omitted';
  const partialJobs = jobDataStatus === 'partial';
  const availableDrivers = data.loading ? 'Loading' : getWorkspaceDatasetMetricValue(
    data.datasets.drivers,
    (rows) => rows.filter(isActiveAvailableDriver).length,
  );
  const busyDrivers = data.loading ? 'Loading' : getWorkspaceDatasetMetricValue(
    data.datasets.drivers,
    (rows) => rows.filter(isActiveBusyDriver).length,
  );
  const unassignedVehicles = data.loading ? 'Loading' : getWorkspaceDatasetMetricValue(
    data.datasets.vehicles,
    (rows) => rows.filter((vehicle) => !vehicle.assigned_driver_id).length,
  );

  return (
    <div className={carrierStyles.page} data-testid="carrier-dashboard">
      <h1 className={carrierStyles.dashboardTitle}>Carrier Dashboard</h1>
      {data.error ? <AlertBanner>{data.error}</AlertBanner> : null}

      <div className={carrierStyles.cxDashboardGrid}>
        <div className={carrierStyles.cxDashboardColumn}>
          <CarrierPanel title="Reports & Statistics">
            <div className={carrierStyles.metricTileGrid}>
              <MetricTile
                label="Won work value"
                value={metricValue(data, ['bids', 'jobs'], () => moneyOrDash(metrics.wonValue))}
                detail="Accepted carrier quotes backed by an award"
                onClick={() => router.push('/admin/won-work')}
              />
              <MetricTile
                label="Overdue invoices"
                value={metricValue(data, ['invoices'], () => metrics.overdueInvoices.length)}

                detail={metricValue(data, ['invoices'], () => `${metrics.overdueInvoices.length} overdue invoice${metrics.overdueInvoices.length === 1 ? '' : 's'}`)}
                onClick={() => router.push('/admin/invoices')}
              />
            </div>
          </CarrierPanel>

          <div className={carrierStyles.cxTwinPanels}>
            <CarrierPanel title="Accounts Payable">
              <ReportLink label="Latest invoices received" detail={metricValue(data, ['invoices'], () => `${metrics.payables.length} received invoice${metrics.payables.length === 1 ? '' : 's'}`)} onClick={() => router.push('/admin/invoices')} />
              <ReportLink label="Invoices due for payment" detail={metricValue(data, ['invoices'], () => `${metrics.awaitingPayment.length} awaiting payment`)} onClick={() => router.push('/admin/invoices')} />
              <ReportLink label="Invoices overdue" detail={metricValue(data, ['invoices'], () => `${metrics.overduePayables.length} overdue`)} onClick={() => router.push('/admin/invoices')} />
            </CarrierPanel>

            <CarrierPanel title="Reports">
              <ReportLink label="Gross margin / subcontract reporting" detail="Verified Finance reports and exports" onClick={() => router.push('/admin/finance/reports')} />
              <ReportLink label="Invoice reporting" detail="Invoice register and payment state" onClick={() => router.push('/admin/invoices')} />
              <ReportLink label="Won work reporting" detail="Accepted carrier work and values" onClick={() => router.push('/admin/won-work')} />
            </CarrierPanel>
          </div>

          <CarrierPanel title="Feedback in Last 90 Days">
            <div className={carrierStyles.feedbackGrid}>
              <div className={carrierStyles.feedbackBox}>
                <strong>Received</strong>
                <span>Verified feedback data is not included in the current Carrier feed.</span>
              </div>
              <div className={carrierStyles.feedbackBox}>
                <strong>Given</strong>
                <span>No rating or performance score is fabricated.</span>
              </div>
            </div>
          </CarrierPanel>
        </div>

        <div className={carrierStyles.cxDashboardColumn}>
          <CarrierPanel
            title="Activity at a glance"
            subtitle="Latest carrier-awarded bookings"
            flush
            action={<button type="button" className={carrierStyles.panelHeaderAction} onClick={() => router.push('/admin/diary')}>View all…</button>}
          >
            <div className={carrierStyles.bookingList} aria-live="polite">
              {partialJobs && !data.loading && <AlertBanner tone="warning">Job data is partial. Only loaded bookings are shown; this is not the complete booking list.</AlertBanner>}
              {data.loading ? <div className={carrierStyles.feedbackPlaceholder}><strong>Loading carrier bookings</strong></div> : unavailableJobs ? (
                <div className={carrierStyles.feedbackPlaceholder}>
                  <strong>Job data unavailable</strong>
                  <span>Recent carrier bookings cannot be verified right now.</span>
                </div>
              ) : latestBookings.length > 0 ? latestBookings.map((job) => (
                <BookingCard
                  key={job.id}
                  job={job}
                  onOpen={() => router.push(isUnallocatedJob(job) ? `/admin/fleet/assignments?job=${job.id}` : `/admin/jobs/${job.id}`)}
                />
              )) : partialJobs ? <div className={carrierStyles.feedbackPlaceholder}><strong>No carrier bookings in the partial result</strong><span>Refresh to verify the complete booking list.</span></div> : (
                <div className={carrierStyles.feedbackPlaceholder}>
                  <strong>No recent carrier bookings</strong>
                  <span>Awarded carrier work will appear here when available.</span>
                </div>
              )}
            </div>
          </CarrierPanel>

          <CarrierPanel title="Compliance - Drivers & Vehicles">
            <div className={carrierStyles.complianceSummary}>
              <button type="button" className={carrierStyles.complianceDial} onClick={() => router.push('/admin/fleet/compliance')}>
                <strong>{metricValue(data, ['driverDocuments', 'vehicleDocuments'], () => metrics.expiredDocuments + metrics.expiringDocuments)}</strong>
                <span>document alerts</span>
              </button>
              <div className={carrierStyles.complianceRows}>
                <ReportLink label="Expired documents" detail={metricValue(data, ['driverDocuments', 'vehicleDocuments'], () => `${metrics.expiredDocuments} expired`)} onClick={() => router.push('/admin/fleet/compliance')} />
                <ReportLink label="About to expire" detail={metricValue(data, ['driverDocuments', 'vehicleDocuments'], () => `${metrics.expiringDocuments} due within 30 days`)} onClick={() => router.push('/admin/fleet/compliance')} />
                <ReportLink label="Unassigned vehicles" detail={unassignedVehicles} onClick={() => router.push('/admin/fleet/vehicles')} />
                <ReportLink label="Driver availability" detail={`${availableDrivers} available · ${busyDrivers} busy`} onClick={() => router.push('/admin/live-availability')} />
              </div>
            </div>
          </CarrierPanel>
        </div>
      </div>
    </div>
  );
}
