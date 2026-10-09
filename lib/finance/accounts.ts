export type AccountsDirection = 'receivable' | 'payable';
export type AgingBucket = 'current' | '1_30' | '31_60' | '61_90' | '90_plus' | 'no_due_date';

export type InvoiceOwnership = {
  company_id?: string | null;
  buyer_company_id?: string | null;
  supplier_company_id?: string | null;
};

const clean = (value: unknown) => String(value ?? '').trim();

export function classifyAccountsDirection(
  invoice: InvoiceOwnership,
  companyId: string | null | undefined,
): AccountsDirection | null {
  const currentCompanyId = clean(companyId);
  if (!currentCompanyId) return null;
  const supplierCompanyId = clean(invoice.supplier_company_id);
  const buyerCompanyId = clean(invoice.buyer_company_id);
  const legacyCompanyId = clean(invoice.company_id);

  if (supplierCompanyId === currentCompanyId) return 'receivable';
  if (buyerCompanyId === currentCompanyId) return 'payable';
  if (!supplierCompanyId && legacyCompanyId === currentCompanyId && buyerCompanyId !== currentCompanyId) return 'receivable';
  return null;
}

export function invoiceAgingBucket(
  dueDate: string | null | undefined,
  outstandingAmount: number,
  nowMs = Date.now(),
): AgingBucket {
  if (!(outstandingAmount > 0)) return 'current';
  if (!dueDate) return 'no_due_date';
  const dueMs = new Date(dueDate).getTime();
  if (!Number.isFinite(dueMs)) return 'no_due_date';
  const overdueDays = Math.floor((nowMs - dueMs) / 86_400_000);
  if (overdueDays <= 0) return 'current';
  if (overdueDays <= 30) return '1_30';
  if (overdueDays <= 60) return '31_60';
  if (overdueDays <= 90) return '61_90';
  return '90_plus';
}

export const AGING_BUCKET_LABELS: Record<AgingBucket, string> = {
  current: 'Current',
  '1_30': '1–30 days',
  '31_60': '31–60 days',
  '61_90': '61–90 days',
  '90_plus': '90+ days',
  no_due_date: 'No due date',
};
