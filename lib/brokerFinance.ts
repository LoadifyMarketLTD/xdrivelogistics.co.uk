type InvoiceLike = {
  company_id?: string | null;
  buyer_company_id?: string | null;
  supplier_company_id?: string | null;
  status?: string | null;
  payment_status?: string | null;
  amount?: number | null;
  net_amount?: number | null;
  vat_amount?: number | null;
  due_date?: string | null;
  invoice_date?: string | null;
};

const norm = (value: unknown) => String(value ?? '').trim().toLowerCase();
const moneyValue = (value: unknown) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export const isRevenueInvoice = (invoice: InvoiceLike, companyId: string | null): boolean => {
  if (!companyId || invoice.company_id !== companyId) return false;
  const status = norm(invoice.status);
  return !['draft', 'pending', 'cancelled'].includes(status);
};

export const isCarrierPayableInvoice = (invoice: InvoiceLike, companyId: string | null): boolean => {
  if (!companyId || invoice.buyer_company_id !== companyId) return false;
  if (!invoice.supplier_company_id || invoice.supplier_company_id === companyId) return false;
  const status = norm(invoice.status);
  return !['draft', 'pending', 'cancelled'].includes(status);
};

export const invoiceNetAmount = (invoice: InvoiceLike): number => {
  if (invoice.net_amount != null) return moneyValue(invoice.net_amount);
  const gross = moneyValue(invoice.amount);
  const vat = moneyValue(invoice.vat_amount);
  if (gross > 0 && vat >= 0 && gross >= vat) return gross - vat;
  return gross;
};

export const isAwaitingPayment = (invoice: InvoiceLike, now = Date.now()): boolean => {
  const payment = norm(invoice.payment_status);
  const status = norm(invoice.status);
  if (payment === 'paid' || status === 'paid') return false;
  if (['cancelled', 'draft', 'pending'].includes(status)) return false;
  if (!invoice.due_date) return true;
  const dueTime = new Date(invoice.due_date).getTime();
  if (!Number.isFinite(dueTime)) return true;
  return dueTime >= now;
};

export const isOverdue = (invoice: InvoiceLike, now = Date.now()): boolean => {
  const payment = norm(invoice.payment_status);
  const status = norm(invoice.status);
  if (payment === 'paid' || status === 'paid') return false;
  if (!invoice.due_date) return false;
  const dueTime = new Date(invoice.due_date).getTime();
  return Number.isFinite(dueTime) && dueTime < now;
};
