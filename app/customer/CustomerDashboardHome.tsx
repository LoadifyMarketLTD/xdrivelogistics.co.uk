'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';

import { classifyWorkspaceJobStage } from '../../lib/jobs/workspaceJobStage';
import {
  isCustomerVisibleWorkspaceInvoice,
  useCompanyWorkspaceData,
} from '../components/workspace/useCompanyWorkspaceData';
import { MemberIdentityLink } from '../components/workspace/MemberProfile';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  PageFrame,
  PageHeader,
  StatusBadge,
} from '../components/workspace/WorkspaceUI';

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

export default function CustomerDashboardHome() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();

  const metrics = useMemo(() => {
    const submittedQuotes = data.bids.filter((bid) => bid.status === 'submitted');
    const awaitingAward = data.jobs.filter((job) =>
      classifyWorkspaceJobStage(job) === 'open'
      && submittedQuotes.some((bid) => bid.job_id === job.id)
    );
    const activeDeliveries = data.jobs.filter((job) => classifyWorkspaceJobStage(job) === 'in_progress');
    const delayed = activeDeliveries.filter((job) =>
      Boolean(job.delivery_datetime)
      && new Date(job.delivery_datetime as string).getTime() < Date.now()
    );
    const podReady = data.jobs.filter((job) => (job.delivery_photos?.length ?? 0) > 0);
    const customerInvoices = data.invoices.filter((invoice) =>
      isCustomerVisibleWorkspaceInvoice(invoice, data.companyId),
    );
    const unpaidInvoices = customerInvoices.filter((invoice) =>
      invoice.payment_status !== 'paid' && !['paid', 'Paid'].includes(invoice.status)
    );
    const dueSoonInvoices = unpaidInvoices.filter((invoice) =>
      invoice.due_date && new Date(invoice.due_date).getTime() <= Date.now() + 7 * 86_400_000
    );
    const openLoads = data.jobs.filter((job) => classifyWorkspaceJobStage(job) === 'open' && String(job.status).toLowerCase() !== 'draft');
    const draftLoads = data.jobs.filter((job) => String(job.status).toLowerCase() === 'draft');
    const awardedLoads = data.jobs.filter((job) => ['awarded', 'allocated', 'in_progress', 'completed'].includes(classifyWorkspaceJobStage(job)));
    const recentQuotes = data.bids
      .filter((bid) => ['submitted', 'accepted', 'rejected'].includes(bid.status))
      .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
      .slice(0, 8);

    return {
      submittedQuotes,
      awaitingAward,
      activeDeliveries,
      delayed,
      podReady,
      customerInvoices,
      unpaidInvoices,
      dueSoonInvoices,
      openLoads,
      draftLoads,
      awardedLoads,
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

  const quotesForJob = (jobId: string) =>
    data.bids.filter((bid) => bid.job_id === jobId && bid.status === 'submitted').length;

  const actionLoads = metrics.awaitingAward.length ? metrics.awaitingAward : metrics.openLoads.slice(0, 8);

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

        <div className="customer-dash-metrics" aria-label="Customer transport summary">
          <button className="customer-dash-metric" type="button" onClick={() => router.push('/customer/loads')}><span>Open loads</span><strong>{metrics.openLoads.length}</strong><small>Waiting for carrier response</small></button>
          <button className="customer-dash-metric" data-tone="purple" type="button" onClick={() => router.push('/customer/quotes')}><span>Quotes received</span><strong>{metrics.submittedQuotes.length}</strong><small>Ready to compare</small></button>
          <button className="customer-dash-metric" data-tone="orange" type="button" onClick={() => router.push('/customer/quotes')}><span>Awaiting award</span><strong>{metrics.awaitingAward.length}</strong><small>Customer decision needed</small></button>
          <button className="customer-dash-metric" data-tone="green" type="button" onClick={() => router.push('/customer/tracking')}><span>Active deliveries</span><strong>{metrics.activeDeliveries.length}</strong><small>Execution currently moving</small></button>
          <button className="customer-dash-metric" data-tone={metrics.delayed.length ? 'red' : 'green'} type="button" onClick={() => router.push('/customer/tracking')}><span>Delayed</span><strong>{metrics.delayed.length}</strong><small>Past recorded delivery time</small></button>
          <button className="customer-dash-metric" data-tone="navy" type="button" onClick={() => router.push('/customer/bookings')}><span>POD ready</span><strong>{metrics.podReady.length}</strong><small>Proof available to review</small></button>
        </div>

        <div className="customer-exchange-dashboard">
          <aside className="customer-exchange-left">
            <section className="customer-dash-box">
              <div className="customer-dash-box__head"><strong>Action Centre</strong><span>Needs attention</span></div>
              <div className="customer-dash-box__body"><div className="customer-attention-list">
                <button className="customer-attention-row" data-tone="orange" type="button" onClick={() => router.push('/customer/quotes')}><span className="customer-attention-row__copy"><strong>Quotes awaiting decision</strong><span>Compare carrier price and member profile</span></span><span className="customer-attention-row__count">{metrics.awaitingAward.length}</span></button>
                <button className="customer-attention-row" data-tone="red" type="button" onClick={() => router.push('/customer/tracking')}><span className="customer-attention-row__copy"><strong>Delivery exceptions</strong><span>Past recorded delivery time</span></span><span className="customer-attention-row__count">{metrics.delayed.length}</span></button>
                <button className="customer-attention-row" data-tone="green" type="button" onClick={() => router.push('/customer/bookings')}><span className="customer-attention-row__copy"><strong>POD ready</strong><span>Delivery evidence available</span></span><span className="customer-attention-row__count">{metrics.podReady.length}</span></button>
                <button className="customer-attention-row" type="button" onClick={() => router.push('/customer/invoices')}><span className="customer-attention-row__copy"><strong>Invoices due soon</strong><span>Due within the next 7 days</span></span><span className="customer-attention-row__count">{metrics.dueSoonInvoices.length}</span></button>
              </div></div>
            </section>

            <section className="customer-dash-box"><div className="customer-dash-box__head"><strong>Create & manage transport</strong></div><div className="customer-dash-box__body"><div className="customer-action-grid"><ActionButton tone="warning" onClick={() => router.push('/customer/post-load')}>Post Load</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/customer/loads')}>Loads</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/customer/quotes')}>Compare Quotes</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/customer/bookings')}>Bookings</ActionButton></div></div></section>

            <section className="customer-dash-box"><div className="customer-dash-box__head"><strong>Commercial & documents</strong></div><div className="customer-dash-box__body"><div className="customer-dash-summary"><div className="customer-dash-summary__row"><span>Draft loads</span><strong>{metrics.draftLoads.length}</strong></div><div className="customer-dash-summary__row"><span>Carrier bookings</span><strong>{metrics.awardedLoads.length}</strong></div><div className="customer-dash-summary__row"><span>Outstanding invoices</span><strong>{metrics.unpaidInvoices.length}</strong></div><div className="customer-dash-summary__row"><span>Outstanding value</span><strong>{money(metrics.unpaidValue)}</strong></div></div><div className="customer-action-grid" style={{ marginTop: '8px' }}><ActionButton tone="secondary" onClick={() => router.push('/customer/bookings')}>POD / Order</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/customer/invoices')}>Invoices</ActionButton></div></div></section>

            <section className="customer-dash-box"><div className="customer-dash-box__head"><strong>Workspace shortcuts</strong></div><div className="customer-dash-box__body"><div className="customer-action-grid"><ActionButton tone="secondary" onClick={() => router.push('/customer/diary')}>Diary</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/customer/network')}>Companies</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/customer/account')}>Account</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/customer/tracking')}>Tracking</ActionButton></div></div></section>
          </aside>

          <main className="customer-exchange-main">
            <section className="customer-dash-box">
              <div className="customer-dash-box__head"><strong>{metrics.awaitingAward.length ? 'Loads requiring a decision' : 'Open transport requests'}</strong><ActionButton tone="secondary" onClick={() => router.push(metrics.awaitingAward.length ? '/customer/quotes' : '/customer/loads')}>View all</ActionButton></div>
              {actionLoads.length === 0 ? <div className="customer-empty"><EmptyState compact title="No open decisions" description="Post a load to request transport or review your existing bookings." /></div> : <div className="customer-dash-table-wrap"><table className="customer-dash-table"><thead><tr><th style={{ width: '34%' }}>Route</th><th style={{ width: '18%' }}>Pickup</th><th style={{ width: '10%' }}>Quotes</th><th style={{ width: '13%' }}>Best price</th><th style={{ width: '12%' }}>Status</th><th style={{ width: '13%' }}>Action</th></tr></thead><tbody>{actionLoads.slice(0, 8).map((job) => { const route = routeLabel(job); const bestQuote = bestQuoteForJob(job.id); return <tr key={job.id}><td><div className="customer-dash-table__route"><strong>{route.from} → {route.to}</strong><span>{loadReference(job)}</span></div></td><td>{when(job.pickup_datetime)}</td><td><strong>{quotesForJob(job.id)}</strong></td><td>{bestQuote ? <strong>{money(bestQuote)}</strong> : '—'}</td><td><StatusBadge value={job.current_status ?? job.status} /></td><td><div className="customer-dash-table__actions"><ActionButton tone={quotesForJob(job.id) ? 'success' : 'secondary'} onClick={() => router.push(quotesForJob(job.id) ? '/customer/quotes' : `/customer/jobs/${job.id}`)}>{quotesForJob(job.id) ? 'Compare' : 'Open'}</ActionButton></div></td></tr>; })}</tbody></table></div>}
            </section>

            <section className="customer-dash-box">
              <div className="customer-dash-box__head"><strong>Recent quote activity</strong><ActionButton tone="secondary" onClick={() => router.push('/customer/quotes')}>All quotes</ActionButton></div>
              {metrics.recentQuotes.length === 0 ? <div className="customer-empty"><EmptyState compact title="No quote activity yet" description="Carrier responses will appear here after a load is published." /></div> : <div className="customer-dash-table-wrap"><table className="customer-dash-table"><thead><tr><th style={{ width: '30%' }}>Carrier</th><th style={{ width: '28%' }}>Load / route</th><th style={{ width: '14%' }}>Price</th><th style={{ width: '14%' }}>Status</th><th style={{ width: '14%' }}>Received</th></tr></thead><tbody>{metrics.recentQuotes.map((bid) => { const job = jobById.get(bid.job_id); const route = job ? routeLabel(job) : null; return <tr key={bid.id}><td><strong>{bid.company_id ? <MemberIdentityLink companyId={bid.company_id}>{bid.companies?.name ?? 'Carrier'}</MemberIdentityLink> : bid.companies?.name ?? 'Carrier'}</strong></td><td><div className="customer-dash-table__route"><strong>{job ? `Load ${job.id.slice(0, 8).toUpperCase()}` : `Load ${bid.job_id.slice(0, 8).toUpperCase()}`}</strong><span>{route ? `${route.from} → ${route.to}` : 'Route unavailable'}</span></div></td><td><strong>{money(Number(bid.bid_price_gbp ?? bid.amount ?? 0), bid.currency ?? 'GBP')}</strong></td><td><StatusBadge value={bid.status} /></td><td>{when(bid.created_at)}</td></tr>; })}</tbody></table></div>}
            </section>

            <section className="customer-dash-box">
              <div className="customer-dash-box__head"><strong>Active deliveries</strong><ActionButton tone="secondary" onClick={() => router.push('/customer/tracking')}>Tracking board</ActionButton></div>
              {metrics.activeDeliveries.length === 0 ? <div className="customer-empty"><EmptyState compact title="No active shipments" description="Execution appears here after the carrier begins the operational journey." /></div> : <div className="customer-dash-table-wrap"><table className="customer-dash-table"><thead><tr><th style={{ width: '36%' }}>Route</th><th style={{ width: '19%' }}>Pickup</th><th style={{ width: '19%' }}>Delivery</th><th style={{ width: '13%' }}>Status</th><th style={{ width: '13%' }}>Track</th></tr></thead><tbody>{metrics.activeDeliveries.slice(0, 8).map((job) => { const route = routeLabel(job); return <tr key={job.id}><td><div className="customer-dash-table__route"><strong>{route.from} → {route.to}</strong><span>{loadReference(job)}</span></div></td><td>{when(job.pickup_datetime)}</td><td>{when(job.delivery_datetime)}</td><td><StatusBadge value={job.current_status ?? job.status} tone={metrics.delayed.includes(job) ? 'red' : undefined} /></td><td><div className="customer-dash-table__actions"><ActionButton tone="secondary" onClick={() => router.push(`/customer/jobs/${job.id}`)}>Track</ActionButton></div></td></tr>; })}</tbody></table></div>}
            </section>

            <div className="customer-ops-grid-2">
              <section className="customer-dash-box"><div className="customer-dash-box__head"><strong>POD & delivery evidence</strong><ActionButton tone="secondary" onClick={() => router.push('/customer/bookings')}>Bookings</ActionButton></div>{metrics.podReady.length === 0 ? <div className="customer-empty"><EmptyState compact title="No POD waiting" /></div> : <div className="customer-dash-table-wrap"><table className="customer-dash-table"><thead><tr><th>Load</th><th>Status</th><th>Open</th></tr></thead><tbody>{metrics.podReady.slice(0, 5).map((job) => { const route = routeLabel(job); return <tr key={job.id}><td><div className="customer-dash-table__route"><strong>{route.from} → {route.to}</strong><span>{job.delivery_photos?.length ?? 0} delivery photo(s)</span></div></td><td><StatusBadge value={job.current_status ?? job.status} /></td><td><ActionButton tone="secondary" onClick={() => router.push(`/customer/jobs/${job.id}`)}>Review</ActionButton></td></tr>; })}</tbody></table></div>}</section>
              <section className="customer-dash-box"><div className="customer-dash-box__head"><strong>Invoice position</strong><ActionButton tone="secondary" onClick={() => router.push('/customer/invoices')}>Invoice register</ActionButton></div><div className="customer-dash-box__body"><div className="customer-dash-summary"><div className="customer-dash-summary__row"><span>Total invoices</span><strong>{metrics.customerInvoices.length}</strong></div><div className="customer-dash-summary__row"><span>Outstanding</span><strong>{metrics.unpaidInvoices.length}</strong></div><div className="customer-dash-summary__row"><span>Outstanding value</span><strong>{money(metrics.unpaidValue)}</strong></div><div className="customer-dash-summary__row"><span>Due within 7 days</span><strong>{metrics.dueSoonInvoices.length}</strong></div></div></div></section>
            </div>
          </main>
        </div>
      </div>
    </PageFrame>
  );
}
