'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';

import { classifyWorkspaceJobStage, workspaceJobPresentationStatus } from '../../lib/jobs/workspaceJobStage';
import {
  isCustomerVisibleWorkspaceInvoice,
  useCompanyWorkspaceData,
  type WorkspaceDatasetState,
} from '../components/workspace/useCompanyWorkspaceData';
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

const metricState = <T,>(dataset: WorkspaceDatasetState<T>, value: number) => {
  if (dataset.availability !== 'available') return '—';
  if (dataset.partialData || dataset.limitedData) return 'Partial';
  return value;
};

const customerLifecycleLabel = (job: Parameters<typeof workspaceJobPresentationStatus>[0]) => {
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

const customerJobAction = (job: Parameters<typeof workspaceJobPresentationStatus>[0]) => {
  const stage = classifyWorkspaceJobStage(job);
  if (stage === 'in_progress') return { label: 'Track', href: '/customer/tracking' };
  if (stage === 'allocated' || stage === 'awarded') return { label: 'View booking', href: '/customer/bookings' };
  if (stage === 'completed') return { label: 'View POD', href: '/customer/bookings' };
  return { label: 'Open', href: '/customer/loads' };
};

const customerJobPriority = (job: Parameters<typeof workspaceJobPresentationStatus>[0]) => {
  const stage = classifyWorkspaceJobStage(job);
  if (stage === 'in_progress') return 0;
  if (stage === 'allocated') return 1;
  if (stage === 'awarded') return 2;
  if (stage === 'open') return 3;
  if (stage === 'completed') return 4;
  return 5;
};

export default function CustomerDashboardHome() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();

  const metrics = useMemo(() => {
    const openLoads = data.jobs.filter(
      (job) => classifyWorkspaceJobStage(job) === 'open' && String(job.status).toLowerCase() !== 'draft',
    );
    const submittedQuotes = data.bids.filter((bid) => bid.status === 'submitted');
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
        const priority = customerJobPriority(a) - customerJobPriority(b);
        if (priority !== 0) return priority;
        return String(b.updated_at ?? b.created_at ?? '').localeCompare(String(a.updated_at ?? a.created_at ?? ''));
      })
      .slice(0, 8);

    return {
      openLoads,
      submittedQuotes,
      activeDeliveries,
      unpaidInvoices,
      delayed,
      completedWithPod,
      documentAlertJobs,
      recentJobs,
      unpaidValue: unpaidInvoices.reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0),
    };
  }, [data]);

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
      label: 'Quotes to review',
      detail: 'Compare carrier offers and decide who gets the work.',
      count: metricState(bidsDataset, metrics.submittedQuotes.length),
      route: '/customer/quotes',
      show: metrics.submittedQuotes.length > 0,
    },
    {
      label: 'Delivery exceptions',
      detail: 'Check deliveries that are past their recorded delivery time.',
      count: metricState(jobsDataset, metrics.delayed.length),
      route: '/customer/tracking',
      show: metrics.delayed.length > 0,
    },
    {
      label: 'Document alerts',
      detail: 'Review completed work with missing or rejected POD and delivery evidence.',
      count: metricState(jobsDataset, metrics.documentAlertJobs.length),
      route: '/customer/bookings',
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
      show: metrics.unpaidInvoices.length > 0,
    },
  ].filter((item) => item.show);

  return (
    <PageFrame>
      <div className="customer-operational-page">
        <PageHeader
          eyebrow="Customer workspace"
          title="Transport overview"
          description="See what needs your attention, manage current loads and follow active deliveries."
        />

        {data.error ? <AlertBanner tone="danger">{data.error}</AlertBanner> : null}
        {invoicesDataset.availability !== 'available' ? (
          <AlertBanner tone="warning">
            Invoice data unavailable. Financial totals are hidden until the data source is available.
          </AlertBanner>
        ) : invoicesDataset.partialData || invoicesDataset.limitedData ? (
          <AlertBanner tone="warning">
            Invoice data is partial. Exact financial totals are hidden until the complete dataset is available.
          </AlertBanner>
        ) : null}

        <div className="customer-dash-metrics" aria-label="Customer transport summary">
          <button className="customer-dash-metric" type="button" onClick={() => router.push('/customer/loads')}>
            <span>Open loads</span>
            <strong>{metricState(jobsDataset, metrics.openLoads.length)}</strong>
            <small>Waiting for carrier response</small>
          </button>
          <button
            className="customer-dash-metric"
            data-tone="purple"
            type="button"
            onClick={() => router.push('/customer/quotes')}
          >
            <span>Quotes to review</span>
            <strong>{metricState(bidsDataset, metrics.submittedQuotes.length)}</strong>
            <small>Carrier offers awaiting you</small>
          </button>
          <button
            className="customer-dash-metric"
            data-tone="green"
            type="button"
            onClick={() => router.push('/customer/tracking')}
          >
            <span>Active deliveries</span>
            <strong>{metricState(jobsDataset, metrics.activeDeliveries.length)}</strong>
            <small>Transport currently moving</small>
          </button>
          <button
            className="customer-dash-metric"
            data-tone="navy"
            type="button"
            onClick={() => router.push('/customer/invoices')}
          >
            <span>Outstanding invoices</span>
            <strong>{metricState(invoicesDataset, metrics.unpaidInvoices.length)}</strong>
            <small>{invoicesDataset.availability !== 'available'
              ? 'Financial data unavailable'
              : invoicesDataset.partialData || invoicesDataset.limitedData
                ? 'Financial total partial'
                : money(metrics.unpaidValue)}</small>
          </button>
        </div>

        <div className="customer-dashboard-clean-grid">
          <section className="customer-dash-box">
            <div className="customer-dash-box__head">
              <strong>Needs your attention</strong>
            </div>
            <div className="customer-dash-box__body">
              {attentionItems.length ? (
                <div className="customer-attention-list">
                  {attentionItems.map((item) => (
                    <button
                      key={item.label}
                      className="customer-attention-row"
                      type="button"
                      onClick={() => router.push(item.route)}
                    >
                      <span className="customer-attention-row__copy">
                        <strong>{item.label}</strong>
                        <span>{item.detail}</span>
                      </span>
                      <span className="customer-attention-row__count">{item.count}</span>
                    </button>
                  ))}
                </div>
              ) : attentionUnavailable ? (
                <EmptyState
                  title="Attention data unavailable"
                  description="The dashboard cannot confirm that there are no customer actions until loads, quotes and invoices are available."
                />
              ) : attentionPartial ? (
                <EmptyState
                  title="Attention data is partial"
                  description="The visible records are incomplete, so the dashboard does not claim that there are no customer actions."
                />
              ) : (
                <EmptyState
                  title="Nothing needs attention"
                  description="There are no urgent customer actions right now."
                />
              )}
            </div>
          </section>
        </div>

        <section className="customer-dash-box">
          <div className="customer-dash-box__head">
            <strong>Recent transport</strong>
          </div>
          <div className="customer-dash-box__body">
            {metrics.recentJobs.length ? (
              <div className="customer-table-wrap">
                <table className="customer-transport-table">
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Route</th>
                      <th>Pickup</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.recentJobs.map((job) => {
                      const route = routeLabel(job);
                      const status = customerLifecycleLabel(job);
                      const action = customerJobAction(job);
                      return (
                        <tr key={job.id}>
                          <td>
                            <strong>XDL-{job.id.slice(0, 8).toUpperCase()}</strong>
                            <span>{job.customer_reference || job.booking_reference || 'No customer ref'}</span>
                          </td>
                          <td>
                            <strong>{route.from} → {route.to}</strong>
                          </td>
                          <td>{when(job.pickup_datetime)}</td>
                          <td><StatusBadge value={status} /></td>
                          <td>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <ActionButton
                                tone="secondary"
                                onClick={() => router.push(`${action.href}${action.href.includes('?') ? '&' : '?'}job=${job.id}`)}
                              >
                                {action.label}
                              </ActionButton>
                              <ActionButton
                                tone="secondary"
                                onClick={() => router.push(`/customer/messages?jobId=${encodeURIComponent(job.id)}`)}
                              >
                                Message
                              </ActionButton>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : jobsDataset.availability !== 'available' ? (
              <EmptyState
                title="Transport data unavailable"
                description="Recent transport cannot be confirmed until the jobs source is available."
              />
            ) : jobsDataset.partialData || jobsDataset.limitedData ? (
              <EmptyState
                title="Transport data is partial"
                description="The visible jobs dataset is incomplete, so the dashboard does not claim that there is no transport yet."
              />
            ) : (
              <EmptyState
                title="No transport yet"
                description="Post your first load when you are ready to request carrier quotes."
              />
            )}
          </div>
        </section>


      </div>
    </PageFrame>
  );
}
