/** Invoice Pro presentation input mapped from an authenticated XDrive invoice record. Read-only. */
export type XDriveInvoiceRecord = {
 invoice_number: string; job_ref: string; invoice_date: string;
 client_name: string; client_email?: string | null;
 amount: number; net_amount?: number | null; vat_rate: number;
 vat_amount?: number | null; vat_treatment?: string | null;
 due_date?: string | null; status: string;
 pickup_location?: string | null; delivery_location?: string | null;
};
export type InvoiceProPresentationRecord = {
 invoiceNo: string; jobRef: string; invoiceDate: string; dueDate: string;
 clientName: string; clientEmail: string; amount: number; vatRate: number;
 vat: number; total: number; status: string; pickup: string; delivery: string;
};
/** Pure conversion: no localStorage, no generated identifiers, no database mutations. */
export function toInvoiceProPresentation(record: XDriveInvoiceRecord): InvoiceProPresentationRecord {
 const net = record.net_amount ?? record.amount;
 if (!Number.isFinite(net) || net < 0 || !Number.isFinite(record.vat_rate)) throw new Error('Invalid invoice monetary fields.');
 const vat = record.vat_amount ?? Math.round(net * record.vat_rate) / 100;
 if (!Number.isFinite(vat) || vat < 0) throw new Error('Invalid invoice VAT.');
 if (!record.invoice_number) throw new Error('Invoice number is required.');
 return {
  invoiceNo: record.invoice_number, jobRef: record.job_ref, invoiceDate: record.invoice_date,
  dueDate: record.due_date ?? '', clientName: record.client_name?.trim() || 'Client not recorded',
  clientEmail: record.client_email ?? '', amount: net, vatRate: record.vat_rate,
  vat, total: Math.round((net + vat) * 100) / 100, status: record.status,
  pickup: record.pickup_location ?? '', delivery: record.delivery_location ?? '',
 };
}
