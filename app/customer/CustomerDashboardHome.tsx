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
  AlertBanner,
  DataTable,
  EmptyState,
  KpiCard,
  KpiGrid,
  OperationalLinkList,
  Panel,
  QuickActionGrid,
  StatusBadge,
  TwoColumn,
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

const money = (value: number, currency = 'GBP') =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);

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

export default function CustomerDashboardHome() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();

  const metrics = useMemo(() => {
    const submittedQuotes = data.bids.filter((bid) => bid.status === 'submitted');
    const awaitingAward = data.jobs.filter(
      (job) =>
        !job.awarded_carrier_company_id &&
        submittedQuotes.some((bid) => bid.job_id === job.id),
    );
    const activeDeliveries = data.jobs.filter((job) =>
      activeStatuses.has(job.current_status ?? job.status),
    );
    const delayed = activeDeliveries.filter(
      (job) =>
        job.delivery_datetime &&
        new Date(job.delivery_datetime).getTime() < Date.now(),
    );
    const podReady = data.jobs.filter((job) => (job.delivery_photos?.length ?? 0) > 0);
    const customerInvoices = data.invoices.filter((invoice) =>
      isCustomerVisibleWorkspaceInvoice(invoice, data.companyId),
    );
    const unpaidInvoices = customerInvoices.filter(
      (invoice) =>
        invoice.payment_status !== 'paid' &&
        !['paid', 'Paid'].includes(invoice.status),
    );
    const dueSoonInvoices = unpaidInvoices.filter(
      (invoice) =>
        invoice.due_date &&
        new Date(invoice.due_date).getTime() <= Date.now() + 7 * 86_400_000,
    );

    return {
      draftLoads: data.jobs.filter((job) => job.status === 'draft').length,
      openLoads: data.jobs.filter((job) => ['posted', 'quoted'].includes(job.status)),
      submittedQuotes,
      awaitingAward,
      activeDeliveries,
      delayed,
      podReady,
      awardedLoads: data.jobs.filter(
        (job) => Boolean(job.awarded_carrier_company_id) || ['awarded', 'allocated'].includes(job.status),
      ).length,
      unpaidInvoices,
      unpaidValue: unpaidInvoices.reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0),
      dueSoonInvoices,
    };
  }, [data]);

  const openMetric = presentation(
    data,
    ['jobs'],
    metrics.openLoads.length,
    'Waiting for carrier response',
    'blue',
  );
  const quotesMetric = presentation(
    data,
    ['bids'],
    metrics.submittedQuotes.length,
    'Ready to compare',
    'purple',
  );
  const awardMetric = presentation(
    data,
    ['jobs', 'bids'],
    metrics.awaitingAward.length,
    'Your decision needed',
    'orange',
  );
  const activeMetric = presentation(
    data,
    ['jobs'],
    metrics.activeDeliveries.length,
    'Shipments moving now',
    'green',
  );
  const delayedMetric = presentation(
    data,
    ['jobs'],
    metrics.delayed.length,
    'Past delivery window',
    metrics.delayed.length ? 'red' : 'green',
  );
  const podMetric = presentation(
    data,
    ['jobs'],
    metrics.podReady.length,
    'Proof of delivery available',
    'navy',
  );

  return (
    <div style={{ width: '100%', padding: '12px 12px 16px' }}>
      <DashboardHomeHeader
        eyebrow="Customer transport"
        title="Customer Dashboard"
        badge="Shipment control"
        description="Request transport, decide between carrier quotes, follow live shipments and collect POD and invoices without broker or fleet controls."
        actions={
          <>
            <ActionButton tone="warning" onClick={() => router.push('/customer/post-load')}>
              Post Load
            </ActionButton>
            <ActionButton tone="secondary" onClick={() => router.push('/customer/deliveries')}>
              Track Deliveries
            </ActionButton>
          </>
        }
      />

      {data.error ? <AlertBanner>{data.error}</AlertBanner> : null}

      <KpiGrid>
        <KpiCard label="Open loads" value={openMetric.value} detail={openMetric.detail} tone={openMetric.tone} onClick={() => router.push('/customer/loads')} />
        <KpiCard label="Quotes received" value={quotesMetric.value} detail={quotesMetric.detail} tone={quotesMetric.tone} onClick={() => router.push('/customer/quotes')} />
        <KpiCard label="Awaiting award" value={awardMetric.value} detail={awardMetric.detail} tone={awardMetric.tone} onClick={() => router.push('/customer/quotes')} />
        <KpiCard label="Active deliveries" value={activeMetric.value} detail={activeMetric.detail} tone={activeMetric.tone} onClick={() => router.push('/customer/deliveries')} />
        <KpiCard label="Delayed" value={delayedMetric.value} detail={delayedMetric.detail} tone={delayedMetric.tone} onClick={() => router.push('/customer/deliveries')} />
        <KpiCard label="POD ready" value={podMetric.value} detail={podMetric.detail} tone={podMetric.tone} onClick={() => router.push('/customer/documents')} />
      </KpiGrid>

      <Panel
        title="Award decisions"
        description="Carrier quotes that need a customer decision are kept immediately below the KPI strip."
        actions={<ActionButton tone="warning" onClick={() => router.push('/customer/quotes')}>Review all quotes</ActionButton>}
        style={{ marginTop: '12px' }}
      >
        <DataTable
          columns={['Route', 'Pickup', 'Quotes', 'Best price', 'Decision']}
          rows={metrics.awaitingAward.slice(0, 8).map((job) => {
            const quotes = data.bids.filter(
              (bid) => bid.job_id === job.id && bid.status === 'submitted',
            );
            const prices = quotes
              .map((bid) => Number(bid.bid_price_gbp ?? bid.amount ?? 0))
              .filter((price) => price > 0);
            return [
              <strong key="route">
                {job.pickup_postcode ?? job.pickup_location ?? 'Collection'} →{' '}
                {job.delivery_postcode ?? job.delivery_location ?? 'Delivery'}
              </strong>,
              when(job.pickup_datetime),
              quotes.length,
              prices.length ? money(Math.min(...prices)) : '—',
              <ActionButton key="decision" tone="success" onClick={() => router.push(`/customer/jobs/${job.id}`)}>
                Compare &amp; award
              </ActionButton>,
            ];
          })}
          empty={
            <EmptyState
              compact
              title={unavailable(data, ['jobs', 'bids']) ? 'Quote decision data unavailable' : 'No award decisions waiting'}
              description={unavailable(data, ['jobs', 'bids']) ? 'The load or quote feed is currently incomplete.' : 'Carrier quotes will appear here when a posted load receives responses.'}
            />
          }
        />
      </Panel>

      <TwoColumn>
        <Panel
          title="Active shipments"
          description="Live route, delivery window and shipment state."
          actions={<ActionButton tone="secondary" onClick={() => router.push('/customer/deliveries')}>All deliveries</ActionButton>}
          style={{ marginTop: '12px' }}
        >
          <DataTable
            columns={['Route', 'Pickup', 'Delivery', 'Status', 'Track']}
            rows={metrics.activeDeliveries.slice(0, 8).map((job) => [
              <strong key="route">
                {job.pickup_postcode ?? job.pickup_location ?? 'Collection'} →{' '}
                {job.delivery_postcode ?? job.delivery_location ?? 'Delivery'}
              </strong>,
              when(job.pickup_datetime),
              when(job.delivery_datetime),
              <StatusBadge
                key="status"
                value={job.current_status ?? job.status}
                tone={metrics.delayed.includes(job) ? 'red' : undefined}
              />,
              <ActionButton key="track" tone="secondary" onClick={() => router.push(`/customer/jobs/${job.id}`)}>Track</ActionButton>,
            ])}
            empty={<EmptyState compact title={unavailable(data, ['jobs']) ? 'Shipment data unavailable' : 'No active shipments'} />}
          />
        </Panel>

        <div style={{ display: 'grid', gap: '12px', marginTop: '12px' }}>
          <Panel title="Customer summary" description="Secondary commercial information without cluttering the action strip.">
            <OperationalLinkList
              showTrailingArrow={false}
              items={[
                {
                  key: 'draft',
                  label: 'Draft loads',
                  value: unavailable(data, ['jobs']) ? '—' : metrics.draftLoads,
                  onClick: () => router.push('/customer/loads'),
                },
                {
                  key: 'awarded',
                  label: 'Carrier awards made',
                  value: unavailable(data, ['jobs']) ? '—' : metrics.awardedLoads,
                  onClick: () => router.push('/customer/loads'),
                },
                {
                  key: 'unpaid',
                  label: 'Outstanding invoices',
                  meta: unavailable(data, ['invoices']) ? 'Invoice data unavailable' : money(metrics.unpaidValue),
                  value: unavailable(data, ['invoices']) ? '—' : metrics.unpaidInvoices.length,
                  onClick: () => router.push('/customer/invoices'),
                },
                {
                  key: 'due',
                  label: 'Invoices due within 7 days',
                  value: unavailable(data, ['invoices']) ? '—' : metrics.dueSoonInvoices.length,
                  onClick: () => router.push('/customer/invoices'),
                },
              ]}
            />
          </Panel>

          <Panel
            title="Outstanding invoices"
            description="Only invoices addressed to the customer account are shown."
            actions={<ActionButton tone="secondary" onClick={() => router.push('/customer/invoices')}>All invoices</ActionButton>}
          >
            <DataTable
              columns={['Invoice', 'Amount', 'Due', 'Status']}
              rows={metrics.unpaidInvoices.slice(0, 5).map((invoice) => [
                invoice.invoice_number ?? invoice.id.slice(0, 8).toUpperCase(),
                money(Number(invoice.amount ?? 0), invoice.currency ?? 'GBP'),
                invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-GB') : 'Not set',
                <StatusBadge key="status" value={invoice.payment_status ?? invoice.status} />,
              ])}
              empty={<EmptyState compact title={unavailable(data, ['invoices']) ? 'Invoice data unavailable' : 'No outstanding invoices'} />}
            />
          </Panel>

          <Panel title="Customer actions" description="Transport-request and shipment actions only.">
            <QuickActionGrid
              actions={[
                { key: 'post', label: 'Post transport request', onClick: () => router.push('/customer/post-load') },
                { key: 'quotes', label: 'Compare quotes', onClick: () => router.push('/customer/quotes') },
                { key: 'deliveries', label: 'Track deliveries', onClick: () => router.push('/customer/deliveries') },
                { key: 'documents', label: 'POD & documents', onClick: () => router.push('/customer/documents') },
                { key: 'invoices', label: 'Invoices', onClick: () => router.push('/customer/invoices') },
              ]}
            />
          </Panel>
        </div>
      </TwoColumn>
    </div>
  );
}
