'use client';

import { useMemo, useState } from 'react';
import { useCompanyWorkspaceData } from '../../components/workspace/useCompanyWorkspaceData';
import { ActionButton, AlertBanner, DataTable, EmptyState, PageFrame, PageHeader, StatusBadge } from '../../components/workspace/WorkspaceUI';

const money = (value: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);

export default function BrokerMarginsPage() {
  const data = useCompanyWorkspaceData();
  const [customer, setCustomer] = useState('');
  const [reference, setReference] = useState('');

  const rows = useMemo(() => data.jobs.map((job) => {
    const acceptedBid = data.bids.find((bid) => bid.job_id === job.id && bid.status === 'accepted');
    const submitted = data.bids.filter((bid) => bid.job_id === job.id && bid.status === 'submitted');
    const submittedPrices = submitted
      .map((bid) => Number(bid.bid_price_gbp ?? bid.amount ?? 0))
      .filter((value) => Number.isFinite(value) && value > 0);
    const estimatedCost = acceptedBid
      ? Number(acceptedBid.bid_price_gbp ?? acceptedBid.amount ?? 0)
      : submittedPrices.length ? Math.min(...submittedPrices) : 0;
    const estimatedRevenue = Number(job.budget_amount ?? 0);
    const estimatedMargin = estimatedRevenue - estimatedCost;
    const estimatedMarginPct = estimatedRevenue > 0 ? (estimatedMargin / estimatedRevenue) * 100 : 0;
    return { job, estimatedRevenue, estimatedCost, estimatedMargin, estimatedMarginPct, accepted: Boolean(acceptedBid) };
  }), [data.bids, data.jobs]);

  const visible = useMemo(() => {
    const customerNeedle = customer.trim().toLowerCase();
    const referenceNeedle = reference.trim().toLowerCase();
    return rows.filter(({ job }) => {
      if (customerNeedle && !String(job.client_name ?? '').toLowerCase().includes(customerNeedle)) return false;
      if (referenceNeedle && !`${job.id} ${job.customer_reference ?? ''} ${job.booking_reference ?? ''}`.toLowerCase().includes(referenceNeedle)) return false;
      return true;
    });
  }, [customer, reference, rows]);

  const totals = useMemo(() => visible.reduce((acc, row) => ({
    revenue: acc.revenue + row.estimatedRevenue,
    cost: acc.cost + row.estimatedCost,
    margin: acc.margin + row.estimatedMargin,
  }), { revenue: 0, cost: 0, margin: 0 }), [visible]);

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Broker finance"
        title="Estimated Margin"
        description="Estimate-only view using recorded customer budget and accepted or lowest submitted carrier quote. It is not invoiced accounting."
        actions={<ActionButton tone="secondary" onClick={() => void data.refresh()}>Refresh</ActionButton>}
      />
      {data.error && <AlertBanner>{data.error}</AlertBanner>}

      <div className="workspace-board-layout">
        <aside className="workspace-filter-rail" aria-label="Margin filters">
          <div className="workspace-filter-rail__header">Search Margins</div>
          <div className="workspace-filter-rail__body">
            <label>CUSTOMER<input value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="Customer name" /></label>
            <label>LOAD / REF<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Load or reference" /></label>
            <div style={{ fontSize: 11, lineHeight: '15px', color: '#64748b' }}>Values remain estimates until a commercial agreement/invoice exists. No accounting figures are fabricated.</div>
            <ActionButton tone="secondary" onClick={() => { setCustomer(''); setReference(''); }}>Clear</ActionButton>
          </div>
        </aside>

        <main style={{ minWidth: 0 }}>
          <div className="workspace-record-meta" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
            <span><strong>{visible.length}</strong> load{visible.length === 1 ? '' : 's'}</span>
            <span>Budget {money(totals.revenue)} · Carrier estimate {money(totals.cost)} · Estimated margin {money(totals.margin)}</span>
          </div>
          <div className="workspace-panel">
            <DataTable
              columns={['Load', 'Customer', 'Budget (est.)', 'Carrier cost (est.)', 'Estimated margin', 'Margin %', 'Basis']}
              rows={visible.map(({ job, estimatedRevenue, estimatedCost, estimatedMargin, estimatedMarginPct, accepted }) => [
                job.id.slice(0, 8).toUpperCase(),
                job.client_name ?? 'Customer',
                money(estimatedRevenue),
                estimatedCost > 0 ? money(estimatedCost) : 'Not quoted',
                <strong key="margin" style={{ color: estimatedMargin >= 0 ? '#15803d' : '#b91c1c' }}>{money(estimatedMargin)}</strong>,
                estimatedRevenue > 0 ? `${estimatedMarginPct.toFixed(1)}%` : '—',
                <StatusBadge key="basis" value={accepted ? 'accepted quote' : estimatedCost > 0 ? 'lowest submitted quote' : 'no carrier quote'} tone={accepted ? 'green' : estimatedCost > 0 ? 'blue' : 'grey'} />,
              ])}
              empty={<EmptyState title={data.loading ? 'Loading margin estimates…' : 'No matching loads'} description="Adjust the filters or create a customer load." />}
            />
          </div>
        </main>
      </div>
    </PageFrame>
  );
}
