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
  status: string;
  invoice_date: string;
  created_at: string;
};

export default function Page() {
  return (
    <SuperAdminLiveTablePage<Row>
      icon="💷"
      title="Platform Fees"
      sectionLabel="Finance"
      description="Platform fee visibility — VAT collected and net amounts across all company invoices."
      endpoint="/api/super-admin/finance?section=fees&limit=250"
      summaryField="summary"
      emptyMessage="No fee records found."
      columns={[
        {
          key: 'invoice_number',
          label: 'Invoice #',
          render: (row) => (
            <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>{row.invoice_number}</span>
          ),
        },
        {
          key: 'company',
          label: 'Company',
          render: (row) => <span style={{ fontSize: '0.78rem' }}>{row.company_name}</span>,
        },
        {
          key: 'status',
          label: 'Status',
          render: (row) => <StatusChip value={row.status} />,
        },
        {
          key: 'net_amount',
          label: 'Net',
          render: (row) => (
            <span style={{ fontSize: '0.8rem' }}>£{Number(row.net_amount).toFixed(2)}</span>
          ),
        },
        {
          key: 'vat_amount',
          label: 'VAT',
          render: (row) => (
            <span style={{ fontSize: '0.8rem' }}>
              £{Number(row.vat_amount).toFixed(2)}
              {row.vat_rate > 0 && (
                <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}> ({row.vat_rate}%)</span>
              )}
            </span>
          ),
        },
        {
          key: 'amount',
          label: 'Total',
          render: (row) => (
            <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>£{Number(row.amount).toFixed(2)}</span>
          ),
        },
        {
          key: 'invoice_date',
          label: 'Date',
          render: (row) => <span style={{ fontSize: '0.75rem' }}>{row.invoice_date ?? '—'}</span>,
        },
      ]}
    />
  );
}
