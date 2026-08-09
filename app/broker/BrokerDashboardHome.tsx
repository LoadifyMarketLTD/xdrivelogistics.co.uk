'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';

import {
  invoiceNetAmount,
  invoiceSignedNetAmount,
  isAwaitingPayment,
  isCarrierPayableInvoice,
  isOverdue,
  isRevenueInvoice,
} from '../../lib/brokerFinance';
import {
  getWorkspaceMetricPresentation,
  getWorkspaceMetricPresentationStatus,
  useCompanyWorkspaceData,
  type WorkspaceDataState,
} from '../components/workspace/useCompanyWorkspaceData';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  FinancialSummaryPanel,
  KpiCard,
  KpiGrid,
  Panel,
  QuickActionGrid,
  StatusBadge,
  TwoColumn,
  workspaceTheme,
  type WorkspaceCardTone,
} from '../components/workspace/WorkspaceUI';
import { DashboardHomeHeader } from '../components/workspace/DashboardHomePrimitives';

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
]);
const exceptionStatuses = new Set([
  'cancelled',
  'failed',
  'exception',
  'disputed',
  'collection_failed',
  'delivery_failed',
  'damaged',
  'breakdown',
]);

const money = (value: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);

const when = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not set';

const presentation = (
  data: WorkspaceDataState,
  keys: Array<keyof WorkspaceDataState['datasets']>,
  value: number | string | (() => number | string),
  detail: string | (() => string),
  tone: WorkspaceCardTone,
) =>
  getWorkspaceMetricPresentation({
    datasets: keys.map((key) => data.datasets[key]),
    completeValue: value,
    completeDetail: detail,
    completeTone: tone,
  });

const unavailable = (
  data: WorkspaceDataState,
  keys: Array<keyof WorkspaceDataState['datasets']>,
) => {
  const status = getWorkspaceMetricPresentationStatus(keys.map((key) => data.datasets[key]));
  return status === 'partial' || status === 'unavailable' || status === 'omitted';
};

export default function BrokerDashboardHome() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();

  const metrics = useMemo(() => {
    const submittedQuotes = data.bids.filter((bid) => bid.status === 'submitted');
    const acceptedQuotes = data.bids.filter((bid) => bid.status === 'accepted');
    const openLoads = data.jobs.filter((job) => ['posted', 'quoted'].includes(job.status));
    const awaitingAward = data.jobs.filter(
      (job) =>
        !job.awarded_carrier_company_id &&
        submittedQuotes.some((bid) => bid.job_id === job.id),
    );
    const activeJobs = data.jobs.filter((job) =>
      activeStatuses.has(job.current_status ?? job.status),
    );
    const podMissing = data.jobs.filter(
      (job) =>
        ['delivered', 'completed'].includes(job.current_status ?? job.status) &&
        (job.delivery_photos?.length ?? 0) === 0,
    );
    const exceptions = data.jobs.filter((job) =>
      exceptionStatuses.has(job.current_status ?? job.status),
    );

    const revenueInvoices = data.invoices.filter((invoice) =>
      isRevenueInvoice(invoice, data.companyId),
    );
    const carrierPayables = data.invoices.filter((invoice) =>
      isCarrierPayableInvoice(invoice, data.companyId),
    );
    const revenue = revenueInvoices.reduce(
      (sum, invoice) => sum + invoiceSignedNetAmount(invoice),
      0,
    );
    const carrierCost = carrierPayables.reduce(
      (sum, invoice) => sum + invoiceSignedNetAmount(invoice),
      0,
    );
    const awaitingPayment = revenueInvoices.filter((invoice) => isAwaitingPayment(invoice));
    const overdue = revenueInvoices.filter((invoice) => isOverdue(invoice));
    const dueSoon = awaitingPayment.filter(
      (invoice) =>
        invoice.due_date &&
        new Date(invoice.due_date).getTime() <= Date.now() + 7 * 86_400_000,
    );

    return {
      draftLoads: data.jobs.filter((job) => job.status === 'draft').length,
      openLoads,
      submittedQuotes,
      acceptedQuotes,
      awaitingAward,
      activeJobs,
      podMissing,
      exceptions,
      grossMargin: revenue - carrierCost,
      grossMarginPct: revenue > 0 ? ((revenue - carrierCost) / revenue) * 100 : 0,
      awaitingPayment,
      awaitingPaymentValue: awaitingPayment.reduce(
        (sum, invoice) => sum + invoiceNetAmount(invoice),
        0,
      ),
      dueSoon,
      overdue,
      overdueValue: overdue.reduce((sum, invoice) => sum + invoiceNetAmount(invoice), 0),
      carrierSpend: carrierCost,
    };
  }, [data]);

  const openMetric = presentation(
    data,
    ['jobs'],
    metrics.openLoads.length,
    'Published for carrier pricing',
    'blue',
  );
  const quotesMetric = presentation(
    data,
    ['bids'],
    metrics.submittedQuotes.length,
    'Commercial responses received',
    'purple',
  );
  const awardMetric = presentation(
    data,
    ['jobs', 'bids'],
    metrics.awaitingAward.length,
    'Decision required',
    'orange',
  );
  const activeMetric = presentation(
    data,
    ['jobs'],
    metrics.activeJobs.length,
    'Collections and deliveries',
    'green',
  );
  const podMetric = presentation(
    data,
    ['jobs'],
    metrics.podMissing.length,
    'Delivered without proof',
    metrics.podMissing.length ? 'red' : 'navy',
  );
  const marginMetric = presentation(
    data,
    ['invoices'],
    money(metrics.grossMargin),
    `${metrics.grossMarginPct.toFixed(1)}% realised invoice margin`,
    metrics.grossMargin >= 0 ? 'green' : 'red',
  );

  return (
    <div style={{ width: '100%', padding: '12px 12px 16px' }}>
      <DashboardHomeHeader
        eyebrow="Broker commercial desk"
        title="Broker Dashboard"
        badge="Commercial control"
        description="Customer loads, quote decisions, carrier execution and margin exposure — with the next commercial action kept beside the record that needs it."
        actions={
          <>
            <ActionButton tone="warning" onClick={() => router.push('/broker/post-load')}>
              Post Load
            </ActionButton>
            <ActionButton tone="secondary" onClick={() => router.push('/broker/compare-quotes')}>
              Compare Quotes
            </ActionButton>
          </>
        }
      />

      {data.error ? <AlertBanner>{data.error}</AlertBanner> : null}

      <KpiGrid>
        <KpiCard label="Open loads" value={openMetric.value} detail={openMetric.detail} tone={openMetric.tone} onClick={() => router.push('/broker/loads')} />
        <KpiCard label="Carrier quotes" value={quotesMetric.value} detail={quotesMetric.detail} tone={quotesMetric.tone} onClick={() => router.push('/broker/bids')} />
        <KpiCard label="Awaiting award" value={awardMetric.value} detail={awardMetric.detail} tone={awardMetric.tone} onClick={() => router.push('/broker/compare-quotes')} />
        <KpiCard label="Active jobs" value={activeMetric.value} detail={activeMetric.detail} tone={activeMetric.tone} onClick={() => router.push('/broker/jobs')} />
        <KpiCard label="POD missing" value={podMetric.value} detail={podMetric.detail} tone={podMetric.tone} onClick={() => router.push('/broker/pod-review')} />
        <KpiCard label="Gross margin" value={marginMetric.value} detail={marginMetric.detail} tone={marginMetric.tone} onClick={() => router.push('/broker/margins')} />
      </KpiGrid>

      <Panel
        title="Quote decisions requiring action"
        description="Loads with live carrier quotes are kept above general reporting so award decisions can be made before capacity disappears."
        actions={<ActionButton tone="warning" onClick={() => router.push('/broker/compare-quotes')}>Compare all</ActionButton>}
        style={{ marginTop: '12px' }}
      >
        <DataTable
          columns={['Customer load', 'Route', 'Quotes', 'Budget', 'Best quote', 'Est. margin', 'Decision']}
          rows={metrics.awaitingAward.slice(0, 8).map((job) => {
            const quotes = data.bids.filter(
              (bid) => bid.job_id === job.id && bid.status === 'submitted',
            );
            const prices = quotes
              .map((bid) => Number(bid.bid_price_gbp ?? bid.amount ?? 0))
              .filter((price) => price > 0);
            const best = prices.length ? Math.min(...prices) : 0;
            const budget = Number(job.budget_amount ?? 0);
            return [
              job.client_name ?? job.id.slice(0, 8).toUpperCase(),
              <strong key="route">
                {job.pickup_postcode ?? job.pickup_location ?? 'Collection'} →{' '}
                {job.delivery_postcode ?? job.delivery_location ?? 'Delivery'}
              </strong>,
              quotes.length,
              budget > 0 ? money(budget) : '—',
              best > 0 ? money(best) : '—',
              best > 0 && budget > 0 ? money(budget - best) : '—',
              <ActionButton key="decision" tone="success" onClick={() => router.push(`/broker/compare-quotes?job=${job.id}`)}>
                Compare &amp; award
              </ActionButton>,
            ];
          })}
          empty={
            <EmptyState
              compact
              title={unavailable(data, ['jobs', 'bids']) ? 'Quote decision data unavailable' : 'No award decisions waiting'}
              description={unavailable(data, ['jobs', 'bids']) ? 'The broker load or quote feed is currently incomplete.' : 'New loads with carrier quotes will appear here.'}
            />
          }
        />
      </Panel>

      <TwoColumn>
        <Panel
          title="Live carrier execution"
          description="Awarded work currently moving through collection and delivery."
          actions={<ActionButton tone="secondary" onClick={() => router.push('/broker/jobs')}>All jobs</ActionButton>}
          style={{ marginTop: '12px' }}
        >
          <DataTable
            columns={['Route', 'Customer', 'Pickup', 'Status', 'POD', 'Track']}
            rows={metrics.activeJobs.slice(0, 7).map((job) => [
              <strong key="route">
                {job.pickup_postcode ?? job.pickup_location ?? 'Collection'} →{' '}
                {job.delivery_postcode ?? job.delivery_location ?? 'Delivery'}
              </strong>,
              job.client_name ?? 'Customer',
              when(job.pickup_datetime),
              <StatusBadge key="status" value={job.current_status ?? job.status} />,
              (job.delivery_photos?.length ?? 0) > 0
                ? <StatusBadge key="pod" value="ready" tone="green" />
                : <StatusBadge key="pod" value="pending" tone="orange" />,
              <ActionButton key="track" tone="secondary" onClick={() => router.push(`/broker/jobs?job=${job.id}`)}>Track</ActionButton>,
            ])}
            empty={<EmptyState compact title={unavailable(data, ['jobs']) ? 'Job data unavailable' : 'No active carrier jobs'} />}
          />
        </Panel>

        <div style={{ display: 'grid', gap: '12px', marginTop: '12px' }}>
          <Panel title="Commercial exposure" description="Secondary finance metrics are kept off the primary KPI strip.">
            <FinancialSummaryPanel
              items={[
                {
                  label: 'Draft loads',
                  detail: 'Not yet published',
                  value: unavailable(data, ['jobs']) ? '—' : metrics.draftLoads,
                  color: workspaceTheme.blue,
                  background: '#EEF4FF',
                },
                {
                  label: 'Awaiting customer payment',
                  detail: money(metrics.awaitingPaymentValue),
                  value: unavailable(data, ['invoices']) ? '—' : metrics.awaitingPayment.length,
                  color: workspaceTheme.amber,
                  background: '#FFF7ED',
                },
                {
                  label: 'Due within 7 days',
                  detail: 'Receivables approaching due date',
                  value: unavailable(data, ['invoices']) ? '—' : metrics.dueSoon.length,
                  color: workspaceTheme.orange,
                  background: '#FFF8E8',
                },
                {
                  label: 'Overdue customer invoices',
                  detail: money(metrics.overdueValue),
                  value: unavailable(data, ['invoices']) ? '—' : metrics.overdue.length,
                  color: metrics.overdue.length ? workspaceTheme.red : workspaceTheme.green,
                  background: metrics.overdue.length ? '#FEF2F2' : '#F0FDF4',
                },
                {
                  label: 'Carrier cost',
                  detail: 'Realised supplier invoices',
                  value: unavailable(data, ['invoices']) ? '—' : money(metrics.carrierSpend),
                  color: workspaceTheme.navy,
                  background: workspaceTheme.surfaceMuted,
                },
              ]}
            />
          </Panel>

          <Panel title="Broker actions" description="Commercial and exception workflows only.">
            <QuickActionGrid
              actions={[
                { key: 'post', label: 'Post customer load', onClick: () => router.push('/broker/post-load') },
                { key: 'compare', label: 'Compare carrier quotes', onClick: () => router.push('/broker/compare-quotes') },
                { key: 'network', label: 'Carrier network', onClick: () => router.push('/broker/carrier-network') },
                { key: 'disputes', label: 'Disputes', onClick: () => router.push('/broker/disputes') },
                { key: 'invoices', label: 'Customer invoices', onClick: () => router.push('/broker/customer-invoices') },
                { key: 'margins', label: 'Margin reporting', onClick: () => router.push('/broker/margins') },
              ]}
            />
          </Panel>
        </div>
      </TwoColumn>

      {(metrics.podMissing.length > 0 || metrics.exceptions.length > 0) ? (
        <Panel
          title="Exceptions and POD follow-up"
          description="Operational exceptions and missing proof are surfaced before they become customer or finance problems."
          actions={<ActionButton tone="secondary" onClick={() => router.push('/broker/disputes')}>Open disputes</ActionButton>}
          style={{ marginTop: '12px' }}
        >
          <DataTable
            columns={['Route', 'Customer', 'Issue', 'Last status', 'Action']}
            rows={[...metrics.exceptions, ...metrics.podMissing.filter((job) => !metrics.exceptions.includes(job))]
              .slice(0, 8)
              .map((job) => {
                const isPod = metrics.podMissing.includes(job);
                return [
                  <strong key="route">
                    {job.pickup_postcode ?? job.pickup_location ?? 'Collection'} →{' '}
                    {job.delivery_postcode ?? job.delivery_location ?? 'Delivery'}
                  </strong>,
                  job.client_name ?? 'Customer',
                  isPod ? 'POD missing' : 'Operational exception',
                  <StatusBadge key="status" value={job.current_status ?? job.status} tone={isPod ? 'orange' : 'red'} />,
                  <ActionButton key="action" tone={isPod ? 'secondary' : 'danger'} onClick={() => router.push(isPod ? '/broker/pod-review' : '/broker/disputes')}>
                    Review
                  </ActionButton>,
                ];
              })}
          />
        </Panel>
      ) : null}
    </div>
  );
}
