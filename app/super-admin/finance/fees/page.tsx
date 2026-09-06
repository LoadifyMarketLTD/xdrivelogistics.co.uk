'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { StatusChip } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  invoice_number: string;
  company_name: string;
  amount: number;
  net_amount: number;
  vat_amount: number;
  vat_rate: number;
  currency: string;
  status: string;
  invoice_date: string;
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
      icon="💷"
      title="Invoice Financial Breakdown"
      sectionLabel="Finance"
      description="Cross-company invoice financial evidence with net, VAT, total and canonical payment state. Monetary totals are not combined across currencies on this registry."
      endpoint="/api/super-admin/finance?section=fees"
      summaryField="summary"
      emptyMessage="No invoice financial records found."
      columns={[
        { key: 'invoice_number', label: 'Invoice #', render: (row) => <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>{row.invoice_number}</span> },
        { key: 'company', label: 'Company', render: (row) => <span style={{ fontSize: '0.78rem' }}>{row.company_name}</span> },
        { key: 'status', label: 'Payment State', render: (row) => <StatusChip value={row.status} /> },
        { key: 'net_amount', label: 'Net', render: (row) => <span style={{ fontSize: '0.8rem' }}>{formatMoney(row.net_amount, row.currency)}</span> },
        {
          key: 'vat_amount', label: 'VAT', render: (row) => (
            <span style={{ fontSize: '0.8rem' }}>
              {formatMoney(row.vat_amount, row.currency)}
              {row.vat_rate > 0 && <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}> ({row.vat_rate}%)</span>}
            </span>
          ),
        },
        { key: 'amount', label: 'Total', render: (row) => <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>{formatMoney(row.amount, row.currency)}</span> },
        { key: 'invoice_date', label: 'Date', render: (row) => <span style={{ fontSize: '0.75rem' }}>{row.invoice_date ?? '—'}</span> },
      ]}
    />
  );
}
