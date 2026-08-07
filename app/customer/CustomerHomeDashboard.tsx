'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  getWorkspaceMetricPresentation,
  getWorkspaceMetricPresentationStatus,
  isCustomerVisibleWorkspaceInvoice,
  useCompanyWorkspaceData,
  type WorkspaceDataState,
} from '../components/workspace/useCompanyWorkspaceData';
import {
  ActionButton,
  DataTable,
  EmptyState,
  ExchangeKpiStrip,
  FinancialSummaryPanel,
  KpiCard,
  PageFrame,
  PageHeader,
  Panel,
  StatusBadge,
  TwoColumn,
  type WorkspaceCardTone,
} from '../components/workspace/WorkspaceUI';

const active = new Set([
  'awarded', 'allocated', 'accepted', 'on_my_way', 'on_my_way_to_pickup',
  'on_site_pickup', 'loaded', 'collected', 'in_transit', 'on_my_way_to_delivery', 'on_site_delivery',
]);

const money = (value: number, currency = 'GBP') =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);

const when = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set';

const metricPresentation = (
  data: WorkspaceDataState,
  keys: Array<keyof WorkspaceDataState['datasets']>,
  config: { value: number | string | (() => number | string); detail: string | (() => string); tone: WorkspaceCardTone },
) => getWorkspaceMetricPresentation({
  datasets: keys.map((key) => data.datasets[key]),
  completeValue: config.value,
  completeDetail: config.detail,
  completeTone: config.tone,
});

const status = (data: WorkspaceDataState, keys: Array<keyof WorkspaceDataState['datasets']>) =>
  getWorkspaceMetricPresentationStatus(keys.map((key) => data.datasets[key]));

const safeValue = (state: ReturnType<typeof getWorkspaceMetricPresentationStatus>, value: number | string) =>
  state === 'partial' ? 'Partial' : state === 'unavailable' || state === 'omitted' ? '—' : value;

export function CustomerHomeDashboard() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();

  const metrics = useMemo(() => {
    const submittedQuotes = data.bids.filter((bid) => bid.status === 'submitted');
    const awaitingAward = data.jobs.filter(
      (job) => !job.awarded_carrier_company_id && submittedQuotes.some((bid) => bid.job_id === job.id),
    );
    const activeDeliveries = data.jobs.filter((job) => active.has(job.current_status ?? job.status));
    const delayed = activeDeliveries.filter(
      (job) => job.delivery_datetime && new Date(job.delivery_datetime).getTime() < Date.now(),
    );
    const customerInvoices = data.invoices.filter((invoice) => isCustomerVisibleWorkspaceInvoice(invoice, data.companyId));
    const unpaidInvoices = customerInvoices.filter(
      (invoice) => invoice.payment_status !== 'paid' && !['paid', 'Paid', 'void'].includes(invoice.status),
    );
    const paidInvoices = customerInvoices.filter(
      (invoice) => invoice.payment_status === 'paid' || ['paid', 'Paid'].includes(invoice.status),
    );
    const invoicedCost = customerInvoices.reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0);
    const paidCost = paidInvoices.reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0);
    const unpaidValue = unpaidInvoices.reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0);
    const dueSoon = unpaidInvoices.filter(
      (invoice) => invoice.due_date && new Date(invoice.due_date).getTime() <= Date.now() + 7 * 86_400_000,
    );

    const supplierMap = new Map<string, { name: string; quotes: number; awards: number; quoteValue: number }>();
    for (const bid of data.bids) {
      const name = bid.companies?.name?.trim() || 'Carrier';
      const row = supplierMap.get(name) ?? { name, quotes: 0, awards: 0, quoteValue: 0 };
      if (['submitted', 'accepted', 'rejected'].includes(bid.status)) row.quotes += 1;
      if (bid.status === 'accepted') row.awards += 1;
      row.quoteValue += Number(bid.bid_price_gbp ?? bid.amount ?? 0);
      supplierMap.set(name, row);
    }

    const suppliers = [...supplierMap.values()]
      .sort((a, b) => b.awards - a.awards || b.quotes - a.quotes)
      .slice(0, 6);

    return {
      openLoads: data.jobs.filter((job) => ['posted', 'quoted'].includes(job.status)).length,
      quotesReceived: submittedQuotes.length,
      awaitingAward,
      activeDeliveries,
      delayed,
      podReady: data.jobs.filter((job) => (job.delivery_photos?.length ?? 0) > 0).length,
      draftLoads: data.jobs.filter((job) => job.status === 'draft').length,
      customerInvoices,
      unpaidInvoices,
      unpaidValue,
      dueSoon,
      invoicedCost,
      paidCost,
      suppliers,
    };
  }, [data]);

  const jobsStatus = status(data, ['jobs']);
  const bidsStatus = status(data, ['bids']);
  const invoicesStatus = status(data, ['invoices']);

  const openMetric = metricPresentation(data, ['jobs'], { value: metrics.openLoads, detail: 'Waiting for carrier pricing', tone: 'blue' });
  const quotesMetric = metricPresentation(data, ['bids'], { value: metrics.quotesReceived, detail: 'Carrier responses ready', tone: 'purple' });
  const awardMetric = metricPresentation(data, ['jobs', 'bids'], { value: metrics.awaitingAward.length, detail: 'Your decision required', tone: 'orange' });
  const activeMetric = metricPresentation(data, ['jobs'], { value: metrics.activeDeliveries.length, detail: 'Shipments moving now', tone: 'green' });
  const delayedMetric = metricPresentation(data, ['jobs'], { value: metrics.delayed.length, detail: 'Past delivery window', tone: metrics.delayed.length ? 'red' : 'green' });
  const podMetric = metricPresentation(data, ['jobs'], { value: metrics.podReady, detail: 'Delivery evidence available', tone: 'navy' });

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Customer transport control"
        title="Customer Dashboard"
        description="Control your shipments from request and carrier quote through live delivery, POD, transport cost and invoice payment."
        actions={
          <>
            <ActionButton tone="warning" onClick={() => router.push('/customer/post-load')}>Create Shipment</ActionButton>
            <ActionButton tone="secondary" onClick={() => router.push('/customer/deliveries')}>Track Deliveries</ActionButton>
          </>
        }
      />

      <ExchangeKpiStrip>
        <KpiCard label="Open shipments" value={openMetric.value} detail={openMetric.detail} tone={openMetric.tone} onClick={() => router.push('/customer/loads')} />
        <KpiCard label="Quotes received" value={quotesMetric.value} detail={quotesMetric.detail} tone={quotesMetric.tone} onClick={() => router.push('/customer/quotes')} />
        <KpiCard label="Awaiting award" value={awardMetric.value} detail={awardMetric.detail} tone={awardMetric.tone} onClick={() => router.push('/customer/quotes')} />
        <KpiCard label="Active deliveries" value={activeMetric.value} detail={activeMetric.detail} tone={activeMetric.tone} onClick={() => router.push('/customer/deliveries')} />
        <KpiCard label="Delayed" value={delayedMetric.value} detail={delayedMetric.detail} tone={delayedMetric.tone} onClick={() => router.push('/customer/deliveries')} />
        <KpiCard label="POD ready" value={podMetric.value} detail={podMetric.detail} tone={podMetric.tone} onClick={() => router.push('/customer/documents')} />
      </ExchangeKpiStrip>

      {metrics.awaitingAward.length > 0 && (
        <Panel
          title="Carrier selection required"
          description="These shipments already have carrier pricing. Award the best option before capacity changes."
          actions={<ActionButton tone="warning" onClick={() => router.push('/customer/quotes')}>Compare all quotes</ActionButton>}
        >
          <DataTable
            columns={['Shipment', 'Route', 'Pickup', 'Quotes', 'Best price', 'Decision']}
            rows={metrics.awaitingAward.slice(0, 6).map((job) => {
              const quotes = data.bids.filter((bid) => bid.job_id === job.id && bid.status === 'submitted');
              const prices = quotes.map((bid) => Number(bid.bid_price_gbp ?? bid.amount ?? 0)).filter((price) => price > 0);
              return [
                job.id.slice(0, 8).toUpperCase(),
                <strong key="route">{job.pickup_postcode ?? job.pickup_location} → {job.delivery_postcode ?? job.delivery_location}</strong>,
                when(job.pickup_datetime),
                quotes.length,
                prices.length ? money(Math.min(...prices)) : '—',
                <ActionButton key="action" tone="success" onClick={() => router.push(`/customer/jobs/${job.id}`)}>Compare & award</ActionButton>,
              ];
            })}
          />
        </Panel>
      )}

      <TwoColumn>
        <Panel
          title="Live deliveries"
          description="The shipments that need your attention now — route, delivery window and current milestone."
          actions={<ActionButton tone="secondary" onClick={() => router.push('/customer/deliveries')}>All deliveries</ActionButton>}
        >
          <DataTable
            columns={['Route', 'Pickup', 'Delivery', 'Status', 'Action']}
            rows={metrics.activeDeliveries.slice(0, 7).map((job) => [
              <strong key="route">{job.pickup_postcode ?? job.pickup_location} → {job.delivery_postcode ?? job.delivery_location}</strong>,
              when(job.pickup_datetime),
              when(job.delivery_datetime),
              <StatusBadge key="status" value={job.current_status ?? job.status} tone={metrics.delayed.includes(job) ? 'red' : undefined} />,
              <ActionButton key="action" tone="secondary" onClick={() => router.push(`/customer/jobs/${job.id}`)}>Track</ActionButton>,
            ])}
            empty={<EmptyState compact title={jobsStatus === 'partial' ? 'Partial delivery data' : jobsStatus === 'unavailable' || jobsStatus === 'omitted' ? 'Delivery data unavailable' : 'No active deliveries'} description={jobsStatus === 'complete' || jobsStatus === 'empty' ? 'Awarded shipments appear here when transport starts.' : 'The live delivery feed is not fully available.'} />}
          />
        </Panel>

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <Panel title="Transport cost & invoices" description="What transport has cost and what remains payable.">
            <FinancialSummaryPanel items={[
              { label: 'Invoiced transport cost', value: safeValue(invoicesStatus, money(metrics.invoicedCost)), color: '#0B2F6B', background: '#eef4ff' },
              { label: 'Paid', value: safeValue(invoicesStatus, money(metrics.paidCost)), color: '#166534', background: '#f0fdf4' },
              { label: 'Outstanding', value: safeValue(invoicesStatus, money(metrics.unpaidValue)), color: metrics.unpaidValue ? '#c2410c' : '#166534', background: metrics.unpaidValue ? '#fff7ed' : '#f0fdf4' },
              { label: 'Due within 7 days', value: safeValue(invoicesStatus, metrics.dueSoon.length), color: metrics.dueSoon.length ? '#b91c1c' : '#166534', background: metrics.dueSoon.length ? '#fef2f2' : '#f0fdf4' },
            ]} />
          </Panel>

          <Panel title="Customer actions" description="Only shipment-owner actions are shown here.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '0.45rem' }}>
              {[
                ['Create shipment', '/customer/post-load'],
                ['Review quotes', '/customer/quotes'],
                ['Track deliveries', '/customer/deliveries'],
                ['POD & documents', '/customer/documents'],
                ['Invoices', '/customer/invoices'],
                ['Transport history', '/customer/loads'],
              ].map(([label, href]) => (
                <button key={href} onClick={() => router.push(href)} style={{ border: '1px solid #dbe3ec', borderRadius: '7px', background: '#fff', color: '#0B2F6B', padding: '0.55rem', fontSize: '0.72rem', fontWeight: 750, cursor: 'pointer', textAlign: 'left' }}>{label}</button>
              ))}
            </div>
          </Panel>
        </div>
      </TwoColumn>

      <TwoColumn>
        <Panel title="Supplier performance" description="Carrier activity from your own quote and award history — no fleet or admin data is exposed.">
          <DataTable
            columns={['Carrier', 'Quotes', 'Awards', 'Award rate', 'Average quote']}
            rows={metrics.suppliers.map((supplier) => [
              <strong key="name">{supplier.name}</strong>,
              supplier.quotes,
              supplier.awards,
              supplier.quotes ? `${((supplier.awards / supplier.quotes) * 100).toFixed(0)}%` : '—',
              supplier.quotes ? money(supplier.quoteValue / supplier.quotes) : '—',
            ])}
            empty={<EmptyState compact title={bidsStatus === 'partial' ? 'Partial supplier performance' : bidsStatus === 'unavailable' || bidsStatus === 'omitted' ? 'Supplier performance unavailable' : 'No supplier history yet'} description={bidsStatus === 'complete' || bidsStatus === 'empty' ? 'Carrier performance appears after quotes and awards are recorded.' : 'Carrier quote history is not fully available.'} />}
          />
        </Panel>

        <Panel title="Commercial summary" description="Pipeline and finance items moved out of the primary KPI strip.">
          <div style={{ display: 'grid', gap: '0.45rem' }}>
            {[
              ['Draft shipments', safeValue(jobsStatus, metrics.draftLoads)],
              ['Outstanding invoices', safeValue(invoicesStatus, metrics.unpaidInvoices.length)],
              ['Outstanding value', safeValue(invoicesStatus, money(metrics.unpaidValue))],
              ['Invoices due soon', safeValue(invoicesStatus, metrics.dueSoon.length)],
            ].map(([label, value]) => (
              <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', padding: '0.58rem 0.65rem', border: '1px solid #e2e8f0', borderRadius: '7px', background: '#f8fafc', fontSize: '0.75rem' }}>
                <span style={{ color: '#475569' }}>{label}</span><strong style={{ color: '#0B2F6B' }}>{value}</strong>
              </div>
            ))}
          </div>
        </Panel>
      </TwoColumn>

      <Panel title="Recent shipment activity" description="Your most recently updated transport requests and deliveries." actions={<ActionButton tone="secondary" onClick={() => router.push('/customer/loads')}>View all shipments</ActionButton>}>
        <DataTable
          columns={['Reference', 'Route', 'Pickup', 'Status', 'Quotes', 'Action']}
          rows={data.jobs.slice(0, 8).map((job) => [
            job.id.slice(0, 8).toUpperCase(),
            <strong key="route">{job.pickup_postcode ?? job.pickup_location} → {job.delivery_postcode ?? job.delivery_location}</strong>,
            when(job.pickup_datetime),
            <StatusBadge key="status" value={job.current_status ?? job.status} />,
            data.bids.filter((bid) => bid.job_id === job.id && bid.status === 'submitted').length,
            <ActionButton key="action" tone="secondary" onClick={() => router.push(`/customer/jobs/${job.id}`)}>Open</ActionButton>,
          ])}
          empty={<EmptyState compact title="No transport activity yet" action={<ActionButton tone="warning" onClick={() => router.push('/customer/post-load')}>Create first shipment</ActionButton>} />}
        />
      </Panel>
    </PageFrame>
  );
}
