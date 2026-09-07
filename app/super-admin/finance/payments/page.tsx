'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  company_name: string;
  invoice_id: string | null;
  amount: number;
  currency: string;
  status: string;
  settlement_method: string | null;
  external_reference: string | null;
  paid_at: string | null;
  created_at: string;
};

const formatMoney = (amount: number, currency: string | null | undefined) => {
  const code = (currency ?? 'GBP').toUpperCase();
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: code }).format(Number(amount) || 0);
  } catch {
    return `${code} ${(Number(amount) || 0).toFixed(2)}`;
  }
};

export default function Page() {
  return (
    <SuperAdminLiveTablePage<Row>
      icon="💳"
      title="Payment Ledger"
      sectionLabel="Finance"
      description="Canonical invoice payment-history ledger across all companies, paginated server-side with invoice payment state resolved separately."
      endpoint="/api/super-admin/finance?section=payments"
      summaryField="summary"
      emptyMessage="No payment records found."
      columns={[
        { key: 'company', label: 'Company', render: (row) => <span style={{ fontSize: '0.78rem' }}>{row.company_name}</span> },
        { key: 'amount', label: 'Amount', render: (row) => <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>{formatMoney(row.amount, row.currency)}</span> },
        { key: 'status', label: 'Invoice State', render: (row) => <StatusChip value={row.status} /> },
        { key: 'settlement_method', label: 'Method', render: (row) => <span style={{ fontSize: '0.75rem' }}>{row.settlement_method ?? '—'}</span> },
        { key: 'external_reference', label: 'Reference', render: (row) => <span style={{ fontSize: '0.72rem', fontFamily: 'monospace' }}>{row.external_reference ?? '—'}</span> },
        { key: 'paid_at', label: 'Paid at', render: (row) => <span style={{ fontSize: '0.75rem' }}>{formatDateTime(row.paid_at ?? row.created_at)}</span> },
      ]}
    />
  );
}
