'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';

import { classifyWorkspaceJobStage, workspaceJobPresentationStatus } from '../../lib/jobs/workspaceJobStage';
import {
  isCustomerVisibleWorkspaceInvoice,
  useCompanyWorkspaceData,
  type WorkspaceDatasetState,
} from '../components/workspace/useCompanyWorkspaceData';
import { MemberIdentityLink } from '../components/workspace/MemberProfile';
import { useBidderIdentities } from '../components/workspace/useBidderIdentities';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  PageFrame,
  PageHeader,
  StatusBadge,
} from '../components/workspace/WorkspaceUI';
import { OperationalSignalStrip } from '../components/workspace/OperationalConvergence';

const money = (value: number, currency = 'GBP') =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);

const when = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not set';

const routeLabel = (job: {
  pickup_postcode?: string | null;
  pickup_location?: string | null;
  delivery_postcode?: string | null;
  delivery_location?: string | null;
}) => ({
  from: job.pickup_postcode ?? job.pickup_location ?? 'Collection',
  to: job.delivery_postcode ?? job.delivery_location ?? 'Delivery',
});

const loadReference = (job: { id: string; client_name?: string | null }) =>
  job.client_name?.trim() || `Load ${job.id.slice(0, 8).toUpperCase()}`;

const metricState = <T,>(dataset: WorkspaceDatasetState<T>, value: number) => {
  if (dataset.availability !== 'available') return '—';
  if (dataset.partialData || dataset.limitedData) return 'Partial';
  return value;
};

const combinedMetricState = (
  datasets: Array<{ availability: string; partialData: boolean; limitedData: boolean }>,
  value: number,
) => {
  if (datasets.some((dataset) => dataset.availability !== 'available')) return '—';
  if (datasets.some((dataset) => dataset.partialData || dataset.limitedData)) return 'Partial';
  return value;
};

export default function CustomerDashboardHome() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const bidderIdentity = useBidderIdentities(data.bids);

  const metrics = useMemo(() => {
    const now = Date.now();
    const quoteHistory = data.bids.filter((bid) => ['submitted', 'accepted', 'rejected'].includes(bid.status));
    const submittedQuotes = quoteHistory.filter((bid) => bid.status === 'submitted');
    const awaitingAward = data.jobs.filter((job) =>
      classifyWorkspaceJobStage(job) === 'open'
      && submittedQuotes.some((bid) => bid.job_id === job.id)
    );
    const activeDeliveries = data.jobs.filter((job) => classifyWorkspaceJobStage(job) === 'in_progress');
    const delayed = activeDeliveries.filter((job) =>
      Boolean(job.delivery_datetime)
      && new Date(job.delivery_datetime as string).getTime() < now
    );
    const deliveryPhotoJobs = data.jobs.filter((job) => (job.delivery_photos?.length ?? 0) > 0);
    const customerInvoices = data.invoices.filter((invoice) =>
      isCustomerVisibleWorkspaceInvoice(invoice, data.companyId),
    );
    const unpaidInvoices = customerInvoices.filter((invoice) =>
      invoice.payment_status !== 'paid' && !['paid', 'Paid'].includes(invoice.status)
    );
    const dueSoonInvoices = unpaidInvoices.filter((invoice) => {
      if (!invoice.due_date) return false;
      const dueAt = new Date(invoice.due_date).getTime();
      return Number.isFinite(dueAt) && dueAt >= now && dueAt <= now + 7 * 86_400_000;
    });
    const openLoads = data.jobs.filter((job) => classifyWorkspaceJobStage(job) === 'open' && String(job.status).toLowerCase() !== 'draft');
    const draftLoads = data.jobs.filter((job) => String(job.status).toLowerCase() === 'draft');
    const awardedLoads = data.jobs.filter((job) => classifyWorkspaceJobStage(job) === 'awarded');
    const allocatedLoads = data.jobs.filter((job) => classifyWorkspaceJobStage(job) === 'allocated');
    const recentQuotes = [...quoteHistory]
      .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
      .slice(0, 8);

    return {
      quoteHistory,
      submittedQuotes,
      awaitingAward,
      activeDeliveries,
      delayed,
      deliveryPhotoJobs,
      customerInvoices,
      unpaidInvoices,
      dueSoonInvoices,
      openLoads,
      draftLoads,
      awardedLoads,
      allocatedLoads,
      recentQuotes,
      unpaidValue: unpaidInvoices.reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0),
    };
  }, [data]);

  const jobById = useMemo(() => new Map(data.jobs.map((job) => [job.id, job])), [data.jobs]);

  const bestQuoteForJob = (jobId: string) => {
    const prices = data.bids
      .filter((bid) => bid.job_id === jobId && bid.status === 'submitted')
      .map((bid) => Number(bid.bid_price_gbp ?? bid.amount ?? 0))
      .filter((price) => price > 0);
    return prices.length ? Math.min(...prices) : null;
  };

  const submittedQuotesForJob = (jobId: string) =>
    data.bids.filter((bid) => bid.job_id === jobId && bid.status === 'submitted').length;

  const actionLoads = metrics.awaitingAward.length ? metrics.awaitingAward : metrics.openLoads.slice(0, 8);
  const invoiceDataset = data.datasets.invoices;
  const invoiceDataState = invoiceDataset.availability !== 'available'
    ? 'Unavailable'
    : invoiceDataset.partialData || invoiceDataset.limitedData
      ? 'Partial'
      : null;
  const invoiceCount = (value: number) => invoiceDataState ?? String(value);
  const invoiceAmount = (value: number) => invoiceDataState ?? money(value);
  const jobsDataset = data.datasets.jobs;
  const bidsDataset = data.datasets.bids;
  const awaitingAwardMetric = combinedMetricState([jobsDataset, bidsDataset], metrics.awaitingAward.length);

  return (
    <PageFrame>
      <div className="customer-operational-page">
        <PageHeader
          eyebrow="Customer workspace"
          title="Transport Control"
          description="Post transport, compare carrier quotes, award work, monitor live bookings and collect POD and invoices from one operational screen."
          actions={<><ActionButton tone="warning" onClick={() => router.push('/customer/post-load')}>+ Post Load</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/customer/tracking')}>Tracking</ActionButton></>}
        />

        {data.error ? <AlertBanner tone="danger">{data.error}</AlertBanner> : null}
        {bidderIdentity.error ? <AlertBanner tone="warning">{bidderIdentity.error}</AlertBanner> : null}
        {invoiceDataset.availability !== 'available' ? <AlertBanner tone="warning">Invoice data unavailable. Financial totals are not shown as zero.</AlertBanner> : null}
        {invoiceDataset.availability === 'available' && (invoiceDataset.partialData || invoiceDataset.limitedData) ? <AlertBanner tone="warning">Invoice data is partial. Financial totals are marked Partial rather than presented as complete.</AlertBanner> : null}

        <div className="customer-exchange-dashboard">
          <aside className="customer-exchange-left">
            <section className="customer-dash-box">
              <div className="customer-dash-box__head"><strong>Action Centre</strong><span>Needs attention</span></div>
              <div className="customer-dash-box__body"><div className="customer-attention-list">
                <button className="customer-attention-row" data-tone="orange" type="button" onClick={() => router.push('/customer/quotes')}><span className="customer-attention-row__copy"><strong>Quotes awaiting decision</strong><span>Compare carrier price and member profile</span></span><span className="customer-attention-row__count">{awaitingAwardMetric}</span></button>
                <button className="customer-attention-row" data-tone="red" type="button" onClick={() => router.push('/customer/tracking')}><span className="customer-attention-row__copy"><strong>Delivery exceptions</strong><span>Past recorded delivery time</span></span><span className="customer-attention-row__count">{metricState(jobsDataset, metrics.delayed.length)}</span></button>
                <button className="customer-attention-row" data-tone="green" type="button" onClick={() => router.push('/customer/bookings')}><span className="customer-attention-row__copy"><strong>Delivery photo evidence</strong><span>Photos available for review; open the booking for full POD state</span></span><span className="customer-attention-row__count">{metricState(jobsDataset, metrics.deliveryPhotoJobs.length)}</span></button>
                <button className="customer-attention-row" type="button" onClick={() => router.push('/customer/bookings')}><span className="customer-attention-row__copy"><strong>Document alerts</strong><span>Open Bookings for job documents and POD evidence</span></span><span className="customer-attention-row__count">—</span></button>
                <button className="customer-attention-row" type="button" onClick={() => router.push('/customer/invoices')}><span className="customer-attention-row__copy"><strong>Invoices due soon</strong><span>Due within the next 7 days</span></span><span className="customer-attention-row__count">{invoiceCount(metrics.dueSoonInvoices.length)}</span></button>
              </div></div>
            </section>

            <section className="customer-dash-box"><div className="customer-dash-box__head"><strong>Create & manage transport</strong></div><div className="customer-dash-box__body"><div className="customer-action-grid"><ActionButton tone="warning" onClick={() => router.push('/customer/post-load')}>Post Load</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/customer/loads')}>Loads</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/customer/quotes')}>Compare Quotes</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/customer/bookings')}>Bookings</ActionButton></div></div></section>

            <section className="customer-dash-box"><div className="customer-dash-box__head"><strong>Commercial & documents</strong></div><div className="customer-dash-box__body"><div className="customer-dash-summary"><div className="customer-dash-summary__row"><span>Draft loads</span><strong>{metricState(jobsDataset, metrics.draftLoads.length)}</strong></div><div className="customer-dash-summary__row"><span>Awarded to carrier</span><strong>{metricState(jobsDataset, metrics.awardedLoads.length)}</strong></div><div className="customer-dash-summary__row"><span>Driver + vehicle allocated</span><strong>{metricState(jobsDataset, metrics.allocatedLoads.length)}</strong></div><div className="customer-dash-summary__row"><span>Outstanding invoices</span><strong>{invoiceCount(metrics.unpaidInvoices.length)}</strong></div><div className="customer-dash-summary__row"><span>Outstanding value</span><strong>{invoiceAmount(metrics.unpaidValue)}</strong></div></div><div className="customer-action-grid" style={{ marginTop: '8px' }}><ActionButton tone="secondary" onClick={() => router.push('/customer/bookings')}>POD / Order</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/customer/invoices')}>Invoices</ActionButton></div></div></section>

            <section className="customer-dash-box"><div className="customer-dash-box__head"><strong>Workspace shortcuts</strong></div><div className="customer-dash-box__body"><div className="customer-action-grid"><ActionButton tone="secondary" onClick={() => router.push('/customer/diary')}>Diary</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/customer/network')}>Companies</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/customer/account')}>Account</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/customer/tracking')}>Tracking</ActionButton></div></div></section>
          </aside>

          <main className="customer-exchange-main">
            <section className="customer-dash-box">
              <div className="customer-dash-box__head"><strong>{metrics.awaitingAward.length ? 'Loads requiring a decision' : 'Open transport requests'}</strong><ActionButton tone="secondary" onClick={() => router.push(metrics.awaitingAward.length ? '/customer/quotes' : '/customer/loads')}>View all</ActionButton></div>
              {actionLoads.length === 0 ? <div className="customer-empty"><EmptyState compact title="No open decisions" description="Post a load to request transport or review your existing bookings." /></div> : <div className="customer-dash-table-wrap"><table className="customer-dash-table"><thead><tr><th style={{ width: '34%' }}>Route</th><th style={{ width: '18%' }}>Pickup</th><th style={{ width: '10%' }}>Quotes</th><th style={{ width: '13%' }}>Best price</th><th style={{ width: '12%' }}>Status</th><th style={{ width: '13%' }}>Action</th></tr></thead><tbody>{actionLoads.slice(0, 8).map((job) => { const route = routeLabel(job); const bestQuote = bestQuoteForJob(job.id); const submittedCount = submittedQuotesForJob(job.id); return <tr key={job.id}><td><div className="customer-dash-table__route"><strong>{route.from} → {route.to}</strong><span>{loadReference(job)}</span></div></td><td>{when(job.pickup_datetime)}</td><td><strong>{submittedCount}</strong></td><td>{bestQuote ? <strong>{money(bestQuote)}</strong> : '—'}</td><td><StatusBadge value={workspaceJobPresentationStatus(job)} /></td><td><div className="customer-dash-table__actions"><ActionButton tone={submittedCount ? 'success' : 'secondary'} onClick={() => router.push(submittedCount ? '/customer/quotes' : `/customer/jobs/${job.id}`)}>{submittedCount ? 'Compare' : 'Open'}</ActionButton></div></td></tr>; })}</tbody></table></div>}
            </section>

            <section className="customer-dash-box">
              <div className="customer-dash-box__head"><strong>Active deliveries</strong><ActionButton tone="secondary" onClick={() => router.push('/customer/tracking')}>Tracking board</ActionButton></div>
              {metrics.activeDeliveries.length === 0 ? <div className="customer-empty"><EmptyState compact title="No active shipments" description="Execution appears here after the carrier begins the operational journey." /></div> : <div className="customer-dash-table-wrap"><table className="customer-dash-table"><thead><tr><th style={{ width: '36%' }}>Route</th><th style={{ width: '19%' }}>Pickup</th><th style={{ width: '19%' }}>Delivery</th><th style={{ width: '13%' }}>Status</th><th style={{ width: '13%' }}>Track</th></tr></thead><tbody>{metrics.activeDeliveries.slice(0, 8).map((job) => { const route = routeLabel(job); return <tr key={job.id}><td><div className="customer-dash-table__route"><strong>{route.from} → {route.to}</strong><span>{loadReference(job)}</span></div></td><td>{when(job.pickup_datetime)}</td><td>{when(job.delivery_datetime)}</td><td><StatusBadge value={workspaceJobPresentationStatus(job)} tone={metrics.delayed.includes(job) ? 'red' : undefined} /></td><td><div className="customer-dash-table__actions"><ActionButton tone="secondary" onClick={() => router.push(`/customer/jobs/${job.id}`)}>Track</ActionButton></div></td></tr>; })}</tbody></table></div>}
            </section>

            <section className="customer-dash-box">
              <div className="customer-dash-box__head"><strong>Recent quote activity</strong><ActionButton tone="secondary" onClick={() => router.push('/customer/quotes')}>All quotes</ActionButton></div>
              {metrics.recentQuotes.length === 0 ? <div className="customer-empty"><EmptyState compact title="No quote activity yet" description="Carrier responses will appear here after a load is published." /></div> : <div className="customer-dash-table-wrap"><table className="customer-dash-table"><thead><tr><th style={{ width: '30%' }}>Carrier</th><th style={{ width: '28%' }}>Load / route</th><th style={{ width: '14%' }}>Price</th><th style={{ width: '14%' }}>Status</th><th style={{ width: '14%' }}>Received</th></tr></thead><tbody>{metrics.recentQuotes.map((bid) => { const job = jobById.get(bid.job_id); const route = job ? routeLabel(job) : null; const identity = bidderIdentity.identities.get(bid.id); const carrierName = identity?.displayName ?? bid.companies?.name ?? 'Carrier profile incomplete'; const carrier = identity?.companyId ? <MemberIdentityLink companyId={identity.companyId}>{carrierName}</MemberIdentityLink> : identity?.driverId ? <MemberIdentityLink driverId={identity.driverId}>{carrierName}</MemberIdentityLink> : carrierName; return <tr key={bid.id}><td><strong>{carrier}</strong></td><td><div className="customer-dash-table__route"><strong>{job ? `Load ${job.id.slice(0, 8).toUpperCase()}` : `Load ${bid.job_id.slice(0, 8).toUpperCase()}`}</strong><span>{route ? `${route.from} → ${route.to}` : 'Route unavailable'}</span></div></td><td><strong>{money(Number(bid.bid_price_gbp ?? bid.amount ?? 0), bid.currency ?? 'GBP')}</strong></td><td><StatusBadge value={bid.status} /></td><td>{when(bid.created_at)}</td></tr>; })}</tbody></table></div>}
            </section>
          </main>
        </div>

        <OperationalSignalStrip
          ariaLabel="Customer transport summary"
          items={[
            { key: 'open-loads', label: 'Open Loads', value: metricState(jobsDataset, metrics.openLoads.length), detail: 'Waiting for carrier response', tone: 'blue', onClick: () => router.push('/customer/loads') },
            { key: 'quotes', label: 'Quotes Received', value: metricState(bidsDataset, metrics.quoteHistory.length), detail: 'Carrier responses recorded', tone: 'purple', onClick: () => router.push('/customer/quotes') },
            { key: 'awaiting', label: 'Awaiting Award', value: awaitingAwardMetric, detail: 'Customer decision needed', tone: metrics.awaitingAward.length ? 'orange' : 'green', onClick: () => router.push('/customer/quotes') },
            { key: 'active', label: 'Active Deliveries', value: metricState(jobsDataset, metrics.activeDeliveries.length), detail: 'Execution currently moving', tone: metrics.activeDeliveries.length ? 'green' : 'navy', onClick: () => router.push('/customer/tracking') },
            { key: 'delayed', label: 'Delayed', value: metricState(jobsDataset, metrics.delayed.length), detail: 'Past recorded delivery time', tone: metrics.delayed.length ? 'red' : 'green', onClick: () => router.push('/customer/tracking') },
            { key: 'photos', label: 'Delivery Photos', value: metricState(jobsDataset, metrics.deliveryPhotoJobs.length), detail: 'Evidence available to review', tone: 'navy', onClick: () => router.push('/customer/bookings') },
          ]}
        />

        <div className="customer-ops-grid-2">
          <section className="customer-dash-box"><div className="customer-dash-box__head"><strong>Delivery photo evidence</strong><ActionButton tone="secondary" onClick={() => router.push('/customer/bookings')}>Bookings</ActionButton></div>{metrics.deliveryPhotoJobs.length === 0 ? <div className="customer-empty"><EmptyState compact title="No delivery photos waiting" /></div> : <div className="customer-dash-table-wrap"><table className="customer-dash-table"><thead><tr><th>Load</th><th>Status</th><th>Open</th></tr></thead><tbody>{metrics.deliveryPhotoJobs.slice(0, 5).map((job) => { const route = routeLabel(job); return <tr key={job.id}><td><div className="customer-dash-table__route"><strong>{route.from} → {route.to}</strong><span>{job.delivery_photos?.length ?? 0} delivery photo(s)</span></div></td><td><StatusBadge value={workspaceJobPresentationStatus(job)} /></td><td><ActionButton tone="secondary" onClick={() => router.push(`/customer/jobs/${job.id}`)}>Review</ActionButton></td></tr>; })}</tbody></table></div>}</section>
          <section className="customer-dash-box"><div className="customer-dash-box__head"><strong>Invoice position</strong><ActionButton tone="secondary" onClick={() => router.push('/customer/invoices')}>Invoice register</ActionButton></div><div className="customer-dash-box__body"><div className="customer-dash-summary"><div className="customer-dash-summary__row"><span>Total invoices</span><strong>{invoiceCount(metrics.customerInvoices.length)}</strong></div><div className="customer-dash-summary__row"><span>Outstanding</span><strong>{invoiceCount(metrics.unpaidInvoices.length)}</strong></div><div className="customer-dash-summary__row"><span>Outstanding value</span><strong>{invoiceAmount(metrics.unpaidValue)}</strong></div><div className="customer-dash-summary__row"><span>Due within 7 days</span><strong>{invoiceCount(metrics.dueSoonInvoices.length)}</strong></div></div></div></section>
        </div>
      </div>
    </PageFrame>
  );
}
