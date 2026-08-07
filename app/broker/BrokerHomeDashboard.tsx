'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  getWorkspaceMetricPresentation,
  getWorkspaceMetricPresentationStatus,
  useCompanyWorkspaceData,
  type WorkspaceDataState,
} from '../components/workspace/useCompanyWorkspaceData';
import {
  invoiceNetAmount,
  invoiceSignedNetAmount,
  isAwaitingPayment,
  isCarrierPayableInvoice,
  isOverdue,
  isRevenueInvoice,
} from '../../lib/brokerFinance';
import {
  ActionButton,
  DataTable,
  EmptyState,
  ExchangeKpiStrip,
  FinancialSummaryPanel,
  KpiCard,
  KpiGrid,
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

const money = (value: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);

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

const metricStatus = (data: WorkspaceDataState, keys: Array<keyof WorkspaceDataState['datasets']>) =>
  getWorkspaceMetricPresentationStatus(keys.map((key) => data.datasets[key]));

const safeValue = (state: ReturnType<typeof getWorkspaceMetricPresentationStatus>, value: number | string) =>
  state === 'partial' ? 'Partial' : state === 'unavailable' || state === 'omitted' ? '—' : value;

export function BrokerHomeDashboard() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();

  const metrics = useMemo(() => {
    const submitted = data.bids.filter((bid) => bid.status === 'submitted');
    const accepted = data.bids.filter((bid) => bid.status === 'accepted');
    const awaitingAwardJobs = data.jobs.filter(
      (job) => !job.awarded_carrier_company_id && submitted.some((bid) => bid.job_id === job.id),
    );
    const activeJobs = data.jobs.filter((job) => active.has(job.current_status ?? job.status));
    const podPending = data.jobs.filter(
      (job) => ['delivered', 'completed'].includes(job.status) && (job.delivery_photos?.length ?? 0) === 0,
    );
    const revenueInvoices = data.invoices.filter((invoice) => isRevenueInvoice(invoice, data.companyId));
    const carrierPayables = data.invoices.filter((invoice) => isCarrierPayableInvoice(invoice, data.companyId));
    const invoicedRevenue = revenueInvoices.reduce((sum, invoice) => sum + invoiceSignedNetAmount(invoice), 0);
    const carrierCost = carrierPayables.reduce((sum, invoice) => sum + invoiceSignedNetAmount(invoice), 0);
    const margin = invoicedRevenue - carrierCost;
    const marginPct = invoicedRevenue > 0 ? (margin / invoicedRevenue) * 100 : 0;
    const awaitingCustomerPayment = revenueInvoices.filter((invoice) => isAwaitingPayment(invoice));
    const overdueCustomerInvoices = revenueInvoices.filter((invoice) => isOverdue(invoice));
    const dueWithinSevenDays = awaitingCustomerPayment.filter(
      (invoice) => invoice.due_date && new Date(invoice.due_date).getTime() <= Date.now() + 7 * 86_400_000,
    );
    const openLoads = data.jobs.filter((job) => ['posted', 'quoted'].includes(job.status));
    const draftLoads = data.jobs.filter((job) => job.status === 'draft');

    const customers = new Map<string, { name: string; loads: number; active: number; value: number }>();
    for (const job of data.jobs) {
      const name = job.client_name?.trim() || 'Customer';
      const row = customers.get(name) ?? { name, loads: 0, active: 0, value: 0 };
      row.loads += 1;
      if (active.has(job.current_status ?? job.status)) row.active += 1;
      row.value += Number(job.budget_amount ?? 0);
      customers.set(name, row);
    }

    const carriers = new Map<string, { name: string; quotes: number; awards: number; quoted: number }>();
    for (const bid of data.bids) {
      const name = bid.companies?.name?.trim() || 'Carrier';
      const row = carriers.get(name) ?? { name, quotes: 0, awards: 0, quoted: 0 };
      if (['submitted', 'accepted', 'rejected'].includes(bid.status)) row.quotes += 1;
      if (bid.status === 'accepted') row.awards += 1;
      row.quoted += Number(bid.bid_price_gbp ?? bid.amount ?? 0);
      carriers.set(name, row);
    }

    return {
      submitted,
      accepted,
      awaitingAwardJobs,
      activeJobs,
      podPending,
      revenueInvoices,
      carrierPayables,
      invoicedRevenue,
      carrierCost,
      margin,
      marginPct,
      awaitingCustomerPayment,
      overdueCustomerInvoices,
      dueWithinSevenDays,
      openLoads,
      draftLoads,
      customers: [...customers.values()].sort((a, b) => b.loads - a.loads).slice(0, 5),
      carriers: [...carriers.values()].sort((a, b) => b.awards - a.awards || b.quotes - a.quotes).slice(0, 5),
    };
  }, [data]);

  const jobsStatus = metricStatus(data, ['jobs']);
  const bidsStatus = metricStatus(data, ['bids']);
  const invoicesStatus = metricStatus(data, ['invoices']);

  const openMetric = metricPresentation(data, ['jobs'], { value: metrics.openLoads.length, detail: 'RFQs open to carrier pricing', tone: 'blue' });
  const quoteMetric = metricPresentation(data, ['bids'], { value: metrics.submitted.length, detail: 'Carrier responses received', tone: 'purple' });
  const awardMetric = metricPresentation(data, ['jobs', 'bids'], { value: metrics.awaitingAwardJobs.length, detail: 'Commercial decision required', tone: 'orange' });
  const activeMetric = metricPresentation(data, ['jobs'], { value: metrics.activeJobs.length, detail: 'Carrier work in execution', tone: 'green' });
  const podMetric = metricPresentation(data, ['jobs'], { value: metrics.podPending.length, detail: 'Delivered without proof', tone: metrics.podPending.length ? 'red' : 'green' });
  const marginMetric = metricPresentation(data, ['invoices'], { value: money(metrics.margin), detail: `${metrics.marginPct.toFixed(1)}% invoiced margin`, tone: metrics.margin >= 0 ? 'green' : 'red' });

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Broker commercial control"
        title="Broker Dashboard"
        description="Manage customer RFQs, source carrier capacity, compare quotes, award transport, protect margin and control delivery through POD."
        actions={
          <>
            <ActionButton tone="warning" onClick={() => router.push('/broker/post-load')}>Post Customer Load</ActionButton>
            <ActionButton tone="secondary" onClick={() => router.push('/broker/compare-quotes')}>Compare Quotes</ActionButton>
          </>
        }
      />

      <ExchangeKpiStrip>
        <KpiCard label="Open RFQs" value={openMetric.value} detail={openMetric.detail} tone={openMetric.tone} onClick={() => router.push('/broker/loads')} />
        <KpiCard label="Carrier quotes" value={quoteMetric.value} detail={quoteMetric.detail} tone={quoteMetric.tone} onClick={() => router.push('/broker/bids')} />
        <KpiCard label="Awaiting award" value={awardMetric.value} detail={awardMetric.detail} tone={awardMetric.tone} onClick={() => router.push('/broker/compare-quotes')} />
        <KpiCard label="Active operations" value={activeMetric.value} detail={activeMetric.detail} tone={activeMetric.tone} onClick={() => router.push('/broker/jobs')} />
        <KpiCard label="POD missing" value={podMetric.value} detail={podMetric.detail} tone={podMetric.tone} onClick={() => router.push('/broker/pod-review')} />
        <KpiCard label="Gross margin" value={marginMetric.value} detail={marginMetric.detail} tone={marginMetric.tone} onClick={() => router.push('/broker/margins')} />
      </ExchangeKpiStrip>

      <Panel
        title="Award decisions — carrier sourcing"
        description="RFQs with carrier pricing are placed directly in front of the broker for comparison and award."
        actions={<ActionButton tone="warning" onClick={() => router.push('/broker/compare-quotes')}>Compare all</ActionButton>}
      >
        <DataTable
          columns={['Customer', 'Route', 'Quotes', 'Customer budget', 'Best carrier quote', 'Estimated margin', 'Decision']}
          rows={metrics.awaitingAwardJobs.slice(0, 7).map((job) => {
            const quotes = data.bids.filter((bid) => bid.job_id === job.id && bid.status === 'submitted');
            const costs = quotes.map((bid) => Number(bid.bid_price_gbp ?? bid.amount ?? 0)).filter((cost) => cost > 0);
            const best = costs.length ? Math.min(...costs) : 0;
            const revenue = Number(job.budget_amount ?? 0);
            return [
              job.client_name ?? 'Customer',
              <strong key="route">{job.pickup_postcode ?? job.pickup_location} → {job.delivery_postcode ?? job.delivery_location}</strong>,
              quotes.length,
              money(revenue),
              best ? money(best) : '—',
              best && revenue ? money(revenue - best) : '—',
              <ActionButton key="action" tone="success" onClick={() => router.push(`/broker/compare-quotes?job=${job.id}`)}>Compare & award</ActionButton>,
            ];
          })}
          empty={<EmptyState compact title={jobsStatus === 'partial' || bidsStatus === 'partial' ? 'Partial award data' : jobsStatus === 'unavailable' || bidsStatus === 'unavailable' || jobsStatus === 'omitted' || bidsStatus === 'omitted' ? 'Award data unavailable' : 'No RFQs awaiting award'} description={jobsStatus === 'complete' || jobsStatus === 'empty' ? 'Carrier quotes requiring a decision will appear here.' : 'The RFQ or carrier quote feed is not fully available.'} />}
        />
      </Panel>

      <TwoColumn>
        <Panel title="Active broker operations" description="Carrier-confirmed jobs in execution, with customer and POD state visible beside the route." actions={<ActionButton tone="secondary" onClick={() => router.push('/broker/jobs')}>All jobs</ActionButton>}>
          <DataTable
            columns={['Customer', 'Route', 'Pickup', 'Status', 'POD', 'Action']}
            rows={metrics.activeJobs.slice(0, 7).map((job) => [
              job.client_name ?? 'Customer',
              <strong key="route">{job.pickup_postcode ?? job.pickup_location} → {job.delivery_postcode ?? job.delivery_location}</strong>,
              when(job.pickup_datetime),
              <StatusBadge key="status" value={job.current_status ?? job.status} />,
              (job.delivery_photos?.length ?? 0) > 0 ? <StatusBadge key="pod" value="ready" tone="green" /> : <StatusBadge key="pod" value="pending" tone="orange" />,
              <ActionButton key="action" tone="secondary" onClick={() => router.push(`/broker/jobs?job=${job.id}`)}>Track</ActionButton>,
            ])}
            empty={<EmptyState compact title={jobsStatus === 'partial' ? 'Partial job data' : jobsStatus === 'unavailable' || jobsStatus === 'omitted' ? 'Job data unavailable' : 'No active broker operations'} description={jobsStatus === 'complete' || jobsStatus === 'empty' ? 'Awarded carrier work appears here when execution starts.' : 'The operational job feed is not fully available.'} />}
          />
        </Panel>

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <Panel title="Broker book" description="The network the broker is actively trading with.">
            <KpiGrid>
              <KpiCard label="Customers" value={safeValue(jobsStatus, metrics.customers.length)} detail="Active customer book" tone="blue" onClick={() => router.push('/broker/customers')} />
              <KpiCard label="Carriers" value={safeValue(bidsStatus, metrics.carriers.length)} detail="Sourcing relationships" tone="navy" onClick={() => router.push('/broker/carrier-network')} />
              <KpiCard label="Draft RFQs" value={safeValue(jobsStatus, metrics.draftLoads.length)} detail="Not yet published" tone="orange" onClick={() => router.push('/broker/loads')} />
              <KpiCard label="Awards made" value={safeValue(bidsStatus, metrics.accepted.length)} detail="Carrier quotes accepted" tone="green" onClick={() => router.push('/broker/awards')} />
            </KpiGrid>
          </Panel>

          <Panel title="Broker actions" description="Customer, sourcing, award and margin actions — no carrier fleet controls.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '0.45rem' }}>
              {[
                ['Post load', '/broker/post-load'],
                ['Customers', '/broker/customers'],
                ['Carrier network', '/broker/carrier-network'],
                ['Compare quotes', '/broker/compare-quotes'],
                ['POD review', '/broker/pod-review'],
                ['Margins', '/broker/margins'],
              ].map(([label, href]) => (
                <button key={href} onClick={() => router.push(href)} style={{ border: '1px solid #dbe3ec', borderRadius: '7px', background: '#fff', color: '#0B2F6B', padding: '0.55rem', fontSize: '0.72rem', fontWeight: 750, cursor: 'pointer', textAlign: 'left' }}>{label}</button>
              ))}
            </div>
          </Panel>
        </div>
      </TwoColumn>

      <TwoColumn>
        <Panel title="Margin & payment control" description="Invoiced revenue, carrier cost and customer payment exposure in one commercial block.">
          <FinancialSummaryPanel items={[
            { label: 'Invoiced revenue', value: safeValue(invoicesStatus, money(metrics.invoicedRevenue)), color: '#166534', background: '#f0fdf4' },
            { label: 'Carrier cost', value: safeValue(invoicesStatus, money(metrics.carrierCost)), color: '#c2410c', background: '#fff7ed' },
            { label: 'Gross margin', value: safeValue(invoicesStatus, money(metrics.margin)), color: metrics.margin >= 0 ? '#166534' : '#b91c1c', background: metrics.margin >= 0 ? '#f0fdf4' : '#fef2f2' },
            { label: 'Awaiting customer payment', value: safeValue(invoicesStatus, money(metrics.awaitingCustomerPayment.reduce((sum, invoice) => sum + invoiceNetAmount(invoice), 0))), color: '#0B2F6B', background: '#eef4ff' },
          ]} />
        </Panel>

        <Panel title="Commercial exceptions" description="Finance and POD issues moved out of the primary KPI strip but kept immediately actionable.">
          <div style={{ display: 'grid', gap: '0.45rem' }}>
            {[
              ['Customer invoices awaiting payment', safeValue(invoicesStatus, metrics.awaitingCustomerPayment.length), '/broker/customer-invoices'],
              ['Invoices due within 7 days', safeValue(invoicesStatus, metrics.dueWithinSevenDays.length), '/broker/customer-invoices'],
              ['Overdue customer invoices', safeValue(invoicesStatus, metrics.overdueCustomerInvoices.length), '/broker/customer-invoices'],
              ['POD requiring review', safeValue(jobsStatus, metrics.podPending.length), '/broker/pod-review'],
            ].map(([label, value, href]) => (
              <button key={String(label)} onClick={() => router.push(String(href))} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '7px', background: '#f8fafc', padding: '0.58rem 0.65rem', color: '#334155', fontSize: '0.74rem', cursor: 'pointer' }}>
                <span>{label}</span><strong style={{ color: '#0B2F6B' }}>{value}</strong>
              </button>
            ))}
          </div>
        </Panel>
      </TwoColumn>

      <TwoColumn>
        <Panel title="Top customers" description="Customer workload and estimated commercial value from broker-managed loads.">
          <DataTable
            columns={['Customer', 'Loads', 'Active', 'Budget value', 'Action']}
            rows={metrics.customers.map((customer) => [
              <strong key="name">{customer.name}</strong>,
              customer.loads,
              customer.active,
              money(customer.value),
              <ActionButton key="action" tone="secondary" onClick={() => router.push(`/broker/loads?customer=${encodeURIComponent(customer.name)}`)}>Open</ActionButton>,
            ])}
            empty={<EmptyState compact title="No customers yet" />}
          />
        </Panel>

        <Panel title="Carrier sourcing performance" description="Carrier quote and award history from this broker book.">
          <DataTable
            columns={['Carrier', 'Quotes', 'Awards', 'Award rate', 'Avg quote']}
            rows={metrics.carriers.map((carrier) => [
              <strong key="name">{carrier.name}</strong>,
              carrier.quotes,
              carrier.awards,
              carrier.quotes ? `${((carrier.awards / carrier.quotes) * 100).toFixed(0)}%` : '—',
              carrier.quotes ? money(carrier.quoted / carrier.quotes) : '—',
            ])}
            empty={<EmptyState compact title={bidsStatus === 'partial' ? 'Partial carrier activity' : bidsStatus === 'unavailable' || bidsStatus === 'omitted' ? 'Carrier activity unavailable' : 'No carrier quote history'} />}
          />
        </Panel>
      </TwoColumn>
    </PageFrame>
  );
}
