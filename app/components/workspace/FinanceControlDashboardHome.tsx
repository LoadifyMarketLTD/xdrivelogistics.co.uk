'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getWorkspaceDatasetMetricValue, useCompanyWorkspaceData } from './useCompanyWorkspaceData';
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
} from './WorkspaceUI';
import { OperationalSignalStrip, OperationalWorkspaceGrid } from './OperationalConvergence';
import { DashboardHomeHeader } from './DashboardHomePrimitives';
import {
  metricValue,
  money,
  unavailable,
} from './AdminDashboardShared';

export default function FinanceControlDashboardHome() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();

  const totals = useMemo(() => {
    const unpaid = data.invoices.filter(
      (invoice) =>
        invoice.payment_status !== 'paid' &&
        !['paid', 'Paid', 'void', 'cancelled'].includes(invoice.status),
    );
    const overdue = unpaid.filter(
      (invoice) =>
        invoice.due_date && new Date(invoice.due_date).getTime() < Date.now(),
    );
    const dueSoon = unpaid.filter(
      (invoice) =>
        invoice.due_date &&
        new Date(invoice.due_date).getTime() >= Date.now() &&
        new Date(invoice.due_date).getTime() <= Date.now() + 7 * 86_400_000,
    );
    const paid = data.invoices.filter(
      (invoice) => invoice.payment_status === 'paid' || ['paid', 'Paid'].includes(invoice.status),
    );

    return {
      unpaid,
      overdue,
      dueSoon,
      outstandingValue: unpaid.reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0),
      overdueValue: overdue.reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0),
      paidValue: paid.reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0),
      paid,
    };
  }, [data.invoices]);

  const outstandingSorted = [...totals.unpaid].sort((a, b) => {
    const aDue = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
    const bDue = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
    return aDue - bDue;
  });

  const invoicesUnavailable = unavailable(data, ['invoices']);

  return (
    <div style={{ width: '100%', padding: '12px 12px 16px' }}>
      <DashboardHomeHeader
        eyebrow="Finance control"
        title="Finance Dashboard"
        badge="Receivables"
        description="Invoice issuance, due dates, overdue exposure and settlement. Operational state changes are intentionally outside the finance dashboard."
        actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/invoices')}>Open Invoices</ActionButton>}
      />

      {data.error ? <AlertBanner>{data.error}</AlertBanner> : null}

      <OperationalSignalStrip
        ariaLabel="Finance operational signals"
        items={[
          { key: 'draft', label: 'Draft', value: getWorkspaceDatasetMetricValue(data.datasets.invoices, (rows) => rows.filter((invoice) => ['draft', 'Draft'].includes(invoice.status)).length), detail: 'Requires issue', tone: invoicesUnavailable ? 'blue' : 'navy', onClick: () => router.push('/admin/invoices') },
          { key: 'unpaid', label: 'Unpaid', value: metricValue(data, ['invoices'], () => totals.unpaid.length), detail: 'Awaiting payment', tone: invoicesUnavailable ? 'blue' : totals.unpaid.length ? 'orange' : 'green', onClick: () => router.push('/admin/invoices') },
          { key: 'overdue', label: 'Overdue', value: metricValue(data, ['invoices'], () => totals.overdue.length), detail: 'Past due date', tone: invoicesUnavailable ? 'blue' : totals.overdue.length ? 'red' : 'green', onClick: () => router.push('/admin/invoices') },
          { key: 'due-soon', label: 'Due 7d', value: metricValue(data, ['invoices'], () => totals.dueSoon.length), detail: 'Upcoming receivables', tone: invoicesUnavailable ? 'blue' : totals.dueSoon.length ? 'orange' : 'navy', onClick: () => router.push('/admin/invoices') },
          { key: 'outstanding-value', label: 'Outstanding', value: metricValue(data, ['invoices'], () => money(totals.outstandingValue)), detail: 'Unpaid balance', tone: invoicesUnavailable ? 'blue' : 'navy', onClick: () => router.push('/admin/invoices') },
          { key: 'paid-value', label: 'Paid', value: metricValue(data, ['invoices'], () => money(totals.paidValue)), detail: 'Settled invoices', tone: invoicesUnavailable ? 'blue' : 'green', onClick: () => router.push('/admin/invoices') },
        ]}
      />

      <OperationalWorkspaceGrid
        asideLabel="Finance exposure and actions"
        main={
          <>
            <OperationalCard
              title="Receivables requiring attention"
              subtitle="Overdue and near-due invoices are ordered by due date."
              actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/invoices')}>Invoice register</ActionButton>}
              flush
            >
              <DataTable
                columns={['Invoice', 'Client', 'Amount', 'Due', 'Status']}
                rows={outstandingSorted.slice(0, 12).map((invoice) => [
                  invoice.invoice_number ?? invoice.id.slice(0, 8).toUpperCase(),
                  invoice.client_name ?? 'Client',
                  money(Number(invoice.amount ?? 0)),
                  invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-GB') : 'Not set',
                  <StatusBadge
                    key="status"
                    value={invoice.payment_status ?? invoice.status}
                    tone={totals.overdue.includes(invoice) ? 'red' : totals.dueSoon.includes(invoice) ? 'orange' : undefined}
                  />,
                ])}
                empty={<EmptyState compact title={invoicesUnavailable ? 'Invoice data unavailable' : 'No outstanding receivables'} />}
              />
            </OperationalCard>

            <OperationalCard title="Recently settled" subtitle="Latest paid invoices." flush>
              <DataTable
                columns={['Invoice', 'Amount', 'Status']}
                rows={totals.paid.slice(0, 5).map((invoice) => [
                  invoice.invoice_number ?? invoice.id.slice(0, 8).toUpperCase(),
                  money(Number(invoice.amount ?? 0)),
                  <StatusBadge key="status" value="paid" tone="green" />,
                ])}
                empty={<EmptyState compact title={invoicesUnavailable ? 'Invoice data unavailable' : 'No settled invoices'} />}
              />
            </OperationalCard>
          </>
        }
        aside={
          <div style={{ display: 'grid', gap: '12px' }}>
            <OperationalCard title="Financial exposure" subtitle="Amounts that need finance attention.">
              <FinancialSummaryPanel
                items={[
                  {
                    label: 'Outstanding',
                    detail: invoicesUnavailable ? 'Invoice data unavailable' : `${totals.unpaid.length} invoice(s)`,
                    value: metricValue(data, ['invoices'], () => money(totals.outstandingValue)),
                    color: workspaceTheme.navy,
                    background: workspaceTheme.surfaceMuted,
                  },
                  {
                    label: 'Overdue exposure',
                    detail: invoicesUnavailable ? 'Invoice data unavailable' : `${totals.overdue.length} invoice(s)`,
                    value: metricValue(data, ['invoices'], () => money(totals.overdueValue)),
                    color: totals.overdue.length ? workspaceTheme.red : workspaceTheme.green,
                    background: totals.overdue.length ? '#FEF2F2' : '#F0FDF4',
                  },
                  {
                    label: 'Settled value',
                    detail: invoicesUnavailable ? 'Invoice data unavailable' : `${totals.paid.length} paid invoice(s)`,
                    value: metricValue(data, ['invoices'], () => money(totals.paidValue)),
                    color: workspaceTheme.green,
                    background: '#F0FDF4',
                  },
                ]}
              />
            </OperationalCard>

            <OperationalCard title="Finance actions" subtitle="Finance-only reporting and invoice routes.">
              <QuickActionGrid
                actions={[
                  { key: 'invoices', label: 'Invoice register', onClick: () => router.push('/admin/invoices') },
                  { key: 'balances', label: 'Balances', onClick: () => router.push('/admin/finance/balances') },
                  { key: 'payments', label: 'Payments', onClick: () => router.push('/admin/finance/payments') },
                  { key: 'reports', label: 'Finance reports', onClick: () => router.push('/admin/finance/reports') },
                  { key: 'jobs', label: 'Job reference view', onClick: () => router.push('/admin/jobs') },
                ]}
              />
            </OperationalCard>
          </div>
        }
      />
    </div>
  );
}
