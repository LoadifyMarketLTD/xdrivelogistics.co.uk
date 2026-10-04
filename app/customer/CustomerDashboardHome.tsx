'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { classifyWorkspaceJobStage, workspaceJobPresentationStatus } from '../../lib/jobs/workspaceJobStage';
import { supabase } from '../../lib/supabaseClient';
import {
  isCustomerVisibleWorkspaceInvoice,
  useCompanyWorkspaceData,
  type WorkspaceBid,
  type WorkspaceDatasetState,
  type WorkspaceJob,
} from '../components/workspace/useCompanyWorkspaceData';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  OperationalCard,
  PageFrame,
  PageHeader,
  StatusBadge,
} from '../components/workspace/WorkspaceUI';

type BuyerBookingOffer = {
  id: string;
  job_id: string;
  bid_id: string;
  buyer_company_id: string;
  carrier_company_id: string | null;
  bidder_driver_id: string | null;
  quoted_amount: number | null;
  currency: string | null;
  status: string;
  offered_at: string | null;
  responded_at: string | null;
  decline_reason: string | null;
};

const money = (value: number, currency = 'GBP') =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);

const when = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not set';

const vehicleLabel = (value: string | null | undefined) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) return 'Vehicle not supplied';
  return normalized.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

const routeLabel = (job: WorkspaceJob) => ({
  from: job.pickup_postcode ?? job.pickup_location ?? 'Collection',
  to: job.delivery_postcode ?? job.delivery_location ?? 'Delivery',
});

const metricState = <T,>(dataset: WorkspaceDatasetState<T>, value: number) => {
  if (dataset.availability !== 'available') return '—';
  if (dataset.partialData || dataset.limitedData) return 'Partial';
  return value;
};

const customerLifecycleLabel = (job: WorkspaceJob) => {
  const status = workspaceJobPresentationStatus(job);
  switch (status) {
    case 'awarded': return 'Carrier awarded';
    case 'allocated': return 'Driver assigned';
    case 'accepted': return 'Driver accepted';
    case 'on_my_way': return 'Driver en route to collection';
    case 'on_site_pickup': return 'Driver at collection';
    case 'loaded': return 'Goods collected';
    case 'in_transit': return 'In transit';
    case 'on_site_delivery': return 'Driver at delivery';
    case 'delivered': return 'Delivered';
    case 'completed': return 'Completed';
    case 'invoiced': return 'Invoice available';
    case 'paid': return 'Paid';
    case 'posted': return 'Open for quotes';
    case 'quoted': return 'Quotes received';
    case 'draft': return 'Draft';
    case 'cancelled': return 'Cancelled';
    default: return status.replaceAll('_', ' ');
  }
};

const customerJobPriority = (job: WorkspaceJob, pendingOffer: BuyerBookingOffer | undefined) => {
  if (pendingOffer) return 0;
  const stage = classifyWorkspaceJobStage(job);
  if (stage === 'in_progress') return 1;
  if (stage === 'allocated') return 2;
  if (stage === 'awarded') return 3;
  if (stage === 'open') return 4;
  if (stage === 'completed') return 5;
  return 6;
};

const jobTone = (job: WorkspaceJob, pendingOffer: BuyerBookingOffer | undefined) => {
  if (pendingOffer) return 'orange' as const;
  const stage = classifyWorkspaceJobStage(job);
  if (stage === 'completed') return 'green' as const;
  if (stage === 'in_progress') return 'blue' as const;
  if (String(job.status).toLowerCase() === 'cancelled') return 'grey' as const;
  return 'blue' as const;
};

export default function CustomerDashboardHome() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const [bookingOffers, setBookingOffers] = useState<BuyerBookingOffer[]>([]);
  const [bookingOfferError, setBookingOfferError] = useState('');
  const [memberFilter, setMemberFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [referenceFilter, setReferenceFilter] = useState('');

  const loadBookingOffers = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) {
      setBookingOffers([]);
      setBookingOfferError('Carrier acceptance state is unavailable until the session is refreshed.');
      return;
    }
    const response = await fetch('/api/customer/booking-offers', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({})) as { offers?: BuyerBookingOffer[]; error?: string };
    if (!response.ok) {
      setBookingOffers([]);
      setBookingOfferError(payload.error ?? 'Carrier acceptance state could not be loaded.');
      return;
    }
    setBookingOffers(payload.offers ?? []);
    setBookingOfferError('');
  }, []);

  useEffect(() => { void loadBookingOffers(); }, [loadBookingOffers, data.jobs, data.bids]);

  const pendingOfferByJob = useMemo(
    () => new Map(bookingOffers.filter((offer) => offer.status === 'pending').map((offer) => [offer.job_id, offer])),
    [bookingOffers],
  );

  const bidById = useMemo(() => new Map(data.bids.map((bid) => [bid.id, bid])), [data.bids]);
  const acceptedBidByJob = useMemo(() => {
    const map = new Map<string, WorkspaceBid>();
    for (const bid of data.bids) {
      if (bid.status === 'accepted' && !map.has(bid.job_id)) map.set(bid.job_id, bid);
    }
    return map;
  }, [data.bids]);

  const carrierLabelForJob = useCallback((job: WorkspaceJob) => {
    const pending = pendingOfferByJob.get(job.id);
    const bid = pending ? bidById.get(pending.bid_id) : acceptedBidByJob.get(job.id);
    return bid?.companies?.name ?? (pending ? 'Carrier awaiting acceptance' : job.awarded_carrier_company_id ? 'Awarded carrier' : 'No carrier assigned');
  }, [acceptedBidByJob, bidById, pendingOfferByJob]);

  const metrics = useMemo(() => {
    const openLoads = data.jobs.filter(
      (job) => classifyWorkspaceJobStage(job) === 'open' && String(job.status).toLowerCase() !== 'draft',
    );
    const pendingAcceptance = bookingOffers.filter((offer) => offer.status === 'pending');
    const submittedQuotes = data.bids.filter(
      (bid) => bid.status === 'submitted' && !pendingOfferByJob.has(bid.job_id),
    );
    const activeDeliveries = data.jobs.filter((job) => classifyWorkspaceJobStage(job) === 'in_progress');
    const customerInvoices = data.invoices.filter((invoice) =>
      isCustomerVisibleWorkspaceInvoice(invoice, data.companyId),
    );
    const unpaidInvoices = customerInvoices.filter(
      (invoice) => invoice.payment_status !== 'paid' && !['paid', 'Paid'].includes(invoice.status),
    );
    const delayed = activeDeliveries.filter((job) => {
      if (!job.delivery_datetime) return false;
      return new Date(job.delivery_datetime).getTime() < Date.now();
    });
    const completedWithPod = data.jobs.filter(
      (job) => classifyWorkspaceJobStage(job) === 'completed' && job.pod_generated === true,
    );
    const documentAlertJobs = data.jobs.filter((job) => {
      const stage = classifyWorkspaceJobStage(job);
      const podMissing = stage === 'completed' && job.pod_generated !== true;
      const deliveryEvidenceMissing = stage === 'completed' && job.has_delivery_evidence === false;
      const podRejected = String(job.broker_pod_review_status ?? '').trim().toLowerCase() === 'rejected';
      return podMissing || deliveryEvidenceMissing || podRejected;
    });

    const recentJobs = [...data.jobs]
      .sort((a, b) => {
        const priority = customerJobPriority(a, pendingOfferByJob.get(a.id)) - customerJobPriority(b, pendingOfferByJob.get(b.id));
        if (priority !== 0) return priority;
        return String(b.updated_at ?? b.created_at ?? '').localeCompare(String(a.updated_at ?? a.created_at ?? ''));
      });

    return {
      openLoads,
      pendingAcceptance,
      submittedQuotes,
      activeDeliveries,
      unpaidInvoices,
      delayed,
      completedWithPod,
      documentAlertJobs,
      recentJobs,
      unpaidValue: unpaidInvoices.reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0),
    };
  }, [bookingOffers, data, pendingOfferByJob]);

  const latestTransport = useMemo(() => {
    const memberNeedle = memberFilter.trim().toLowerCase();
    const locationNeedle = locationFilter.trim().toLowerCase();
    const referenceNeedle = referenceFilter.trim().toLowerCase();
    return metrics.recentJobs.filter((job) => {
      const carrier = carrierLabelForJob(job).toLowerCase();
      const memberHaystack = `${carrier} ${job.client_name ?? ''}`.toLowerCase();
      const locationHaystack = `${job.pickup_location ?? ''} ${job.pickup_postcode ?? ''} ${job.delivery_location ?? ''} ${job.delivery_postcode ?? ''}`.toLowerCase();
      const referenceHaystack = `${job.id} XDL-${job.id.slice(0, 8)} ${job.booking_reference ?? ''} ${job.customer_reference ?? ''}`.toLowerCase();
      return (!memberNeedle || memberHaystack.includes(memberNeedle))
        && (!locationNeedle || locationHaystack.includes(locationNeedle))
        && (!referenceNeedle || referenceHaystack.includes(referenceNeedle));
    }).slice(0, 10);
  }, [carrierLabelForJob, locationFilter, memberFilter, metrics.recentJobs, referenceFilter]);

  const jobsDataset = data.datasets.jobs;
  const bidsDataset = data.datasets.bids;
  const invoicesDataset = data.datasets.invoices;
  const attentionUnavailable = [jobsDataset, bidsDataset, invoicesDataset].some(
    (dataset) => dataset.availability !== 'available',
  );
  const attentionPartial = !attentionUnavailable && [jobsDataset, bidsDataset, invoicesDataset].some(
    (dataset) => dataset.partialData || dataset.limitedData,
  );

  const attentionItems = [
    {
      label: 'Awaiting carrier acceptance',
      detail: 'A booking offer has been sent and the carrier still needs to accept or decline.',
      count: metrics.pendingAcceptance.length,
      route: '/customer/quotes?status=pending_acceptance',
      tone: 'orange' as const,
      show: metrics.pendingAcceptance.length > 0,
    },
    {
      label: 'Quotes to review',
      detail: 'Compare carrier offers and decide who should receive the booking offer.',
      count: metricState(bidsDataset, metrics.submittedQuotes.length),
      route: '/customer/quotes',
      tone: 'blue' as const,
      show: metrics.submittedQuotes.length > 0,
    },
    {
      label: 'Delivery exceptions',
      detail: 'Check deliveries that are past their recorded delivery time.',
      count: metricState(jobsDataset, metrics.delayed.length),
      route: '/customer/tracking',
      tone: 'red' as const,
      show: metrics.delayed.length > 0,
    },
    {
      label: 'POD / document alerts',
      detail: 'Review completed work with missing or rejected POD and delivery evidence.',
      count: metricState(jobsDataset, metrics.documentAlertJobs.length),
      route: '/customer/documents',
      tone: 'orange' as const,
      show: metrics.documentAlertJobs.length > 0,
    },
    {
      label: 'Outstanding invoices',
      detail: 'Review invoices that still need payment or reconciliation.',
      count: invoicesDataset.availability !== 'available'
        ? '—'
        : invoicesDataset.partialData || invoicesDataset.limitedData
          ? 'Partial'
          : money(metrics.unpaidValue),
      route: '/customer/invoices',
      tone: 'blue' as const,
      show: metrics.unpaidInvoices.length > 0,
    },
  ].filter((item) => item.show);

  const openJob = (job: WorkspaceJob) => {
    const pendingOffer = pendingOfferByJob.get(job.id);
    if (pendingOffer) {
      router.push('/customer/quotes?status=pending_acceptance');
      return;
    }
    const stage = classifyWorkspaceJobStage(job);
    if (stage === 'in_progress') {
      router.push(`/customer/tracking?job=${job.id}`);
      return;
    }
    if (stage === 'allocated' || stage === 'awarded') {
      router.push(`/customer/bookings?job=${job.id}`);
      return;
    }
    if (stage === 'completed') {
      router.push(`/customer/bookings?job=${job.id}`);
      return;
    }
    if (data.bids.some((bid) => bid.job_id === job.id && bid.status === 'submitted')) {
      router.push('/customer/quotes');
      return;
    }
    router.push(`/customer/jobs/${job.id}`);
  };

  return (
    <PageFrame>
      <div className="customer-operational-page customer-dashboard-owner-parity">
        <PageHeader
          eyebrow="Customer workspace"
          title="Transport overview"
          description="The same operational control pattern used across XDrive: reports and exceptions on the left, live transport activity on the right."
          actions={<ActionButton tone="secondary" onClick={() => void Promise.all([data.refresh(), loadBookingOffers()])}>Refresh</ActionButton>}
        />

        {data.error ? <AlertBanner tone="danger">{data.error}</AlertBanner> : null}
        {bookingOfferError ? <AlertBanner tone="warning">{bookingOfferError}</AlertBanner> : null}
        {invoicesDataset.availability !== 'available' ? (
          <AlertBanner tone="warning">Invoice data unavailable. Financial totals are hidden until the data source is available.</AlertBanner>
        ) : invoicesDataset.partialData || invoicesDataset.limitedData ? (
          <AlertBanner tone="warning">Invoice data is partial. Exact financial totals are hidden until the complete dataset is available.</AlertBanner>
        ) : null}

        <div className="customer-owner-parity-grid">
          <div className="customer-owner-parity-column">
            <OperationalCard title="Reports & Statistics" subtitle="Live customer transport and commercial position.">
              <div className="customer-owner-stat-grid">
                <button type="button" onClick={() => router.push('/customer/loads')} className="customer-owner-stat-card">
                  <span>Open Loads</span>
                  <strong>{metricState(jobsDataset, metrics.openLoads.length)}</strong>
                  <small>Published loads still open for carrier activity.</small>
                </button>
                <button type="button" onClick={() => router.push('/customer/quotes')} className="customer-owner-stat-card">
                  <span>Quotes to Review</span>
                  <strong>{metricState(bidsDataset, metrics.submittedQuotes.length)}</strong>
                  <small>Carrier quotes still awaiting your decision.</small>
                </button>
                <button type="button" onClick={() => router.push('/customer/quotes?status=pending_acceptance')} className="customer-owner-stat-card" data-tone="orange">
                  <span>Awaiting Carrier</span>
                  <strong>{metrics.pendingAcceptance.length}</strong>
                  <small>Booking offers sent but not yet accepted.</small>
                </button>
                <button type="button" onClick={() => router.push('/customer/tracking')} className="customer-owner-stat-card" data-tone="green">
                  <span>Active Deliveries</span>
                  <strong>{metricState(jobsDataset, metrics.activeDeliveries.length)}</strong>
                  <small>Transport currently in the live execution lifecycle.</small>
                </button>
              </div>
            </OperationalCard>

            <div className="customer-owner-parity-subgrid">
              <OperationalCard title="Commercial & Documents" subtitle="Customer-side closeout and finance controls.">
                {[
                  ['Outstanding invoices', invoicesDataset.availability !== 'available' ? 'Unavailable' : `${metrics.unpaidInvoices.length} · ${money(metrics.unpaidValue)}`, '/customer/invoices'],
                  ['POD / document alerts', `${metrics.documentAlertJobs.length} requiring review`, '/customer/documents'],
                  ['Delivery exceptions', `${metrics.delayed.length} late / overdue`, '/customer/tracking'],
                  ['Completed with POD', `${metrics.completedWithPod.length} complete`, '/customer/documents'],
                ].map(([label, detail, href]) => (
                  <button key={label} type="button" onClick={() => router.push(href)} className="customer-owner-report-row">
                    <span><strong>{label}</strong><small>{detail}</small></span><span aria-hidden="true">→</span>
                  </button>
                ))}
              </OperationalCard>

              <OperationalCard title="Reports" subtitle="Direct routes to the operational registers behind this dashboard.">
                {[
                  ['All loads', `${data.jobs.length} recorded`, '/customer/loads'],
                  ['Bookings', `${data.jobs.filter((job) => ['awarded', 'allocated', 'in_progress', 'completed'].includes(classifyWorkspaceJobStage(job))).length} booking(s)`, '/customer/bookings'],
                  ['Diary', 'Open transport diary', '/customer/diary'],
                  ['Event log', 'Audit customer activity', '/customer/event-log'],
                ].map(([label, detail, href]) => (
                  <button key={label} type="button" onClick={() => router.push(href)} className="customer-owner-report-row">
                    <span><strong>{label}</strong><small>{detail}</small></span><span aria-hidden="true">→</span>
                  </button>
                ))}
              </OperationalCard>
            </div>

            <OperationalCard title="Needs your attention" subtitle="Only actions that require a customer decision or review.">
              {attentionItems.length ? (
                <div className="customer-attention-list">
                  {attentionItems.map((item) => (
                    <button key={item.label} className="customer-attention-row" data-tone={item.tone} type="button" onClick={() => router.push(item.route)}>
                      <span className="customer-attention-row__copy"><strong>{item.label}</strong><span>{item.detail}</span></span>
                      <span className="customer-attention-row__count">{item.count}</span>
                    </button>
                  ))}
                </div>
              ) : attentionUnavailable ? (
                <EmptyState compact title="Attention data unavailable" description="The dashboard cannot confirm that there are no customer actions until loads, quotes and invoices are available." />
              ) : attentionPartial ? (
                <EmptyState compact title="Attention data is partial" description="The visible records are incomplete, so the dashboard does not claim that there are no customer actions." />
              ) : (
                <EmptyState compact title="Nothing needs attention" description="There are no urgent customer actions right now." />
              )}
            </OperationalCard>
          </div>

          <div className="customer-owner-parity-column">
            <OperationalCard
              title="Activity at a glance"
              subtitle="Latest customer transport, using the same dense operational pattern as Owner Driver."
              actions={<ActionButton tone="secondary" onClick={() => router.push('/customer/loads')}>View all…</ActionButton>}
              flush
            >
              <div className="customer-activity-filters">
                <input aria-label="Carrier / member" placeholder="Carrier / Member" value={memberFilter} onChange={(event) => setMemberFilter(event.target.value)} />
                <input aria-label="Location" placeholder="Location" value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} />
                <input aria-label="Load ID / Ref" placeholder="Load ID / Ref" value={referenceFilter} onChange={(event) => setReferenceFilter(event.target.value)} />
                <ActionButton tone="secondary" onClick={() => { setMemberFilter(''); setLocationFilter(''); setReferenceFilter(''); }}>Clear</ActionButton>
              </div>
              <div className="customer-activity-list">
                {latestTransport.length === 0 ? (
                  jobsDataset.availability !== 'available'
                    ? <EmptyState compact title="Transport data unavailable" />
                    : <EmptyState compact title="No transport matches these filters" />
                ) : latestTransport.map((job) => {
                  const route = routeLabel(job);
                  const pendingOffer = pendingOfferByJob.get(job.id);
                  const lifecycleLabel = pendingOffer ? 'Awaiting Carrier Acceptance' : customerLifecycleLabel(job);
                  const carrierLabel = carrierLabelForJob(job);
                  const stage = classifyWorkspaceJobStage(job);
                  const primaryLabel = pendingOffer
                    ? 'Await Carrier'
                    : stage === 'in_progress'
                      ? 'Track'
                      : stage === 'completed'
                        ? 'POD'
                        : stage === 'allocated' || stage === 'awarded'
                          ? 'View booking'
                          : data.bids.some((bid) => bid.job_id === job.id && bid.status === 'submitted')
                            ? 'Review quotes'
                            : 'Open';
                  return (
                    <article key={job.id} className="customer-activity-card" data-tone={jobTone(job, pendingOffer)}>
                      <div className="customer-activity-card__main">
                        <div className="customer-activity-route">
                          <div><span>From:</span><strong>{job.pickup_location ?? route.from}</strong></div>
                          <div><span>To:</span><strong>{job.delivery_location ?? route.to}</strong></div>
                          <div><span>Veh:</span><strong>{vehicleLabel(job.vehicle_type)}</strong></div>
                        </div>
                        <div className="customer-activity-times">
                          <div><span>Pickup: </span><strong>{when(job.pickup_datetime)}</strong></div>
                          <div><span>Deliver: </span><strong>{when(job.delivery_datetime)}</strong></div>
                        </div>
                        <div className="customer-activity-status">
                          <StatusBadge value={lifecycleLabel} tone={jobTone(job, pendingOffer)} />
                          <div>{carrierLabel}</div>
                          <div>Load ID: <strong>XDL-{job.id.slice(0, 8).toUpperCase()}</strong></div>
                          {job.booking_reference || job.customer_reference ? <div>Ref: {job.booking_reference ?? job.customer_reference}</div> : null}
                        </div>
                      </div>
                      <div className="customer-activity-card__actions">
                        <ActionButton tone={pendingOffer ? 'secondary' : stage === 'in_progress' ? 'primary' : 'secondary'} onClick={() => openJob(job)}>{primaryLabel}</ActionButton>
                        {(stage === 'in_progress' || stage === 'allocated' || stage === 'awarded') && !pendingOffer ? <ActionButton tone="secondary" onClick={() => router.push(`/customer/tracking?job=${job.id}`)}>Track</ActionButton> : null}
                        <ActionButton tone="secondary" onClick={() => router.push(`/customer/messages?jobId=${encodeURIComponent(job.id)}`)}>Message</ActionButton>
                      </div>
                    </article>
                  );
                })}
              </div>
            </OperationalCard>
          </div>
        </div>

        <button type="button" className="customer-freight-messenger" onClick={() => router.push('/customer/messages')}>Freight Messenger</button>
      </div>
    </PageFrame>
  );
}
