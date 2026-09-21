'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  invoiceNetAmount,
  invoiceSignedNetAmount,
  isAwaitingPayment,
  isCarrierPayableInvoice,
  isOverdue,
  isRevenueInvoice,
} from '../../lib/brokerFinance';
import { classifyWorkspaceJobStage } from '../../lib/jobs/workspaceJobStage';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';
import {
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
  OperationalCard,
  QuickActionGrid,
  StatusBadge,
  workspaceTheme,
} from '../components/workspace/WorkspaceUI';
import {
  OperationalAttentionItem,
  OperationalAttentionRail,
  OperationalWorkspaceGrid,
} from '../components/workspace/OperationalConvergence';
import { DashboardHomeHeader } from '../components/workspace/DashboardHomePrimitives';

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
const enquiryActionStatuses = new Set(['draft', 'new', 'pending', 'received']);

type EnquiryActionState = {
  loading: boolean;
  unavailable: boolean;
  count: number;
};

const money = (value: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);

const when = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not set';

const normalise = (value: string | null | undefined) => String(value ?? '').trim().toLowerCase();

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
  const [enquiryActions, setEnquiryActions] = useState<EnquiryActionState>({ loading: true, unavailable: false, count: 0 });

  useEffect(() => {
    let active = true;

    const loadEnquiryActions = async () => {
      if (!isSupabaseConfigured || !data.companyId) {
        if (active) setEnquiryActions({ loading: false, unavailable: true, count: 0 });
        return;
      }

      const { data: rows, error } = await supabase
        .from('quotes')
        .select('status')
        .eq('company_id', data.companyId)
        .limit(250);

      if (!active) return;
      if (error) {
        setEnquiryActions({ loading: false, unavailable: true, count: 0 });
        return;
      }

      const count = (rows ?? []).filter((row) => enquiryActionStatuses.has(String(row.status ?? 'draft').toLowerCase())).length;
      setEnquiryActions({ loading: false, unavailable: false, count });
    };

    void loadEnquiryActions();
    return () => { active = false; };
  }, [data.companyId]);

  const metrics = useMemo(() => {
    const now = Date.now();
    const submittedQuotes = data.bids.filter((bid) => bid.status === 'submitted');
    const acceptedQuotes = data.bids.filter((bid) => bid.status === 'accepted');
    const awaitingAward = data.jobs.filter(
      (job) =>
        classifyWorkspaceJobStage(job) === 'open' &&
        !job.awarded_carrier_company_id &&
        submittedQuotes.some((bid) => bid.job_id === job.id),
    );
    const awardedJobs = data.jobs.filter((job) => {
      const stage = classifyWorkspaceJobStage(job);
      return stage === 'awarded' || stage === 'allocated';
    });
    const activeJobs = data.jobs.filter((job) => classifyWorkspaceJobStage(job) === 'in_progress');
    const deliveryEvidenceMissing = data.jobs.filter(
      (job) =>
        classifyWorkspaceJobStage(job) === 'completed' &&
        (job.delivery_photos?.length ?? 0) === 0,
    );
    const exceptions = data.jobs.filter((job) =>
      exceptionStatuses.has(normalise(job.current_status ?? job.status)),
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
    const dueSoon = awaitingPayment.filter((invoice) => {
      if (!invoice.due_date) return false;
      const dueAt = new Date(invoice.due_date).getTime();
      return Number.isFinite(dueAt) && dueAt >= now && dueAt <= now + 7 * 86_400_000;
    });
    const grossMargin = revenue - carrierCost;

    return {
      draftLoads: data.jobs.filter((job) => normalise(job.status) === 'draft').length,
      submittedQuotes,
      acceptedQuotes,
      awaitingAward,
      awardedJobs,
      activeJobs,
      deliveryEvidenceMissing,
      exceptions,
      grossMargin,
      grossMarginPct: revenue > 0 ? (grossMargin / revenue) * 100 : 0,
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

  const jobsUnavailable = unavailable(data, ['jobs']);
  const quotesUnavailable = unavailable(data, ['jobs', 'bids']);
  const invoicesUnavailable = unavailable(data, ['invoices']);
  const invoiceAlertCount = metrics.overdue.length + metrics.dueSoon.length;
  const marginAlert = metrics.grossMargin < 0;
  const enquiryState = enquiryActions.loading ? 'Loading…' : enquiryActions.unavailable ? 'Unavailable' : String(enquiryActions.count);

  return (
    <div style={{ width: '100%', padding: '12px 12px 16px' }}>
      <DashboardHomeHeader
        eyebrow="Broker commercial desk"
        title="Broker Dashboard"
        badge="Operational control"
        description="Action-first control of customer enquiries, carrier decisions, awarded work, delivery evidence, invoices and realised margin."
        actions={
          <>
            <ActionButton tone="warning" onClick={() => router.push('/broker/post-load')}>Post Load</ActionButton>
            <ActionButton tone="secondary" onClick={() => router.push('/broker/compare-quotes')}>Compare Quotes</ActionButton>
          </>
        }
      />

      {data.error ? <AlertBanner>{data.error}</AlertBanner> : null}

      <div style={{ display: 'grid', gridTemplateColumns: '315px minmax(0, 1fr)', gap: '12px', alignItems: 'start' }} className="xdrive-broker-control-grid">
        <aside style={{ display: 'grid', gap: '12px', minWidth: 0 }} aria-label="Broker action centre">
          <OperationalAttentionRail
            title="Action Centre"
            subtitle="Commercial and operational decisions requiring broker attention."
            meta="Priority"
          >
            <OperationalAttentionItem
              priority={<StatusBadge value="Enquiry" tone="blue" />}
              entity="Enquiries awaiting action"
              detail={enquiryActions.unavailable ? 'Customer enquiry data is unavailable.' : 'New or pending customer transport requests.'}
              state={<StatusBadge value={enquiryState} tone={enquiryActions.unavailable ? 'red' : 'blue'} />}
              tone={enquiryActions.unavailable ? 'red' : 'blue'}
              action={<ActionButton tone="secondary" onClick={() => router.push('/broker/enquiries')}>Open</ActionButton>}
            />
            <OperationalAttentionItem
              priority={<StatusBadge value="Quotes" tone="orange" />}
              entity="Quotes requiring action"
              detail="Submitted carrier quotes awaiting a broker decision."
              state={<StatusBadge value={quotesUnavailable ? 'Unavailable' : String(metrics.awaitingAward.length)} tone={quotesUnavailable ? 'red' : metrics.awaitingAward.length ? 'orange' : 'green'} />}
              tone={quotesUnavailable ? 'red' : metrics.awaitingAward.length ? 'orange' : 'green'}
              action={<ActionButton tone="warning" onClick={() => router.push('/broker/compare-quotes')}>Compare</ActionButton>}
            />
            <OperationalAttentionItem
              priority={<StatusBadge value="POD" tone="orange" />}
              entity="Delivery evidence review"
              detail="Completed work without delivery-photo evidence in this dashboard feed."
              state={<StatusBadge value={jobsUnavailable ? 'Unavailable' : String(metrics.deliveryEvidenceMissing.length)} tone={jobsUnavailable ? 'red' : metrics.deliveryEvidenceMissing.length ? 'orange' : 'green'} />}
              tone={jobsUnavailable ? 'red' : metrics.deliveryEvidenceMissing.length ? 'orange' : 'green'}
              action={<ActionButton tone="secondary" onClick={() => router.push('/broker/pod-review')}>Review</ActionButton>}
            />
            <OperationalAttentionItem
              priority={<StatusBadge value="Invoice" tone="orange" />}
              entity="Invoice alerts"
              detail={invoicesUnavailable ? 'Invoice data is unavailable.' : `${metrics.overdue.length} overdue · ${metrics.dueSoon.length} due within 7 days`}
              state={<StatusBadge value={invoicesUnavailable ? 'Unavailable' : String(invoiceAlertCount)} tone={invoicesUnavailable ? 'red' : invoiceAlertCount ? 'orange' : 'green'} />}
              tone={invoicesUnavailable ? 'red' : invoiceAlertCount ? 'orange' : 'green'}
              action={<ActionButton tone="secondary" onClick={() => router.push('/broker/finance')}>Finance</ActionButton>}
            />
            <OperationalAttentionItem
              priority={<StatusBadge value="Margin" tone={marginAlert ? 'red' : 'green'} />}
              entity="Margin alerts"
              detail={invoicesUnavailable ? 'Margin data is unavailable.' : `${money(metrics.grossMargin)} realised · ${metrics.grossMarginPct.toFixed(1)}%`}
              state={<StatusBadge value={invoicesUnavailable ? 'Unavailable' : marginAlert ? 'Attention' : 'Clear'} tone={invoicesUnavailable || marginAlert ? 'red' : 'green'} />}
              tone={invoicesUnavailable || marginAlert ? 'red' : 'green'}
              action={<ActionButton tone={marginAlert ? 'danger' : 'secondary'} onClick={() => router.push('/broker/margins')}>Review</ActionButton>}
            />
          </OperationalAttentionRail>

          <OperationalCard title="Broker actions" subtitle="Existing commercial and exception workflows.">
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
          </OperationalCard>
        </aside>

        <main style={{ minWidth: 0, display: 'grid', gap: '12px', alignContent: 'start' }}>
          <OperationalCard
            title="Quote decisions requiring action"
            subtitle="Loads with live carrier quotes remain directly actionable in the broker decision canvas."
            actions={<ActionButton tone="warning" onClick={() => router.push('/broker/compare-quotes')}>Compare all</ActionButton>}
            flush
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
                  title={quotesUnavailable ? 'Quote decision data unavailable' : 'No award decisions waiting'}
                  description={quotesUnavailable ? 'The broker load or quote feed is currently incomplete.' : 'New loads with carrier quotes will appear here.'}
                />
              }
            />
          </OperationalCard>

          <OperationalCard
            title="Live carrier execution"
            subtitle="Awarded work currently moving through collection and delivery."
            actions={<ActionButton tone="secondary" onClick={() => router.push('/broker/jobs')}>All jobs</ActionButton>}
            flush
          >
            <DataTable
              columns={['Route', 'Customer', 'Pickup', 'Status', 'Photo evidence', 'Track']}
              rows={metrics.activeJobs.slice(0, 7).map((job) => [
                <strong key="route">
                  {job.pickup_postcode ?? job.pickup_location ?? 'Collection'} →{' '}
                  {job.delivery_postcode ?? job.delivery_location ?? 'Delivery'}
                </strong>,
                job.client_name ?? 'Customer',
                when(job.pickup_datetime),
                <StatusBadge key="status" value={job.current_status ?? job.status} />,
                (job.delivery_photos?.length ?? 0) > 0
                  ? <StatusBadge key="evidence" value="captured" tone="green" />
                  : <StatusBadge key="evidence" value="not captured" tone="orange" />,
                <ActionButton key="track" tone="secondary" onClick={() => router.push(`/broker/jobs?job=${job.id}`)}>Track</ActionButton>,
              ])}
              empty={<EmptyState compact title={jobsUnavailable ? 'Job data unavailable' : 'No active carrier jobs'} />}
            />
          </OperationalCard>
        </main>
      </div>

      <OperationalWorkspaceGrid
        asideLabel="Broker commercial actions"
        main={
          <>
            <OperationalCard title="Commercial exposure" subtitle="Finance detail supporting invoice and margin alerts.">
              <FinancialSummaryPanel
                items={[
                  {
                    label: 'Draft loads',
                    detail: 'Not yet published',
                    value: jobsUnavailable ? '—' : metrics.draftLoads,
                    color: workspaceTheme.blue,
                    background: '#EEF4FF',
                  },
                  {
                    label: 'Awaiting customer payment',
                    detail: invoicesUnavailable ? 'Invoice data unavailable' : money(metrics.awaitingPaymentValue),
                    value: invoicesUnavailable ? '—' : metrics.awaitingPayment.length,
                    color: workspaceTheme.amber,
                    background: '#FFF7ED',
                  },
                  {
                    label: 'Due within 7 days',
                    detail: 'Receivables approaching due date',
                    value: invoicesUnavailable ? '—' : metrics.dueSoon.length,
                    color: workspaceTheme.orange,
                    background: '#FFF8E8',
                  },
                  {
                    label: 'Overdue customer invoices',
                    detail: invoicesUnavailable ? 'Invoice data unavailable' : money(metrics.overdueValue),
                    value: invoicesUnavailable ? '—' : metrics.overdue.length,
                    color: metrics.overdue.length ? workspaceTheme.red : workspaceTheme.green,
                    background: metrics.overdue.length ? '#FEF2F2' : '#F0FDF4',
                  },
                  {
                    label: 'Carrier cost',
                    detail: 'Realised supplier invoices',
                    value: invoicesUnavailable ? '—' : money(metrics.carrierSpend),
                    color: workspaceTheme.navy,
                    background: workspaceTheme.surfaceMuted,
                  },
                ]}
              />
            </OperationalCard>

            {(metrics.deliveryEvidenceMissing.length > 0 || metrics.exceptions.length > 0) ? (
              <OperationalCard
                title="Exceptions and delivery evidence follow-up"
                subtitle="Operational exceptions and missing delivery-photo evidence are surfaced before they become customer or finance problems. Full POD completeness remains authoritative in the job sheet."
                actions={<ActionButton tone="secondary" onClick={() => router.push('/broker/disputes')}>Open disputes</ActionButton>}
                flush
              >
                <DataTable
                  columns={['Route', 'Customer', 'Issue', 'Last status', 'Action']}
                  rows={[...metrics.exceptions, ...metrics.deliveryEvidenceMissing.filter((job) => !metrics.exceptions.includes(job))]
                    .slice(0, 8)
                    .map((job) => {
                      const isEvidence = metrics.deliveryEvidenceMissing.includes(job);
                      return [
                        <strong key="route">
                          {job.pickup_postcode ?? job.pickup_location ?? 'Collection'} →{' '}
                          {job.delivery_postcode ?? job.delivery_location ?? 'Delivery'}
                        </strong>,
                        job.client_name ?? 'Customer',
                        isEvidence ? 'Delivery-photo evidence missing' : 'Operational exception',
                        <StatusBadge key="status" value={job.current_status ?? job.status} tone={isEvidence ? 'orange' : 'red'} />,
                        <ActionButton key="action" tone={isEvidence ? 'secondary' : 'danger'} onClick={() => router.push(isEvidence ? '/broker/pod-review' : '/broker/disputes')}>
                          Review
                        </ActionButton>,
                      ];
                    })}
                />
              </OperationalCard>
            ) : null}
          </>
        }
        aside={
          <OperationalCard title="Commercial state" subtitle="Awarded and active work supporting the broker decision desk.">
            <FinancialSummaryPanel
              items={[
                { label: 'Awarded / allocated', detail: 'Not yet in live execution', value: jobsUnavailable ? '—' : metrics.awardedJobs.length, color: workspaceTheme.blue, background: '#EEF4FF' },
                { label: 'Active jobs', detail: 'Carrier execution currently moving', value: jobsUnavailable ? '—' : metrics.activeJobs.length, color: workspaceTheme.green, background: '#F0FDF4' },
                { label: 'Accepted quotes', detail: 'Recorded accepted carrier quotes', value: quotesUnavailable ? '—' : metrics.acceptedQuotes.length, color: workspaceTheme.navy, background: workspaceTheme.surfaceMuted },
              ]}
            />
          </OperationalCard>
        }
      />
    </div>
  );
}
