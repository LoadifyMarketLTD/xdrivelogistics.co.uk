'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  KpiCard,
  KpiGrid,
  PageFrame,
  PageHeader,
  Panel,
  StatusBadge,
  TwoColumn,
} from './WorkspaceUI';

type Invoice = {
  id: string;
  invoice_number: string | null;
  job_id: string | null;
  client_name: string | null;
  client_email: string | null;
  invoice_date: string | null;
  due_date: string | null;
  status: string;
  payment_status: string | null;
  amount: number | null;
  net_amount: number | null;
  vat_amount: number | null;
  vat_rate: number | null;
  currency: string | null;
  pickup_location: string | null;
  delivery_location: string | null;
  service_description: string | null;
  payment_terms: string | null;
};

type History = { id: string; from_status: string | null; to_status: string; note: string | null; changed_at: string };
type Payment = { id: string; amount: number; currency: string; paid_at: string; settlement_method: string; external_reference: string | null };
type Dispute = { id: string; reason: string; details: string | null; status: string; resolution_note: string | null; created_at: string };
type Document = { id: string; doc_type: string; file_url: string; file_name: string | null; file_size_bytes: number | null; created_at: string };

const currency = (value: number | null | undefined, code = 'GBP') =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: code }).format(Number(value ?? 0));
const date = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not set';
const dateTime = (value: string) =>
  new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export default function InvoiceDetailPage({
  invoiceId,
  backHref,
  titlePrefix = 'Invoice',
}: {
  invoiceId: string;
  backHref: string;
  titlePrefix?: string;
}) {
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [history, setHistory] = useState<History[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setError('Your session has expired. Please sign in again.');
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`/api/finance/invoices/${invoiceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        invoice?: Invoice;
        statusHistory?: History[];
        payments?: Payment[];
        disputes?: Dispute[];
        documents?: Document[];
      } | null;
      if (!response.ok || !payload?.invoice) throw new Error(payload?.error ?? 'Invoice could not be loaded.');
      setInvoice(payload.invoice);
      setHistory(payload.statusHistory ?? []);
      setPayments(payload.payments ?? []);
      setDisputes(payload.disputes ?? []);
      setDocuments(payload.documents ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Invoice could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => { void load(); }, [load]);

  const paid = useMemo(() => payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0), [payments]);
  const code = invoice?.currency ?? 'GBP';
  const outstanding = Math.max(0, Number(invoice?.amount ?? 0) - paid);

  if (loading) return <PageFrame><EmptyState title="Loading invoice…" /></PageFrame>;

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Finance workspace"
        title={invoice ? `${titlePrefix} ${invoice.invoice_number ?? invoice.id.slice(0, 8).toUpperCase()}` : titlePrefix}
        description="Commercial amount, payment state, supporting documents and audit history in one authorised view."
        actions={
          <>
            <ActionButton tone="secondary" onClick={() => router.push(backHref)}>Back to register</ActionButton>
            <ActionButton tone="secondary" onClick={() => window.print()}>Print</ActionButton>
            <ActionButton tone="secondary" onClick={() => void load()}>Refresh</ActionButton>
          </>
        }
      />

      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      {!invoice ? <Panel><EmptyState title="Invoice not available" /></Panel> : (
        <>
          <KpiGrid>
            <KpiCard label="Invoice total" value={currency(invoice.amount, code)} tone="navy" />
            <KpiCard label="Paid" value={currency(paid, code)} tone="green" />
            <KpiCard label="Outstanding" value={currency(outstanding, code)} tone={outstanding > 0 ? 'orange' : 'green'} />
            <KpiCard label="Invoice status" value={<span style={{ fontSize: '1rem' }}>{invoice.status}</span>} tone="blue" />
            <KpiCard label="Payment status" value={<span style={{ fontSize: '1rem' }}>{invoice.payment_status ?? 'unpaid'}</span>} tone={invoice.payment_status === 'paid' ? 'green' : 'orange'} />
          </KpiGrid>

          <TwoColumn>
            <div style={{ display: 'grid', gap: '0.9rem' }}>
              <Panel title="Invoice summary">
                <DataTable
                  columns={['Field', 'Value']}
                  rows={[
                    ['Customer', invoice.client_name ?? 'Not set'],
                    ['Email', invoice.client_email ?? 'Not set'],
                    ['Invoice date', date(invoice.invoice_date)],
                    ['Due date', date(invoice.due_date)],
                    ['Payment terms', invoice.payment_terms ?? 'Not set'],
                    ['Route', `${invoice.pickup_location ?? 'Collection'} → ${invoice.delivery_location ?? 'Delivery'}`],
                    ['Service', invoice.service_description ?? 'Logistics service'],
                    ['Net', currency(invoice.net_amount, code)],
                    [`VAT ${invoice.vat_rate ?? 0}%`, currency(invoice.vat_amount, code)],
                    ['Total', currency(invoice.amount, code)],
                  ]}
                />
              </Panel>

              <Panel title="Documents" description="Files attached to this invoice by the authorised trading party.">
                <DataTable
                  columns={['Document', 'Type', 'Added', 'Action']}
                  rows={documents.map((document) => [
                    document.file_name ?? 'Document',
                    document.doc_type.replace(/_/g, ' '),
                    dateTime(document.created_at),
                    <ActionButton key="open" tone="secondary" onClick={() => window.open(document.file_url, '_blank', 'noopener,noreferrer')}>Open</ActionButton>,
                  ])}
                  empty={<EmptyState title="No invoice documents attached" />}
                />
              </Panel>
            </div>

            <div style={{ display: 'grid', gap: '0.9rem' }}>
              <Panel title="Status timeline">
                <DataTable
                  columns={['Transition', 'Time', 'Note']}
                  rows={history.map((item) => [
                    `${item.from_status ?? 'Created'} → ${item.to_status}`,
                    dateTime(item.changed_at),
                    item.note ?? '—',
                  ])}
                  empty={<EmptyState title="No status history" />}
                />
              </Panel>

              <Panel title="Payment records">
                <DataTable
                  columns={['Amount', 'Method', 'Date', 'Reference']}
                  rows={payments.map((payment) => [
                    currency(payment.amount, payment.currency),
                    payment.settlement_method.replace(/_/g, ' '),
                    date(payment.paid_at),
                    payment.external_reference ?? '—',
                  ])}
                  empty={<EmptyState title="No payment records" />}
                />
              </Panel>

              <Panel title="Disputes">
                <DataTable
                  columns={['Reason', 'Opened', 'Status', 'Resolution']}
                  rows={disputes.map((dispute) => [
                    dispute.reason,
                    dateTime(dispute.created_at),
                    <StatusBadge key="status" value={dispute.status} />,
                    dispute.resolution_note ?? dispute.details ?? 'Pending',
                  ])}
                  empty={<EmptyState title="No disputes" />}
                />
              </Panel>
            </div>
          </TwoColumn>
        </>
      )}
    </PageFrame>
  );
}
