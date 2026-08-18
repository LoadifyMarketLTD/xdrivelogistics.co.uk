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
  Panel,
  QuickActionGrid,
  StatusBadge,
  TwoColumn,
  workspaceTheme,
} from '../components/workspace/WorkspaceUI';
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
    // The dashboard workspace feed exposes delivery_photos but not the complete
    // POD signature/recipient/document contract. Keep this signal explicitly
    // about missing delivery-photo evidence and direct users to POD review.
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

      <Panel
        title="Operational action queue"
        description="Master Plan v3 broker priorities, using live workspace data and truthful unavailable states."
      >
        <DataTable
          columns={['Priority', 'Current state', 'Operational meaning', 'Action']}
          rows={[
            [
              <strong key="priority">Enquiries awaiting action</strong>,
              enquiryActions.loading ? 'Loading…' : enquiryActions.unavailable ? 'Unavailable' : enquiryActions.count,
              enquiryActions.unavailable ? 'Customer enquiry data is not available to this dashboard.' : 'New or pending customer transport requests.',
              <ActionButton key="action" tone="secondary" onClick={() => router.push('/broker/enquiries')}>Open enquiries</ActionButton>,
            ],
            [
              <strong key="priority">Quotes requiring action</strong>,
              quotesUnavailable ? 'Unavailable' : metrics.awaitingAward.length,
              'Loads with submitted carrier quotes awaiting a broker decision.',
              <ActionButton key="action" tone="warning" onClick={() => router.push('/broker/compare-quotes')}>Compare quotes</ActionButton>,
            ],
            [
              <strong key="priority">Awarded</strong>,
              jobsUnavailable ? 'Unavailable' : metrics.awardedJobs.length,
              'Carrier awarded or allocated work that has not yet entered live execution.',
              <ActionButton key="action" tone="secondary" onClick={() => router.push('/broker/jobs')}>Open jobs</ActionButton>,
            ],
            [
              <strong key="priority">Active</strong>,
              jobsUnavailable ? 'Unavailable' : metrics.activeJobs.length,
              'Awarded work currently moving through collection or delivery.',
              <ActionButton key="action" tone="secondary" onClick={() => router.push('/broker/jobs')}>Track active</ActionButton>,
            ],
            [
              <strong key="priority">Delivery evidence review</strong>,
              jobsUnavailable ? 'Unavailable' : metrics.deliveryEvidenceMissing.length,
              'Completed work with no delivery-photo evidence in the dashboard feed. Full POD state is checked in POD review / job sheet.',
              <ActionButton key="action" tone="secondary" onClick={() => router.push('/broker/pod-review')}>Review evidence</ActionButton>,
            ],
            [
              <strong key="priority">Invoice alerts</strong>,
              invoicesUnavailable ? 'Unavailable' : invoiceAlertCount,
              invoicesUnavailable ? 'Invoice data is not available.' : `${metrics.overdue.length} overdue · ${metrics.dueSoon.length} due within 7 days`,
              <ActionButton key="action" tone="secondary" onClick={() => router.push('/broker/finance')}>Open finance</ActionButton>,
            ],
            [
              <strong key="priority">Margin alerts</strong>,
              invoicesUnavailable ? 'Unavailable' : marginAlert ? 'Attention' : 'Clear',
              invoicesUnavailable ? 'Margin data is not available.' : `${money(metrics.grossMargin)} realised margin · ${metrics.grossMarginPct.toFixed(1)}%`,
              <ActionButton key="action" tone={marginAlert ? 'danger' : 'secondary'} onClick={() => router.push('/broker/margins')}>Review margin</ActionButton>,
            ],
          ]}
        />
      </Panel>

      <Panel
        title="Quote decisions requiring action"
        description="Loads with live carrier quotes remain directly actionable below the broker queue."
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
              title={quotesUnavailable ? 'Quote decision data unavailable' : 'No award decisions waiting'}
              description={quotesUnavailable ? 'The broker load or quote feed is currently incomplete.' : 'New loads with carrier quotes will appear here.'}
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
        </Panel>

        <div style={{ display: 'grid', gap: '12px', marginTop: '12px' }}>
          <Panel title="Commercial exposure" description="Finance detail supporting invoice and margin alerts.">
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
                  detail: money(metrics.awaitingPaymentValue),
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
                  detail: money(metrics.overdueValue),
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
          </Panel>

          <Panel title="Broker actions" description="Existing commercial and exception workflows.">
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

      {(metrics.deliveryEvidenceMissing.length > 0 || metrics.exceptions.length > 0) ? (
        <Panel
          title="Exceptions and delivery evidence follow-up"
          description="Operational exceptions and missing delivery-photo evidence are surfaced before they become customer or finance problems. Full POD completeness remains authoritative in the job sheet."
          actions={<ActionButton tone="secondary" onClick={() => router.push('/broker/disputes')}>Open disputes</ActionButton>}
          style={{ marginTop: '12px' }}
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
        </Panel>
      ) : null}
    </div>
  );
}
