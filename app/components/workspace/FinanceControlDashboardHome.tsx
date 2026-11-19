'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { classifyWorkspaceJobStage, isCompanyExecutionJob } from '../../../lib/jobs/workspaceJobStage';
import { hasCompletePodEvidence } from '../../../lib/jobs/podCompletion';
import { classifyAccountsDirection } from '../../../lib/finance/accounts';
import { invoiceSignedGrossAmount } from '../../../lib/brokerFinance';
import {toCanonicalInvoiceStatus,toCanonicalPaymentStatus,isAwaitingPaymentInvoiceStatus,toCanonicalInvoiceDisplayStatus} from '../../../lib/invoiceStatus';
import type {WorkspaceInvoice} from './useCompanyWorkspaceData';
import { useCompanyWorkspaceData } from './useCompanyWorkspaceData';
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
import {
  metricValue,
  money,
  unavailable,
} from './AdminDashboardShared';

const xdriveReference = (jobId: string) => `XDL-${jobId.slice(0, 8).toUpperCase()}`;

export function isDashboardInvoiceAwaiting(invoice:WorkspaceInvoice){
 const status=toCanonicalInvoiceStatus(invoice.status);
 return invoice.document_type!=='credit_note'&&isAwaitingPaymentInvoiceStatus(status)&&!['paid','refunded'].includes(toCanonicalPaymentStatus(invoice.payment_status));
}
export function dashboardInvoiceValue(rows:WorkspaceInvoice[],outstanding:boolean){
 if(!rows.length)return money(0);
 if(rows.some(row=>row.currency?.toUpperCase()!=='GBP'||row.amount==null||!Number.isFinite(Number(row.amount))||(outstanding&&toCanonicalPaymentStatus(row.payment_status)==='partially_paid')))return 'See register';
 return money(rows.reduce((sum,row)=>sum+invoiceSignedGrossAmount(row),0));
}

export default function FinanceControlDashboardHome() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();

  const totals = useMemo(() => {
    const receivables = data.invoices.filter((invoice) => classifyAccountsDirection(invoice, data.companyId) === 'receivable');
    const payables = data.invoices.filter((invoice) => classifyAccountsDirection(invoice, data.companyId) === 'payable');
    const unpaid = receivables.filter(isDashboardInvoiceAwaiting);
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
    const paid = receivables.filter(invoice=>!['Draft','Cancelled'].includes(toCanonicalInvoiceStatus(invoice.status))&&toCanonicalPaymentStatus(invoice.payment_status)!=='refunded'&&toCanonicalInvoiceDisplayStatus(invoice.status,invoice.due_date,invoice.payment_status)==='Paid');
    const payableUnpaid = payables.filter(isDashboardInvoiceAwaiting);

    return {
      receivables,
      payables,
      unpaid,
      overdue,
      dueSoon,
      outstandingValue: dashboardInvoiceValue(unpaid,true),
      overdueValue: dashboardInvoiceValue(overdue,true),
      paidValue: dashboardInvoiceValue(paid,false),
      payableOutstandingValue: dashboardInvoiceValue(payableUnpaid,true),
      payableUnpaid,
      paid,
    };
  }, [data.companyId, data.invoices]);

  const issuedInvoiceJobIds = useMemo(
    () => new Set(
      data.invoices
        .filter((invoice) =>
          invoice.supplier_company_id === data.companyId
          || (
            invoice.company_id === data.companyId
            && invoice.buyer_company_id !== data.companyId
          ),
        )
        .map((invoice) => invoice.job_id)
        .filter((jobId): jobId is string => Boolean(jobId)),
    ),
    [data.companyId, data.invoices],
  );

  const readyToInvoice = useMemo(
    () => data.jobs
      .filter((job) => {
        const operatedByCurrentCompany = isCompanyExecutionJob(job, data.companyId)
          || (!job.awarded_carrier_company_id && !job.assigned_company_id && job.company_id === data.companyId);
        return operatedByCurrentCompany
          && classifyWorkspaceJobStage(job) === 'completed'
          && hasCompletePodEvidence(job)
          && !issuedInvoiceJobIds.has(job.id);
      })
      .sort((a, b) => String(b.updated_at ?? b.delivery_datetime ?? '').localeCompare(String(a.updated_at ?? a.delivery_datetime ?? ''))),
    [data.companyId, data.jobs, issuedInvoiceJobIds],
  );

  const outstandingSorted = [...totals.unpaid].sort((a, b) => {
    const aDue = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
    const bDue = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
    return aDue - bDue;
  });

  const invoicesUnavailable = unavailable(data, ['invoices']);
  const readyToInvoiceUnavailable = unavailable(data, ['jobs', 'invoices']);

  const openInvoiceDraft = (job: (typeof data.jobs)[number]) => {
    const params = new URLSearchParams({
      jobId: job.id,
      jobRef: xdriveReference(job.id),
      pickupLocation: job.pickup_location ?? '',
      pickupDateTime: job.pickup_datetime ?? '',
      deliveryLocation: job.delivery_location ?? '',
      deliveryDateTime: job.delivery_datetime ?? '',
      clientName: job.client_name ?? '',
      serviceDescription: `Transport job ${xdriveReference(job.id)}`,
    });
    router.push(`/admin/invoices/new?${params.toString()}`);
  };

  return (
    <div className="xdrive-admin-dashboard-home">
      {data.error ? <AlertBanner>{data.error}</AlertBanner> : null}

      <OperationalWorkspaceGrid
        asideLabel="Finance activity"
        main={
          <>
            <OperationalCard title="Reports & Statistics" subtitle="Live finance position, receivables and payables.">
              <OperationalSignalStrip
                ariaLabel="Finance operational signals"
                items={[
                  { key: 'ready-to-invoice', label: 'Ready to Invoice', value: metricValue(data, ['jobs', 'invoices'], () => readyToInvoice.length), detail: 'Completed work without invoice', tone: readyToInvoiceUnavailable ? 'blue' : readyToInvoice.length ? 'orange' : 'green' },
                  { key: 'draft', label: 'AR Draft', value: metricValue(data, ['invoices'], () => totals.receivables.filter((invoice) => ['draft', 'Draft'].includes(invoice.status)).length), detail: 'Receivables requiring issue', tone: invoicesUnavailable ? 'blue' : 'navy', onClick: () => router.push('/admin/finance/customer-invoices') },
                  { key: 'unpaid', label: 'Unpaid', value: metricValue(data, ['invoices'], () => totals.unpaid.length), detail: 'Awaiting payment', tone: invoicesUnavailable ? 'blue' : totals.unpaid.length ? 'orange' : 'green', onClick: () => router.push('/admin/invoices') },
                  { key: 'overdue', label: 'Overdue', value: metricValue(data, ['invoices'], () => totals.overdue.length), detail: 'Past due date', tone: invoicesUnavailable ? 'blue' : totals.overdue.length ? 'red' : 'green', onClick: () => router.push('/admin/invoices') },
                  { key: 'outstanding-value', label: 'AR Awaiting Payment', value: metricValue(data, ['invoices'], () => totals.outstandingValue), detail: 'Issued gross before credits', tone: invoicesUnavailable ? 'blue' : 'navy', onClick: () => router.push('/admin/finance/customer-invoices') },
                  { key: 'payable-value', label: 'AP Awaiting Payment', value: metricValue(data, ['invoices'], () => totals.payableOutstandingValue), detail: 'Issued gross before credits', tone: invoicesUnavailable ? 'blue' : 'orange', onClick: () => router.push('/admin/finance/carrier-invoices') },
                ]}
              />
            </OperationalCard>

            <div className="xdrive-owner-dashboard-subgrid">
              <OperationalCard title="Financial exposure" subtitle="Issued invoice values. Open the register for net balances, credits and partial payments.">
                <FinancialSummaryPanel
                  items={[
                    {
                      label: 'Issued AR awaiting payment',
                      detail: invoicesUnavailable ? 'Invoice data unavailable' : `${totals.unpaid.length} invoice(s)`,
                      value: metricValue(data, ['invoices'], () => totals.outstandingValue),
                      color: workspaceTheme.navy,
                      background: workspaceTheme.surfaceMuted,
                    },
                    {
                      label: 'Overdue invoice value',
                      detail: invoicesUnavailable ? 'Invoice data unavailable' : `${totals.overdue.length} invoice(s)`,
                      value: metricValue(data, ['invoices'], () => totals.overdueValue),
                      color: totals.overdue.length ? workspaceTheme.red : workspaceTheme.green,
                      background: totals.overdue.length ? '#FEF2F2' : '#F0FDF4',
                    },
                    {
                      label: 'Accounts Payable',
                      detail: invoicesUnavailable ? 'Invoice data unavailable' : `${totals.payableUnpaid.length} invoice(s)`,
                      value: metricValue(data, ['invoices'], () => totals.payableOutstandingValue),
                      color: workspaceTheme.orange,
                      background: '#FFF7ED',
                    },
                    {
                      label: 'Settled AR value',
                      detail: invoicesUnavailable ? 'Invoice data unavailable' : `${totals.paid.length} paid invoice(s)`,
                      value: metricValue(data, ['invoices'], () => totals.paidValue),
                      color: workspaceTheme.green,
                      background: '#F0FDF4',
                    },
                  ]}
                />
              </OperationalCard>

              <OperationalCard title="Reports" subtitle="Finance-only reporting and invoice routes.">
                <QuickActionGrid
                  actions={[
                    { key: 'ar', label: 'Accounts Receivable', onClick: () => router.push('/admin/finance/customer-invoices') },
                    { key: 'ap', label: 'Accounts Payable', onClick: () => router.push('/admin/finance/carrier-invoices') },
                    { key: 'invoices', label: 'Invoice register', onClick: () => router.push('/admin/invoices') },
                    { key: 'balances', label: 'Balances', onClick: () => router.push('/admin/finance/balances') },
                    { key: 'payments', label: 'Payments', onClick: () => router.push('/admin/finance/payments') },
                    { key: 'reports', label: 'Finance reports', onClick: () => router.push('/admin/finance/reports') },
                  ]}
                />
              </OperationalCard>
            </div>
          </>
        }
        aside={
          <>
            <OperationalCard
              title="Activity at a glance"
              subtitle="Completed transport operated by this company that is ready for an invoice."
              actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/jobs')}>View all</ActionButton>}
              flush
            >
              <DataTable
                columns={['Job', 'Route', 'Completed / updated', 'Invoice state', 'Action']}
                rows={readyToInvoice.slice(0, 12).map((job) => [
                  <strong key="job">{xdriveReference(job.id)}</strong>,
                  <strong key="route">{job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}</strong>,
                  job.updated_at || job.delivery_datetime
                    ? new Date(job.updated_at ?? job.delivery_datetime ?? '').toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
                    : 'Not recorded',
                  <StatusBadge key="state" value="Ready to Invoice" tone="orange" />,
                  <ActionButton key="create" tone="success" onClick={() => openInvoiceDraft(job)}>Create invoice</ActionButton>,
                ])}
                empty={<EmptyState compact title={readyToInvoiceUnavailable ? 'Invoice readiness data unavailable' : 'No completed jobs waiting for an invoice'} />}
              />
            </OperationalCard>

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
                  dashboardInvoiceValue([invoice],false),
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
                  dashboardInvoiceValue([invoice],false),
                  <StatusBadge key="status" value="paid" tone="green" />,
                ])}
                empty={<EmptyState compact title={invoicesUnavailable ? 'Invoice data unavailable' : 'No settled invoices'} />}
              />
            </OperationalCard>
          </>
        }
      />
    </div>
  );
}
