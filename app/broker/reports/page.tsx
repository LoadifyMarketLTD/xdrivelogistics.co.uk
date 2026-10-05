'use client';

import { useMemo } from 'react';
import { useCompanyWorkspaceData } from '../../components/workspace/useCompanyWorkspaceData';
import { ActionButton, AlertBanner, DataTable, EmptyState, PageFrame, PageHeader } from '../../components/workspace/WorkspaceUI';
import { downloadXlsx } from '../../../lib/spreadsheetExport';

const money = (value: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);

export default function BrokerReportsPage() {
  const data = useCompanyWorkspaceData();
  const rows = useMemo(() => data.jobs.map((job) => {
    const acceptedBid = data.bids.find((bid) => bid.job_id === job.id && bid.status === 'accepted');
    const revenue = Number(job.budget_amount ?? 0);
    const carrierCost = Number(acceptedBid?.bid_price_gbp ?? acceptedBid?.amount ?? 0);
    const margin = revenue - carrierCost;
    return {
      reference: job.customer_reference || job.booking_reference || `XDL-${job.id.slice(0, 8).toUpperCase()}`,
      customer: job.client_name || 'Customer',
      status: job.current_status || job.status || 'unknown',
      revenue,
      carrierCost,
      margin,
    };
  }), [data.bids, data.jobs]);

  const totals = useMemo(() => rows.reduce((acc, row) => ({
    revenue: acc.revenue + row.revenue,
    carrierCost: acc.carrierCost + row.carrierCost,
    margin: acc.margin + row.margin,
  }), { revenue: 0, carrierCost: 0, margin: 0 }), [rows]);

  const incomplete = [data.datasets.jobs, data.datasets.bids].some((dataset) =>
    dataset.availability !== 'available' || dataset.partialData || dataset.limitedData,
  );

  const exportXlsx = () => {
    if (incomplete || rows.length === 0) return;
    return downloadXlsx(
      `xdrive-broker-report-${new Date().toISOString().slice(0, 10)}.xlsx`,
      [{
        name: 'Broker Report',
        title: 'Broker Commercial Report',
        subtitle: data.companyId
          ? `Company scope ${data.companyId} · generated ${new Date().toLocaleString('en-GB')}`
          : `Generated ${new Date().toLocaleString('en-GB')}`,
        columns: [
          { header: 'Reference', key: 'reference', width: 22 },
          { header: 'Customer', key: 'customer', width: 28 },
          { header: 'Status', key: 'status', width: 18 },
          { header: 'Customer revenue', key: 'revenue', width: 18, format: 'currency' as const },
          { header: 'Carrier cost', key: 'carrierCost', width: 18, format: 'currency' as const },
          { header: 'Margin', key: 'margin', width: 18, format: 'currency' as const },
        ],
        rows,
      }],
    );
  };

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Broker reporting"
        title="Reports & Exports"
        description="Company-scoped broker performance using recorded customer budgets and accepted carrier quotes."
        actions={<>
          <ActionButton tone="secondary" onClick={() => void data.refresh()}>Refresh</ActionButton>
          <ActionButton tone="secondary" disabled={incomplete || rows.length === 0} onClick={() => void exportXlsx()}>Export XLSX</ActionButton>
        </>}
      />
      {data.error ? <AlertBanner tone="danger">{data.error}</AlertBanner> : null}
      {incomplete ? <AlertBanner tone="warning">Report data is unavailable or partial. Exact totals and XLSX export remain disabled until jobs and carrier quotes are complete.</AlertBanner> : null}
      <div className="workspace-record-meta" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <span><strong>{incomplete ? 'Partial' : rows.length}</strong> reported job{!incomplete && rows.length === 1 ? '' : 's'}</span>
        <span>{incomplete ? 'Exact totals unavailable' : `Revenue ${money(totals.revenue)} · Carrier cost ${money(totals.carrierCost)} · Margin ${money(totals.margin)}`}</span>
      </div>
      <div className="workspace-panel">
        <DataTable
          columns={['Reference', 'Customer', 'Status', 'Revenue', 'Carrier cost', 'Margin']}
          rows={rows.map((row) => [row.reference, row.customer, row.status, money(row.revenue), money(row.carrierCost), money(row.margin)])}
          empty={<EmptyState title={data.loading ? 'Loading broker report…' : 'No reportable jobs'} description="Customer loads will appear here once they enter the broker workflow." />}
        />
      </div>
    </PageFrame>
  );
}
