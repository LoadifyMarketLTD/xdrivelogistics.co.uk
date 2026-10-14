'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  getWorkspaceDatasetMetricValue,
  useCompanyWorkspaceData,
  type WorkspaceJob,
} from './useCompanyWorkspaceData';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  OperationalCard,
  OperationalFilterField,
  OperationalFilterInput,
  OperationalFilterSelect,
  OperationalFilters,
  OperationalPageLayout,
  StatusBadge,
  workspaceTheme,
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

type ControlView = 'attention' | 'unallocated' | 'live' | 'pod' | 'exceptions' | 'all';

const CONTROL_VIEWS: Array<{ value: ControlView; label: string }> = [
  { value: 'attention', label: 'Needs attention' },
  { value: 'unallocated', label: 'Unallocated' },
  { value: 'live', label: 'Live jobs' },
  { value: 'pod', label: 'Photo evidence' },
  { value: 'exceptions', label: 'Exceptions' },
  { value: 'all', label: 'All carrier work' },
];

const normalise = (value: string | null | undefined) => String(value ?? '').trim().toLowerCase();
const jobStatus = (job: WorkspaceJob) => normalise(job.current_status ?? job.status);
const isActiveAvailableDriver = (driver: { status: string | null; availability_status: string | null }) =>
  normalise(driver.status) === 'active' && normalise(driver.availability_status) === 'available';
const isActiveBusyDriver = (driver: { status: string | null; availability_status: string | null }) =>
  normalise(driver.status) === 'active' && normalise(driver.availability_status) === 'busy';

// These predicates are lifecycle predicates only. Carrier company scoping is
// applied first at `carrierExecutionJobs` and never delegated to the predicate.
const isUnallocatedJob = (job: WorkspaceJob) =>
  workspaceJobPresentationStatus(job) === 'awarded' || fleetQueueStage(job) === 'unallocated';
const isLiveJob = (job: WorkspaceJob) => classifyWorkspaceJobStage(job) === 'in_progress';
// The shared dashboard feed exposes delivery_photos but not the full POD
// signature/recipient/document contract. This predicate therefore means only
// "completed work with no delivery-photo evidence in this feed".
const isDeliveryEvidenceMissingJob = (job: WorkspaceJob) =>
  classifyWorkspaceJobStage(job) === 'completed' && (job.delivery_photos?.length ?? 0) === 0;
const isExceptionJob = (job: WorkspaceJob) => {
  const status = jobStatus(job);
  return status !== 'cancelled' && exceptionStatuses.has(status);
};

export const isCarrierAttentionJob = (job: WorkspaceJob) =>
  isExceptionJob(job) || isUnallocatedJob(job) || isDeliveryEvidenceMissingJob(job);

const attentionScore = (job: WorkspaceJob) => {
  if (isExceptionJob(job)) return 0;
  if (isUnallocatedJob(job)) return 1;
  if (isLiveJob(job)) return 2;
  if (isDeliveryEvidenceMissingJob(job)) return 3;
  return 4;
};

const priorityLabel = (job: WorkspaceJob) => {
  if (isExceptionJob(job)) return 'Exception';
  if (isUnallocatedJob(job)) return 'Allocate';
  if (isLiveJob(job)) return 'Live';
  if (isDeliveryEvidenceMissingJob(job)) return 'Photo evidence';
  return 'Routine';
};

const priorityStyle = (job: WorkspaceJob) => {
  if (isExceptionJob(job)) return { color: workspaceTheme.red, background: '#FEF2F2', border: '#FECACA' };
  if (isUnallocatedJob(job)) return { color: '#92400E', background: '#FFFBEB', border: '#FDE68A' };
  if (isLiveJob(job)) return { color: workspaceTheme.blue, background: '#EFF6FF', border: '#BFDBFE' };
  if (isDeliveryEvidenceMissingJob(job)) return { color: '#92400E', background: '#FFF8E8', border: '#FDE68A' };
  return { color: workspaceTheme.muted, background: workspaceTheme.surfaceMuted, border: workspaceTheme.border };
};


function RailMetric({ label, value, onClick }: { label: string; value: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ width: '100%', minHeight: '28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '5px 0', border: 0, borderBottom: `1px solid ${workspaceTheme.divider}`, background: 'transparent', color: workspaceTheme.text, cursor: 'pointer', textAlign: 'left', fontSize: '11px' }}>
      <span>{label}</span><strong style={{ color: workspaceTheme.navy, fontSize: '12px' }}>{value}</strong>
    </button>
  );
}

function WorkflowLink({ label, detail, onClick }: { label: string; detail: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ width: '100%', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center', gap: '8px', minHeight: 'var(--ws-table-row-h, 42px)', padding: '6px 0', border: 0, borderBottom: `1px solid ${workspaceTheme.divider}`, background: 'transparent', color: workspaceTheme.text, textAlign: 'left', cursor: 'pointer' }}>
      <span style={{ minWidth: 0 }}><strong style={{ display: 'block', fontSize: '12px', lineHeight: '16px', fontWeight: 650 }}>{label}</strong><span style={{ display: 'block', color: workspaceTheme.muted, fontSize: '11px', lineHeight: '14px' }}>{detail}</span></span>
      <span aria-hidden="true" style={{ color: workspaceTheme.blue, fontSize: '14px', fontWeight: 800 }}>→</span>
    </button>
  );
}

function CommercialRow({ label, detail, value, onClick }: { label: string; detail: string; value: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ width: '100%', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center', gap: '10px', minHeight: '42px', padding: '6px 0', border: 0, borderBottom: `1px solid ${workspaceTheme.divider}`, background: 'transparent', textAlign: 'left', cursor: 'pointer' }}>
      <span><strong style={{ display: 'block', color: workspaceTheme.text, fontSize: '12px', lineHeight: '16px', fontWeight: 650 }}>{label}</strong><span style={{ display: 'block', color: workspaceTheme.muted, fontSize: '11px', lineHeight: '14px' }}>{detail}</span></span>
      <strong style={{ color: workspaceTheme.navy, fontSize: '13px', whiteSpace: 'nowrap' }}>{value}</strong>
    </button>
  );
}

export default function CarrierOperationsDashboardHome() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const [view, setView] = useState<ControlView>('attention');
  const [searchDraft, setSearchDraft] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const todayKey = new Date().toISOString().slice(0, 10);
  const [reportFrom, setReportFrom] = useState(() => `${todayKey.slice(0, 8)}01`);
  const [reportTo, setReportTo] = useState(todayKey);
  const [feedbackSummary, setFeedbackSummary] = useState<{ count: number; average: number | null }>({ count: 0, average: null });

  useEffect(() => {
    if (!data.companyId) {
      setFeedbackSummary({ count: 0, average: null });
      return;
    }
    let cancelled = false;
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    void supabase
      .from('reviews')
      .select('rating')
      .eq('company_id', data.companyId)
      .gte('created_at', since)
      .then(({ data: rows, error }) => {
        if (cancelled || error) return;
        const ratings = (rows ?? []).map((row) => Number(row.rating)).filter((rating) => Number.isFinite(rating) && rating >= 1 && rating <= 5);
        const average = ratings.length ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10 : null;
        setFeedbackSummary({ count: ratings.length, average });
      });
    return () => { cancelled = true; };
  }, [data.companyId]);

  // `useCompanyWorkspaceData` intentionally also carries jobs owned by this
  // company. Carrier execution surfaces must never treat those customer-role
  // jobs as work being executed by this carrier unless the award says so.
  const carrierExecutionJobs = useMemo(
    () => data.jobs.filter((job) => isCompanyExecutionJob(job, data.companyId)),
    [data.companyId, data.jobs],
  );

  const driverById = useMemo(
    () => new Map(data.drivers.map((driver) => [driver.id, driver.display_name ?? driver.email ?? 'Driver'])),
    [data.drivers],
  );

  const vehicleTypes = useMemo(
    () => Array.from(new Set(carrierExecutionJobs.map((job) => job.vehicle_type).filter((value): value is string => Boolean(value)))).sort(),
    [carrierExecutionJobs],
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
    const unallocatedJobs = carrierExecutionJobs.filter(isUnallocatedJob);
    const liveJobs = carrierExecutionJobs.filter(isLiveJob);
    const evidenceReview = carrierExecutionJobs.filter(isDeliveryEvidenceMissingJob);
    const exceptions = carrierExecutionJobs.filter(isExceptionJob);
    const attentionJobs = carrierExecutionJobs.filter(isCarrierAttentionJob).sort((a, b) => attentionScore(a) - attentionScore(b));
    const overdueInvoices = carrierInvoices.filter((invoice) =>
      toCanonicalInvoiceDisplayStatus(invoice.status, invoice.due_date, invoice.payment_status) === 'Overdue');
    const overdueExposure = overdueInvoices.reduce((sum, invoice) => sum + Number(invoice.amount ?? invoice.net_amount ?? 0), 0);
    const wonValue = companyBids
      .filter((bid) => normalise(bid.status) === 'accepted' && awardedJobIds.has(bid.job_id))
      .reduce((sum, bid) => sum + Number(bid.bid_price_gbp ?? bid.amount ?? 0), 0);
    const expiringDocuments = data.driverDocuments.concat(data.vehicleDocuments).filter((document) => {
      const days = daysUntil(document.expiry_date);
      return days !== null && days <= 30;
    }).length;

    return { companyBids, unallocatedJobs, liveJobs, evidenceReview, exceptions, attentionJobs, overdueInvoices, overdueExposure, wonValue, expiringDocuments };
  }, [carrierExecutionJobs, data]);

  const latestBookings = useMemo(
    () => [...carrierExecutionJobs]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5),
    [carrierExecutionJobs],
  );

  const cxDashboard = useMemo(() => {
    const payables = data.invoices.filter((invoice) => invoice.buyer_company_id === data.companyId && invoice.supplier_company_id && invoice.supplier_company_id !== data.companyId);
    const receivables = data.invoices.filter((invoice) => invoice.supplier_company_id === data.companyId || (!invoice.supplier_company_id && invoice.company_id === data.companyId));
    const fromMs = new Date(`${reportFrom}T00:00:00`).getTime();
    const toMs = new Date(`${reportTo}T23:59:59.999`).getTime();
    const inReportRange = (value: string | null | undefined) => {
      if (!value) return false;
      const timestamp = new Date(value).getTime();
      return Number.isFinite(timestamp) && timestamp >= fromMs && timestamp <= toMs;
    };
    const reportPayables = payables.filter((invoice) => inReportRange(invoice.invoice_date ?? invoice.created_at));
    const payableTotal = reportPayables.reduce((sum, invoice) => sum + Number(invoice.amount ?? invoice.net_amount ?? 0), 0);
    const currentMonth = new Date();
    const monthlyPayables = payables.filter((invoice) => {
      const source = invoice.invoice_date ?? invoice.created_at;
      const date = source ? new Date(source) : null;
      return Boolean(date) && date!.getFullYear() === currentMonth.getFullYear() && date!.getMonth() === currentMonth.getMonth();
    });
    const monthlyPayableTotal = monthlyPayables.reduce((sum, invoice) => sum + Number(invoice.amount ?? invoice.net_amount ?? 0), 0);
    const payableStates = payables.map((invoice) => toCanonicalInvoiceDisplayStatus(invoice.status, invoice.due_date, invoice.payment_status));
    const paidPayables = payableStates.filter((state) => state === 'Paid').length;
    const overduePayables = payableStates.filter((state) => state === 'Overdue').length;
    const awaitingPayables = payableStates.filter((state) => state !== 'Paid' && state !== 'Overdue').length;
    const completedJobs = carrierExecutionJobs.filter((job) => classifyWorkspaceJobStage(job) === 'completed');
    const completedWithoutException = completedJobs.filter((job) => !isExceptionJob(job)).length;
    const subcontracted = carrierExecutionJobs.filter((job) => Boolean(job.assigned_company_id) && job.assigned_company_id !== data.companyId).length;
    const allocated = carrierExecutionJobs.filter((job) => Boolean(job.assigned_driver_id)).length;
    const carrierJobIds = new Set(carrierExecutionJobs.map((job) => job.id));
    const reportWonValue = metrics.companyBids
      .filter((bid) => normalise(bid.status) === 'accepted' && carrierJobIds.has(bid.job_id) && inReportRange(bid.created_at))
      .reduce((sum, bid) => sum + Number(bid.bid_price_gbp ?? bid.amount ?? 0), 0);
    const grossMargin = reportWonValue - payableTotal;
    return {
      payables,
      receivables,
      payableTotal,
      monthlyPayableTotal,
      paidPayables,
      overduePayables,
      awaitingPayables,
      completedJobs,
      completedWithoutException,
      subcontracted,
      allocated,
      grossMargin,
    };
  }, [carrierExecutionJobs, data.companyId, data.invoices, metrics.companyBids, reportFrom, reportTo]);

  const filteredJobs = useMemo(() => {
    const base = view === 'attention'
      ? metrics.attentionJobs
      : view === 'unallocated'
        ? metrics.unallocatedJobs
        : view === 'live'
          ? metrics.liveJobs
          : view === 'pod'
            ? metrics.evidenceReview
            : view === 'exceptions'
              ? metrics.exceptions
              : carrierExecutionJobs;

    const query = normalise(searchTerm);
    return base
      .filter((job) => !driverFilter || job.assigned_driver_id === driverFilter)
      .filter((job) => !vehicleFilter || job.vehicle_type === vehicleFilter)
      .filter((job) => {
        if (!query) return true;
        const driver = job.assigned_driver_id ? driverById.get(job.assigned_driver_id) : '';
        const haystack = [job.id, job.pickup_location, job.pickup_postcode, job.delivery_location, job.delivery_postcode, job.client_name, job.vehicle_type, driver, job.status, job.current_status].map(normalise).join(' ');
        return haystack.includes(query);
      })
      .sort((a, b) => {
        const priority = attentionScore(a) - attentionScore(b);
        if (priority !== 0) return priority;
        const aTime = a.pickup_datetime ? new Date(a.pickup_datetime).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.pickup_datetime ? new Date(b.pickup_datetime).getTime() : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      });
  }, [carrierExecutionJobs, driverById, driverFilter, metrics, searchTerm, vehicleFilter, view]);

  const viewCounts: Record<ControlView, ReactNode> = {
    attention: metricValue(data, ['jobs'], () => metrics.attentionJobs.length),
    unallocated: metricValue(data, ['jobs'], () => metrics.unallocatedJobs.length),
    live: metricValue(data, ['jobs'], () => metrics.liveJobs.length),
    pod: metricValue(data, ['jobs'], () => metrics.evidenceReview.length),
    exceptions: metricValue(data, ['jobs'], () => metrics.exceptions.length),
    all: metricValue(data, ['jobs'], () => carrierExecutionJobs.length),
  };

  const activeViewLabel = CONTROL_VIEWS.find((item) => item.value === view)?.label ?? 'Work';
  const jobFeedLabel = data.datasets.jobs.availability === 'unavailable'
    ? 'Job data unavailable'
    : data.datasets.jobs.partialData
      ? 'Job data partial'
      : `${filteredJobs.length} visible`;
  const jobEmptyTitle = data.datasets.jobs.availability === 'unavailable'
    ? 'Job data unavailable'
    : data.datasets.jobs.partialData
      ? 'Some job records are unavailable'
      : 'No assigned or awarded work matches this view';
  const jobEmptyDescription = data.datasets.jobs.availability === 'unavailable'
    ? 'Operational job records cannot be confirmed right now.'
    : data.datasets.jobs.partialData
      ? 'Some job records are unavailable, so this view may be incomplete. Open the full jobs register or refresh.'
      : 'Change the control view or clear the filters.';

  return (
    <div className="xdrive-admin-dashboard-home">
      {data.error ? <AlertBanner>{data.error}</AlertBanner> : null}

      <div className="carrier-cx-dashboard-grid">
        <div className="carrier-cx-dashboard-column carrier-cx-dashboard-column--left">
          <OperationalCard
            title="Reports & Statistics"
            subtitle="Commercial position and operational performance."
            className="carrier-cx-reporting-card"
            actions={<div className="carrier-cx-report-controls">
              <input aria-label="Report from date" type="date" value={reportFrom} max={reportTo} onChange={(event) => setReportFrom(event.target.value)} />
              <button type="button" onClick={() => { setReportFrom(todayKey); setReportTo(todayKey); }}>Today</button>
              <select aria-label="Select report date range" defaultValue="custom" onChange={(event) => {
                const value = event.target.value;
                const end = new Date();
                const start = new Date(end);
                if (value === 'month') start.setDate(1);
                if (value === '30') start.setDate(start.getDate() - 29);
                if (value === '90') start.setDate(start.getDate() - 89);
                setReportFrom(start.toISOString().slice(0, 10));
                setReportTo(end.toISOString().slice(0, 10));
              }}>
                <option value="custom">Select Dates</option>
                <option value="month">This month</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
            </div>}
            flush
          >
            <div className="carrier-cx-stat-grid">
              <button type="button" className="carrier-cx-stat-card" onClick={() => router.push('/admin/won-work')}>
                <span>Gross Margin</span>
                <strong>{metricValue(data, ['bids', 'jobs', 'invoices'], () => money(cxDashboard.grossMargin))}</strong>
                <small>Won work less recorded sub-contract spend</small>
              </button>
              <button type="button" className="carrier-cx-stat-card" onClick={() => router.push('/admin/invoices')}>
                <span>Sub-contract Spend</span>
                <strong>{metricValue(data, ['invoices'], () => money(cxDashboard.payableTotal))}</strong>
                <small>{cxDashboard.payables.length} supplier invoice{cxDashboard.payables.length === 1 ? '' : 's'}</small>
              </button>
            </div>
          </OperationalCard>

          <div className="carrier-cx-dashboard-subgrid">
            <OperationalCard title="Accounts Payable" flush>
              <CommercialRow label="Latest Invoices Received" detail="Supplier invoices visible to this company" value={metricValue(data, ['invoices'], () => cxDashboard.payables.length)} onClick={() => router.push('/admin/invoices')} />
              <CommercialRow label="Invoices due for Payment" detail="Recorded supplier invoices currently overdue" value={metricValue(data, ['invoices'], () => cxDashboard.overduePayables)} onClick={() => router.push('/admin/invoices')} />
              <CommercialRow label="Invoices Awaiting Payment" detail="Open supplier invoices not yet overdue" value={metricValue(data, ['invoices'], () => cxDashboard.awaitingPayables)} onClick={() => router.push('/admin/invoices')} />
              <CommercialRow label="Monthly Totals" detail="Supplier invoice total for the current month" value={metricValue(data, ['invoices'], () => money(cxDashboard.monthlyPayableTotal))} onClick={() => router.push('/admin/invoices')} />
            </OperationalCard>

            <OperationalCard title="Reports" flush>
              <CommercialRow label="Bookings Received" detail="Carrier-awarded bookings in this workspace" value={metricValue(data, ['jobs'], () => carrierExecutionJobs.length)} onClick={() => router.push('/admin/diary')} />
              <CommercialRow label="Bookings Sub-contracted" detail="Awarded work delegated to another company" value={metricValue(data, ['jobs'], () => cxDashboard.subcontracted)} onClick={() => router.push('/admin/diary')} />
              <CommercialRow label="Loads Allocated" detail="Carrier work with an allocated driver" value={metricValue(data, ['jobs'], () => cxDashboard.allocated)} onClick={() => router.push('/admin/fleet/assignments')} />
              <WorkflowLink label="Return Journeys" detail="Open the published and available return capacity register" onClick={() => router.push('/admin/fleet/returns')} />
            </OperationalCard>
          </div>

          <OperationalCard title="Feedback in Last 90 Days" className="carrier-cx-feedback-card" flush>
            <div className="carrier-cx-feedback-grid">
              <button type="button" onClick={() => router.push('/admin/diary')}><span>Received</span><strong>{feedbackSummary.count}</strong><small>{feedbackSummary.average == null ? 'No verified feedback yet' : `${feedbackSummary.average.toFixed(1)} / 5 average`}</small></button>
              <button type="button" onClick={() => router.push('/admin/invoices')}><span>Payment Performance</span><strong>{cxDashboard.paidPayables + cxDashboard.overduePayables > 0 ? `${Math.round((cxDashboard.paidPayables / (cxDashboard.paidPayables + cxDashboard.overduePayables)) * 100)}%` : '-'}</strong><small>Paid versus paid + overdue supplier invoices</small></button>
              <button type="button" onClick={() => router.push('/admin/diary')}><span>Delivery Performance</span><strong>{cxDashboard.completedJobs.length > 0 ? `${Math.round((cxDashboard.completedWithoutException / cxDashboard.completedJobs.length) * 100)}%` : '-'}</strong><small>Completed bookings without recorded exception</small></button>
            </div>
          </OperationalCard>

          <OperationalCard title="Compliance - Manage Your Suppliers" subtitle="Use verified XDrive member and fleet evidence rather than unverified badges." className="carrier-cx-compliance-card" flush>
            <div className="carrier-cx-compliance-grid">
              <button type="button" onClick={() => router.push('/admin/fleet/compliance')}><span>Compliance due</span><strong>{metricValue(data, ['driverDocuments', 'vehicleDocuments'], () => metrics.expiringDocuments)}</strong><small>Driver and vehicle evidence expiring within 30 days</small></button>
              <button type="button" onClick={() => router.push('/admin/marketplace/directory')}><span>Supplier network</span><strong>Directory</strong><small>Open verified member profiles, services and reputation</small></button>
            </div>
          </OperationalCard>
        </div>

        <div className="carrier-cx-dashboard-column carrier-cx-dashboard-column--right">
          <OperationalCard title="Activity at a glance" subtitle="Latest awarded bookings ordered for practical day-to-day transport control." className="carrier-cx-activity-card" flush>
            <div className="carrier-cx-booking-header"><strong>Latest Bookings</strong><button type="button" onClick={() => router.push('/admin/diary')}>View All...</button></div>
            <div className="carrier-cx-booking-list">
              {latestBookings.map((job) => {
                const completed = classifyWorkspaceJobStage(job) === 'completed';
                const evidenceReady = (job.delivery_photos?.length ?? 0) > 0;
                const needsAllocation = isUnallocatedJob(job);
                return (
                  <article key={job.id} className="carrier-cx-booking-card">
                    <div className="carrier-cx-booking-route">
                      <div><span>From:</span><strong>{job.pickup_location ?? job.pickup_postcode ?? 'Collection not supplied'}</strong></div>
                      <div><span>To:</span><strong>{job.delivery_location ?? job.delivery_postcode ?? 'Delivery not supplied'}</strong></div>
                    </div>
                    <div className="carrier-cx-booking-schedule">
                      <div><span>Pickup:</span><strong>{when(job.pickup_datetime)}</strong></div>
                      <div><span>Deliver:</span><strong>{when(job.delivery_datetime)}</strong></div>
                    </div>
                    <div className="carrier-cx-booking-meta">
                      <div><span>Veh:</span><strong>{(job.vehicle_type ?? 'Not specified').replace(/_/g, ' ')}</strong></div>
                      <div><span>Load ID:</span><strong>{job.id.slice(0, 8).toUpperCase()}</strong></div>
                      <StatusBadge value={workspaceJobOperationalLabel(job)} />
                    </div>
                    <div className="carrier-cx-booking-actions">
                      {completed ? <ActionButton tone="secondary" onClick={() => router.push(`/admin/jobs/${job.id}`)}>{evidenceReady ? 'POD' : 'Enter POD'}</ActionButton> : null}
                      {!completed ? <ActionButton tone="secondary" onClick={() => router.push(`/admin/jobs/${job.id}`)}>Track</ActionButton> : null}
                      <ActionButton tone={needsAllocation ? 'success' : 'secondary'} onClick={() => router.push(needsAllocation ? `/admin/fleet/assignments?job=${job.id}` : `/admin/jobs/${job.id}`)}>{needsAllocation ? 'Allocate' : 'Open booking'}</ActionButton>
                    </div>
                  </article>
                );
              })}
              {!latestBookings.length ? <EmptyState compact title="No recent carrier bookings" description="Awarded carrier work will appear here when available." /> : null}
            </div>
          </OperationalCard>
        </div>
      </div>

      <OperationalPageLayout
        className="carrier-dashboard-duplicate-workboard"
        style={{ padding: 0 }}
        searchPanel={
          <OperationalFilters
            title="Control filters"
            onSearch={() => setSearchTerm(searchDraft.trim())}
            onClear={() => { setSearchDraft(''); setSearchTerm(''); setView('attention'); setDriverFilter(''); setVehicleFilter(''); }}
            footer={
              <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: `1px solid ${workspaceTheme.border}` }}>
                <div style={{ marginBottom: '3px', color: workspaceTheme.navy, fontSize: '11px', lineHeight: '14px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Resource readiness</div>
                <RailMetric label="Available drivers" value={getWorkspaceDatasetMetricValue(data.datasets.drivers, (rows) => rows.filter(isActiveAvailableDriver).length)} onClick={() => router.push('/admin/live-availability')} />
                <RailMetric label="Busy drivers" value={getWorkspaceDatasetMetricValue(data.datasets.drivers, (rows) => rows.filter(isActiveBusyDriver).length)} onClick={() => router.push('/admin/live-availability')} />
                <RailMetric label="Unassigned vehicles" value={getWorkspaceDatasetMetricValue(data.datasets.vehicles, (rows) => rows.filter((vehicle) => !vehicle.assigned_driver_id).length)} onClick={() => router.push('/admin/fleet/vehicles')} />
                <RailMetric label="Document expiry alerts" value={metricValue(data, ['driverDocuments', 'vehicleDocuments'], () => metrics.expiringDocuments)} onClick={() => router.push('/admin/fleet/compliance')} />
              </div>
            }
          >
            <OperationalFilterField label="Find work" htmlFor="carrier-work-search"><OperationalFilterInput id="carrier-work-search" value={searchDraft} onChange={setSearchDraft} onClear={() => { setSearchDraft(''); setSearchTerm(''); }} placeholder="Ref, route, client" /></OperationalFilterField>
            <OperationalFilterField label="Work view" htmlFor="carrier-work-view"><OperationalFilterSelect id="carrier-work-view" value={view} onChange={(value) => setView(value as ControlView)} options={CONTROL_VIEWS} /></OperationalFilterField>
            <OperationalFilterField label="Driver" htmlFor="carrier-driver-filter"><OperationalFilterSelect id="carrier-driver-filter" value={driverFilter} onChange={setDriverFilter} options={[{ value: '', label: 'All drivers' }, ...data.drivers.map((driver) => ({ value: driver.id, label: driver.display_name ?? driver.email ?? 'Driver' }))]} /></OperationalFilterField>
            <OperationalFilterField label="Required vehicle" htmlFor="carrier-vehicle-filter"><OperationalFilterSelect id="carrier-vehicle-filter" value={vehicleFilter} onChange={setVehicleFilter} options={[{ value: '', label: 'All required vehicles' }, ...vehicleTypes.map((vehicle) => ({ value: vehicle, label: vehicle.replace(/_/g, ' ') }))]} /></OperationalFilterField>
          </OperationalFilters>
        }
      >
        <section aria-label="Carrier operational workboard" style={{ background: workspaceTheme.surface, border: `1px solid ${workspaceTheme.border}`, borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ minHeight: '40px', padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', borderBottom: `1px solid ${workspaceTheme.border}`, background: workspaceTheme.surfaceMuted, flexWrap: 'wrap' }}>
            <div><h2 style={{ margin: 0, color: workspaceTheme.navy, fontSize: '13px', lineHeight: '18px', fontWeight: 800 }}>Operational workboard</h2><p style={{ margin: '1px 0 0', color: workspaceTheme.muted, fontSize: '11px', lineHeight: '14px' }}>{activeViewLabel} · carrier-awarded work only</p></div>
            <div style={{ color: workspaceTheme.muted, fontSize: '11px', fontWeight: 650 }}>{jobFeedLabel}</div>
          </div>

          <div role="tablist" aria-label="Carrier work views" style={{ display: 'flex', alignItems: 'stretch', minHeight: '28px', overflowX: 'auto', borderBottom: `1px solid ${workspaceTheme.border}`, background: workspaceTheme.surface }}>
            {CONTROL_VIEWS.map((item) => {
              const selected = item.value === view;
              return <button key={item.value} type="button" role="tab" aria-selected={selected} onClick={() => setView(item.value)} style={{ height: '28px', padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: '6px', border: 0, borderBottom: `2px solid ${selected ? workspaceTheme.blue : 'transparent'}`, background: selected ? '#F1F6FF' : 'transparent', color: selected ? workspaceTheme.blue : workspaceTheme.muted, fontSize: '11px', fontWeight: selected ? 800 : 650, whiteSpace: 'nowrap', cursor: 'pointer' }}>{item.label}<span style={{ minWidth: '18px', height: '18px', padding: '0 4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '9px', background: selected ? workspaceTheme.blue : workspaceTheme.surfaceMuted, color: selected ? '#fff' : workspaceTheme.text, fontSize: '10px', fontWeight: 800 }}>{viewCounts[item.value]}</span></button>;
            })}
          </div>

          <div style={{ margin: '-1px' }}>
            <DataTable
              columns={['Ref', 'Priority', 'Route', 'Pickup', 'Required vehicle', 'Driver', 'Status', 'Action']}
              rows={filteredJobs.slice(0, 10).map((job) => {
                const priority = priorityStyle(job);
                const assignedDriver = job.assigned_driver_id ? driverById.get(job.assigned_driver_id) ?? 'Assigned' : 'Unassigned';
                const actionPath = isUnallocatedJob(job) ? `/admin/fleet/assignments?job=${job.id}` : `/admin/jobs/${job.id}`;
                return [
                  job.id.slice(0, 8).toUpperCase(),
                  <span key="priority" style={{ display: 'inline-flex', alignItems: 'center', height: '22px', padding: '0 6px', border: `1px solid ${priority.border}`, borderRadius: '4px', background: priority.background, color: priority.color, fontSize: '10px', fontWeight: 800 }}>{priorityLabel(job)}</span>,
                  <span key="route" style={{ display: 'block', minWidth: '220px' }}><strong style={{ display: 'block', fontSize: '12px', lineHeight: '16px' }}>{job.pickup_location ?? job.pickup_postcode ?? 'Collection'} → {job.delivery_location ?? job.delivery_postcode ?? 'Delivery'}</strong><span style={{ display: 'block', color: workspaceTheme.muted, fontSize: '11px', lineHeight: '14px' }}>{job.client_name ?? 'Customer not specified'}</span></span>,
                  when(job.pickup_datetime),
                  (job.vehicle_type ?? 'Not specified').replace(/_/g, ' '),
                  assignedDriver,
                  <StatusBadge key="status" value={workspaceJobOperationalLabel(job)} tone={jobStatus(job) === 'cancelled' ? 'grey' : isExceptionJob(job) ? 'red' : undefined} />,
                  <button key="action" type="button" onClick={() => router.push(actionPath)} style={{ height: '28px', padding: '0 9px', border: `1px solid ${isUnallocatedJob(job) ? workspaceTheme.green : workspaceTheme.border}`, borderRadius: '4px', background: isUnallocatedJob(job) ? workspaceTheme.green : '#fff', color: isUnallocatedJob(job) ? '#fff' : workspaceTheme.blue, fontSize: '11px', fontWeight: 750, cursor: 'pointer' }}>{isUnallocatedJob(job) ? 'Allocate' : 'Open'}</button>,
                ];
              })}
              empty={<EmptyState compact title={jobEmptyTitle} description={jobEmptyDescription} />}
            />
          </div>

          <div style={{ minHeight: '34px', padding: '0 9px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', borderTop: `1px solid ${workspaceTheme.border}`, background: workspaceTheme.surfaceMuted, color: workspaceTheme.muted, fontSize: '11px', flexWrap: 'wrap' }}><span>{data.datasets.jobs.partialData ? `Showing ${Math.min(filteredJobs.length, 10)} of currently available job data` : `Showing ${Math.min(filteredJobs.length, 10)} of ${filteredJobs.length} matching jobs`}</span><button type="button" onClick={() => router.push('/admin/jobs')} style={{ border: 0, background: 'transparent', color: workspaceTheme.blue, fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>Open full jobs register →</button></div>
        </section>

      </OperationalPageLayout>
    </div>
  );
}