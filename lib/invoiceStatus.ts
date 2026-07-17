export const CANONICAL_INVOICE_STATUSES = [
  'Draft',
  'Sent',
  'Overdue',
  'Paid',
  'Disputed',
  'Cancelled',
] as const;

export type CanonicalInvoiceStatus = (typeof CANONICAL_INVOICE_STATUSES)[number];
export const CANONICAL_PAYMENT_STATUSES = [
  'unpaid',
  'partially_paid',
  'paid',
  'overdue',
  'disputed',
  'refunded',
] as const;
export type CanonicalPaymentStatus = (typeof CANONICAL_PAYMENT_STATUSES)[number];

export const LEGACY_INVOICE_STATUSES = ['Pending', 'Submitted', 'Approved'] as const;
export type LegacyInvoiceStatus = (typeof LEGACY_INVOICE_STATUSES)[number];

export type AnyInvoiceStatus = CanonicalInvoiceStatus | LegacyInvoiceStatus;

const LEGACY_TO_CANONICAL: Record<LegacyInvoiceStatus, CanonicalInvoiceStatus> = {
  Pending: 'Draft',
  Submitted: 'Sent',
  Approved: 'Sent',
};

const CANONICAL_TO_LEGACY: Partial<Record<CanonicalInvoiceStatus, AnyInvoiceStatus>> = {
  Draft: 'Pending',
  Sent: 'Submitted',
  Overdue: 'Overdue',
  Paid: 'Paid',
  Disputed: 'Disputed',
};

export const toCanonicalInvoiceStatus = (
  value: string | null | undefined,
  fallback: CanonicalInvoiceStatus = 'Draft'
): CanonicalInvoiceStatus => {
  if (!value) return fallback;

  const normalized = value.toLowerCase();
  const canonicalMatch = CANONICAL_INVOICE_STATUSES.find((status) => status.toLowerCase() === normalized);
  if (canonicalMatch) return canonicalMatch;

  const legacyMatch = LEGACY_INVOICE_STATUSES.find((status) => status.toLowerCase() === normalized);
  if (legacyMatch) return LEGACY_TO_CANONICAL[legacyMatch];

  return fallback;
};

export const toLegacyInvoiceStatusForDb = (value: CanonicalInvoiceStatus): AnyInvoiceStatus =>
  CANONICAL_TO_LEGACY[value] ?? value;

export const toCanonicalInvoiceStatusWithDueDate = (
  value: string | null | undefined,
  dueDate: string | null | undefined
): CanonicalInvoiceStatus => {
  const canonical = toCanonicalInvoiceStatus(value);
  if (canonical === 'Paid' || canonical === 'Disputed' || canonical === 'Cancelled') return canonical;
  if (canonical === 'Draft') return canonical;
  if (!dueDate) return canonical;

  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return canonical;
  return new Date() > due ? 'Overdue' : canonical;
};

export const toCanonicalPaymentStatus = (
  value: string | null | undefined,
  fallback: CanonicalPaymentStatus = 'unpaid'
): CanonicalPaymentStatus => {
  if (!value) return fallback;

  const normalized = value.toLowerCase();
  return CANONICAL_PAYMENT_STATUSES.find((status) => status === normalized) ?? fallback;
};

export const isInvoiceFullyPaid = (paymentStatus: string | null | undefined) =>
  toCanonicalPaymentStatus(paymentStatus) === 'paid';

export const toCanonicalInvoiceDisplayStatus = (
  invoiceStatus: string | null | undefined,
  dueDate: string | null | undefined,
  paymentStatus: string | null | undefined
): CanonicalInvoiceStatus =>
  isInvoiceFullyPaid(paymentStatus)
    ? 'Paid'
    : toCanonicalInvoiceStatusWithDueDate(invoiceStatus, dueDate);

export const buildInvoiceStatusSummary = (statuses: Array<string | null | undefined>) =>
  statuses.reduce(
    (acc, status) => {
      const canonical = toCanonicalInvoiceStatus(status);
      const key = canonical.toLowerCase() as keyof typeof acc;
      acc[key] += 1;
      return acc;
    },
    {
      total: statuses.length,
      draft: 0,
      sent: 0,
      overdue: 0,
      paid: 0,
      disputed: 0,
      cancelled: 0,
    }
  );
