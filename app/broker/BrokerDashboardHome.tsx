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
  classifyWorkspaceJobStage,
  workspaceJobOperationalLabel,
  workspaceJobPresentationStatus,
} from '../../lib/jobs/workspaceJobStage';
import {
  useCompanyWorkspaceData,
  type WorkspaceDatasetState,
} from '../components/workspace/useCompanyWorkspaceData';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  PageFrame,
  StatusBadge,
} from '../components/workspace/WorkspaceUI';

const money = (value: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);

const when = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : 'TBC';

const metricState = <T,>(dataset: WorkspaceDatasetState<T>, value: number | string) => {
  if (dataset.availability !== 'available') return '—';
  if (dataset.partialData || dataset.limitedData) return 'Partial';
  return value;
};

const brokerLifecycleLabel = (job: Parameters<typeof workspaceJobPresentationStatus>[0]) => workspaceJobOperationalLabel(job);

const brokerJobPriority = (job: Parameters<typeof workspaceJobPresentationStatus>[0]) => {
  const stage = classifyWorkspaceJobStage(job);
  if (stage === 'in_progress') return 0;
  if (stage === 'awarded' || stage === 'allocated') return 1;
  if (stage === 'open') return 2;
  if (stage === 'completed') return 3;
  return 4;
};

export default function BrokerDashboardHome() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();

  const metrics = useMemo(() => {
    const submittedQuotes = data.bids.filter((bid) => bid.status === 'submitted');
    const openLoads = data.jobs.filter((job) => classifyWorkspaceJobStage(job) === 'open');
    const awaitingAward = openLoads.filter(
      (job) =>
        !job.awarded_carrier_company_id &&
        submittedQuotes.some((bid) => bid.job_id === job.id),
    );
    const activeJobs = data.jobs.filter((job) => classifyWorkspaceJobStage(job) === 'in_progress');
    const awardedJobs = data.jobs.filter((job) => {
      const stage = classifyWorkspaceJobStage(job);
      return stage === 'awarded' || stage === 'allocated';
    });

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
    const grossMargin = revenue - carrierCost;
    const outstandingRevenue = revenueInvoices.filter((invoice) => isAwaitingPayment(invoice));
    const overdueRevenue = revenueInvoices.filter((invoice) => isOverdue(invoice));

    const currentJobs = [...data.jobs]
      .sort((a, b) => {
        const priority = brokerJobPriority(a) - brokerJobPriority(b);
        if (priority !== 0) return priority;
        return String(b.updated_at ?? b.created_at ?? '').localeCompare(
          String(a.updated_at ?? a.created_at ?? ''),
        );
      })
      .slice(0, 8);

    return {
      submittedQuotes,
      openLoads,
      awaitingAward,
      activeJobs,
      awardedJobs,
      currentJobs,
      grossMargin,
      outstandingRevenue,
      outstandingRevenueValue: outstandingRevenue.reduce(
        (sum, invoice) => sum + invoiceNetAmount(invoice),
        0,
      ),
      overdueRevenue,
    };
  }, [data]);

  const jobsDataset = data.datasets.jobs;
  const bidsDataset = data.datasets.bids;
  const invoicesDataset = data.datasets.invoices;
  const quoteDecisionUnavailable = jobsDataset.availability !== 'available' || bidsDataset.availability !== 'available';
  const quoteDecisionPartial = !quoteDecisionUnavailable && (
    jobsDataset.partialData || jobsDataset.limitedData || bidsDataset.partialData || bidsDataset.limitedData
  );
  const quoteDecisionMetric = quoteDecisionUnavailable
    ? '—'
    : quoteDecisionPartial
      ? 'Partial'
      : metrics.awaitingAward.length;
  const attentionUnavailable = [jobsDataset, bidsDataset, invoicesDataset].some(
    (dataset) => dataset.availability !== 'available',
  );
  const attentionPartial = !attentionUnavailable && [jobsDataset, bidsDataset, invoicesDataset].some(
    (dataset) => dataset.partialData || dataset.limitedData,
  );

  const attentionItems = [
    {
      label: 'Quotes awaiting decision',
      detail: 'Compare carrier quotes and award the customer load.',
      value: quoteDecisionMetric,
      route: '/broker/bids',
      show: metrics.awaitingAward.length > 0,
    },
    {
      label: 'Awarded work awaiting execution',
      detail: 'Carrier selected, waiting for driver allocation or start.',
      value: metricState(jobsDataset, metrics.awardedJobs.length),
      route: '/broker/jobs',
      show: metrics.awardedJobs.length > 0,
    },
    {
      label: 'Overdue customer invoices',
      detail: 'Customer receivables are past their due date.',
      value: metricState(invoicesDataset, metrics.overdueRevenue.length),
      route: '/broker/customer-invoices',
      show: metrics.overdueRevenue.length > 0,
    },
  ].filter((item) => item.show);

  return (
    <PageFrame>
      <div className="broker-clean-dashboard">
        {data.error ? <AlertBanner tone="danger">{data.error}</AlertBanner> : null}
        {quoteDecisionUnavailable ? (
          <AlertBanner tone="warning">
            Quote decision data unavailable. Award counts are hidden until both jobs and carrier quotes are available.
          </AlertBanner>
        ) : quoteDecisionPartial ? (
          <AlertBanner tone="warning">
            Some quote decision data is unavailable. Exact award counts are hidden until all job and quote information is available.
          </AlertBanner>
        ) : null}

        <section className="broker-clean-box broker-owner-reports-card">
          <div className="broker-clean-box__head">
            <div>
              <strong>Reports & Statistics</strong>
              <span>Live broker transport and commercial position.</span>
            </div>
          </div>
          <div className="broker-clean-kpis" aria-label="Broker summary">
          <button type="button" onClick={() => router.push('/broker/loads')}>
            <span>Open loads</span>
            <strong>{metricState(jobsDataset, metrics.openLoads.length)}</strong>
            <small>Customer work in sourcing</small>
          </button>
          <button type="button" onClick={() => router.push('/broker/bids')}>
            <span>Awaiting award</span>
            <strong>{quoteDecisionMetric}</strong>
            <small>Carrier quotes need a decision</small>
          </button>
          <button type="button" onClick={() => router.push('/broker/jobs')}>
            <span>Active jobs</span>
            <strong>{metricState(jobsDataset, metrics.activeJobs.length)}</strong>
            <small>Driver execution in progress</small>
          </button>
          <button type="button" onClick={() => router.push('/broker/margins')}>
            <span>Gross margin</span>
            <strong>{metricState(invoicesDataset, money(metrics.grossMargin))}</strong>
            <small>Revenue less carrier cost</small>
          </button>
          </div>
        </section>

        <div className="broker-clean-grid broker-owner-attention">
          <section className="broker-clean-box">
            <div className="broker-clean-box__head">
              <div>
                <strong>Needs your attention</strong>
                <span>Only items requiring a broker decision or intervention</span>
              </div>
              <ActionButton tone="secondary" onClick={() => router.push('/broker/action-centre')}>
                Action Centre
              </ActionButton>
            </div>
            <div className="broker-clean-box__body">
              {attentionItems.length ? (
                <div className="broker-clean-attention">
                  {attentionItems.map((item) => (
                    <button key={item.label} type="button" onClick={() => router.push(item.route)}>
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.detail}</small>
                      </span>
                      <b>{item.value}</b>
                    </button>
                  ))}
                </div>
              ) : attentionUnavailable ? (
                <EmptyState
                  compact
                  title={quoteDecisionUnavailable ? 'Quote decision data unavailable' : 'Attention data unavailable'}
                  description="The broker dashboard cannot confirm that there are no decisions or interventions until jobs, quotes and invoices are available."
                />
              ) : attentionPartial ? (
                <EmptyState
                  compact
                  title={quoteDecisionPartial ? 'Quote decision data is partial' : 'Attention data is partial'}
                  description="The visible records are incomplete, so this dashboard does not claim that the attention queue is empty."
                />
              ) : (
                <EmptyState
                  compact
                  title="Nothing needs attention"
                  description="There are no urgent broker decisions right now."
                />
              )}
            </div>
          </section>
        </div>

        <section className="broker-clean-box broker-owner-activity">
          <div className="broker-clean-box__head">
            <div>
              <strong>Activity at a glance</strong>
              <span>Same job lifecycle seen by Customer, Driver, Fleet and Broker</span>
            </div>
            <ActionButton tone="secondary" onClick={() => router.push('/broker/jobs')}>View all jobs</ActionButton>
          </div>
          <div className="broker-clean-box__body">
            {metrics.currentJobs.length ? (
              <div className="broker-clean-table-wrap">
                <table className="broker-clean-table">
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Customer</th>
                      <th>Route</th>
                      <th>Pickup</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.currentJobs.map((job) => {
                      const stage = classifyWorkspaceJobStage(job);
                      const action =
                        stage === 'in_progress'
                          ? 'Track'
                          : stage === 'completed'
                            ? 'POD'
                            : stage === 'open'
                              ? 'Quotes'
                              : 'View booking';
                      const route =
                        action === 'Quotes'
                          ? `/broker/bids?job=${job.id}`
                          : action === 'POD'
                            ? `/broker/pod-review?job=${job.id}`
                            : `/broker/jobs?job=${job.id}`;

                      return (
                        <tr key={job.id}>
                          <td>
                            <strong>XDL-{job.id.slice(0, 8).toUpperCase()}</strong>
                            <small>{job.customer_reference || 'No customer ref'}</small>
                          </td>
                          <td>{job.client_name || 'Customer'}</td>
                          <td>
                            <strong>
                              {job.pickup_postcode ?? job.pickup_location ?? 'Collection'} →{' '}
                              {job.delivery_postcode ?? job.delivery_location ?? 'Delivery'}
                            </strong>
                          </td>
                          <td>{when(job.pickup_datetime)}</td>
                          <td><StatusBadge value={brokerLifecycleLabel(job)} /></td>
                          <td>
                            <ActionButton tone="secondary" onClick={() => router.push(route)}>
                              {action}
                            </ActionButton>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : jobsDataset.availability !== 'available' ? (
              <EmptyState
                compact
                title="Transport data unavailable"
                description="Current transport cannot be confirmed until the jobs source is available."
              />
            ) : jobsDataset.partialData || jobsDataset.limitedData ? (
              <EmptyState
                compact
                title="Transport data is partial"
                description="Some job information is unavailable, so this dashboard does not assume there is no transport work."
              />
            ) : (
              <EmptyState
                compact
                title="No transport yet"
                description="Customer loads and awarded carrier work will appear here."
              />
            )}
          </div>
        </section>

        <section className="broker-clean-box broker-owner-commercial">
          <div className="broker-clean-box__head">
            <div>
              <strong>Commercial & Finance</strong>
              <span>Broker-only financial visibility, kept separate from operational execution</span>
            </div>
            <ActionButton tone="secondary" onClick={() => router.push('/broker/finance')}>Open Finance</ActionButton>
          </div>
          <div className="broker-clean-commercial">
            <button type="button" onClick={() => router.push('/broker/customer-invoices')}>
              <span>Awaiting customer payment</span>
              <strong>{metricState(invoicesDataset, metrics.outstandingRevenue.length)}</strong>
              <small>{invoicesDataset.availability !== 'available'
                ? 'Unavailable'
                : invoicesDataset.partialData || invoicesDataset.limitedData
                  ? 'Partial total'
                  : money(metrics.outstandingRevenueValue)}</small>
            </button>
            <button type="button" onClick={() => router.push('/broker/carrier-costs')}>
              <span>Carrier costs</span>
              <strong>Open</strong>
              <small>Review payable carrier invoices</small>
            </button>
            <button type="button" onClick={() => router.push('/broker/margins')}>
              <span>Margin</span>
              <strong>{metricState(invoicesDataset, money(metrics.grossMargin))}</strong>
              <small>Customer revenue minus carrier cost</small>
            </button>
          </div>
        </section>

        <section className="broker-clean-box broker-owner-reports-links">
          <div className="broker-clean-box__head">
            <div><strong>Reports</strong><span>Direct routes to broker operational registers.</span></div>
          </div>
          <div className="broker-clean-footer-links">
          <button type="button" onClick={() => router.push('/broker/customers')}>Customers</button>
          <button type="button" onClick={() => router.push('/broker/carrier-network')}>Carrier Network</button>
          <button type="button" onClick={() => router.push('/broker/diary')}>Diary</button>
          <button type="button" onClick={() => router.push('/broker/messages')}>Messages</button>
          <button type="button" onClick={() => router.push('/broker/event-log')}>Event Log</button>
          <button type="button" onClick={() => router.push('/broker/disputes')}>Disputes</button>
          </div>
        </section>
      </div>
    </PageFrame>
  );
}
