'use client';

import { useMemo, useState } from 'react';
import { useCompanyWorkspaceData } from '../../../components/workspace/useCompanyWorkspaceData';
import {
  ActionButton,
  DataTable,
  EmptyState,
  PageFrame,
  PageHeader,
  Panel,
  StatusBadge,
} from '../../../components/workspace/WorkspaceUI';

const csvCell = (value: string | number | null | undefined) =>
  `"${String(value ?? '').replace(/"/g, '""')}"`;

const downloadCsv = (
  filename: string,
  columns: string[],
  rows: Array<Array<string | number | null | undefined>>,
) => {
  const csv = [columns, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
};

const money = (value: number, currency = 'GBP') =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number.isFinite(value) ? value : 0);

const dateOnly = (value: string | null | undefined) => {
  if (!value) return 'Not set';
  const valueDate = new Date(value);
  return Number.isNaN(valueDate.getTime()) ? 'Not set' : valueDate.toLocaleDateString('en-GB');
};

const normalizedStatus = (status: string | null | undefined, paymentStatus: string | null | undefined) =>
  String(paymentStatus || status || 'unknown').trim().toLowerCase();

export default function FinanceStatementsPage() {
  const data = useCompanyWorkspaceData();
  const [counterparty, setCounterparty] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const counterparties = useMemo(
    () => [...new Set(data.invoices.map((invoice) => invoice.client_name?.trim()).filter((name): name is string => Boolean(name)))].sort((a, b) => a.localeCompare(b)),
    [data.invoices],
  );

  const rows = useMemo(() => {
    const from = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
    const to = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY;
    return data.invoices
      .filter((invoice) => counterparty === 'all' || (invoice.client_name?.trim() || 'Counterparty') === counterparty)
      .filter((invoice) => {
        const rawDate = invoice.invoice_date ?? invoice.created_at;
        const timestamp = new Date(rawDate).getTime();
        return Number.isFinite(timestamp) && timestamp >= from && timestamp <= to;
      })
      .sort((a, b) => String(a.invoice_date ?? a.created_at).localeCompare(String(b.invoice_date ?? b.created_at)));
  }, [counterparty, data.invoices, fromDate, toDate]);

  const totals = useMemo(() => {
    const invoiced = rows.reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0);
    const paid = rows
      .filter((invoice) => normalizedStatus(invoice.status, invoice.payment_status) === 'paid')
      .reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0);
    return { invoiced, paid, outstanding: Math.max(0, invoiced - paid) };
  }, [rows]);

  const exportStatement = () => {
    const label = counterparty === 'all' ? 'all-counterparties' : counterparty.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    downloadCsv(
      `xdrive-statement-${label || 'counterparty'}.csv`,
      ['Invoice', 'Job', 'Counterparty', 'Invoice date', 'Due date', 'Amount', 'Currency', 'Status'],
      rows.map((invoice) => [
        invoice.invoice_number ?? invoice.id,
        invoice.job_id ?? '',
        invoice.client_name ?? 'Counterparty',
        invoice.invoice_date ?? invoice.created_at,
        invoice.due_date ?? '',
        Number(invoice.amount ?? 0),
        invoice.currency ?? 'GBP',
        normalizedStatus(invoice.status, invoice.payment_status),
      ]),
    );
  };

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Finance / statements"
        title="Statements"
        description="Create a company-scoped invoice statement by counterparty and date range from the verified invoice register. This is an export view; it does not mutate invoice or payment state."
        actions={<ActionButton tone="secondary" disabled={rows.length === 0} onClick={exportStatement}>Export Statement CSV</ActionButton>}
      />

      <Panel title="Statement filters" description="Choose a counterparty and optional invoice-date window.">
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) repeat(2, minmax(160px, 0.6fr)) auto', gap: 8, alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: 4, fontSize: 11, fontWeight: 700, color: '#475569' }}>
            COUNTERPARTY
            <select value={counterparty} onChange={(event) => setCounterparty(event.target.value)} style={{ minHeight: 32, border: '1px solid #cbd5e1', borderRadius: 4, padding: '0 8px' }}>
              <option value="all">All counterparties</option>
              {counterparties.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 11, fontWeight: 700, color: '#475569' }}>
            FROM
            <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} style={{ minHeight: 32, border: '1px solid #cbd5e1', borderRadius: 4, padding: '0 8px' }} />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 11, fontWeight: 700, color: '#475569' }}>
            TO
            <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} style={{ minHeight: 32, border: '1px solid #cbd5e1', borderRadius: 4, padding: '0 8px' }} />
          </label>
          <ActionButton tone="secondary" onClick={() => { setCounterparty('all'); setFromDate(''); setToDate(''); }}>Clear</ActionButton>
        </div>
      </Panel>

      <div className="workspace-record-meta" style={{ justifyContent: 'space-between', marginTop: 8 }}>
        <span><strong>{rows.length}</strong> invoice{rows.length === 1 ? '' : 's'} in statement</span>
        <span>Invoiced {money(totals.invoiced)} · Paid {money(totals.paid)} · Outstanding {money(totals.outstanding)}</span>
      </div>

      <Panel title="Statement register" flush>
        <DataTable
          columns={['Invoice', 'Counterparty', 'Invoice date', 'Due', 'Amount', 'Status']}
          rows={rows.map((invoice) => [
            <strong key="invoice">{invoice.invoice_number ?? invoice.id.slice(0, 8).toUpperCase()}</strong>,
            invoice.client_name ?? 'Counterparty',
            dateOnly(invoice.invoice_date ?? invoice.created_at),
            dateOnly(invoice.due_date),
            money(Number(invoice.amount ?? 0), invoice.currency ?? 'GBP'),
            <StatusBadge key="status" value={normalizedStatus(invoice.status, invoice.payment_status)} />,
          ])}
          empty={<EmptyState title={data.loading ? 'Loading statement data…' : 'No invoices match this statement'} description="Adjust the counterparty or date range." />}
        />
      </Panel>
    </PageFrame>
  );
}
