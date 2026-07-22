export type JobStatusLike = {
  status?: string | null;
  current_status?: string | null;
};

export type InvoiceStatusLike = {
  status?: string | null;
  payment_status?: string | null;
  due_date?: string | null;
};

export type ComplianceStatusLike = {
  status?: string | null;
  expiry_date?: string | null;
};

const normalise = (value: string | null | undefined) =>
  String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');

export const getEffectiveJobStatus = (job: JobStatusLike): string =>
  normalise(job.current_status ?? job.status);

export const AWARDED_JOB_STATUSES = new Set(['awarded']);
export const ALLOCATED_JOB_STATUSES = new Set(['allocated']);
export const ACTIVE_EXECUTION_STATUSES = new Set([
  'accepted',
  'on_my_way',
  'on_my_way_to_pickup',
  'driver_en_route',
  'on_site_pickup',
  'arrived_pickup',
  'loaded',
  'collected',
  'in_transit',
  'on_my_way_to_delivery',
  'on_site_delivery',
  'arrived_delivery',
]);
export const TERMINAL_JOB_STATUSES = new Set([
  'delivered',
  'completed',
  'invoiced',
  'paid',
  'cancelled',
]);
export const EXCEPTION_JOB_STATUSES = new Set([
  'failed',
  'failed_delivery',
  'delivery_failed',
  'exception',
  'disputed',
]);

export const isActiveExecutionStatus = (status: string) =>
  ACTIVE_EXECUTION_STATUSES.has(normalise(status));

export const isTerminalJobStatus = (status: string) =>
  TERMINAL_JOB_STATUSES.has(normalise(status));

export const isExceptionJobStatus = (status: string) =>
  EXCEPTION_JOB_STATUSES.has(normalise(status));

export const getInvoiceState = (invoice: InvoiceStatusLike, now = Date.now()) => {
  const status = normalise(invoice.status);
  const paymentStatus = normalise(invoice.payment_status);
  const excluded = new Set(['void', 'cancelled', 'canceled', 'credited', 'credit_note', 'deleted']);
  const payable = !excluded.has(status);
  const paid = status === 'paid' || paymentStatus === 'paid';
  const unpaid = payable && !paid;
  const dueAt = invoice.due_date ? new Date(invoice.due_date).getTime() : Number.NaN;
  const overdue = unpaid && Number.isFinite(dueAt) && dueAt < now;
  return { status, paymentStatus, payable, paid, unpaid, overdue };
};

export const getRecordedComplianceState = (document: ComplianceStatusLike, now = Date.now()) => {
  const status = normalise(document.status);
  const expiryAt = document.expiry_date ? new Date(document.expiry_date).getTime() : Number.NaN;
  const expired = Number.isFinite(expiryAt) && expiryAt < now;
  const blockedByStatus = ['expired', 'rejected', 'invalid', 'failed', 'suspended'].includes(status);
  const blocking = expired || blockedByStatus;
  const daysUntilExpiry = Number.isFinite(expiryAt)
    ? Math.ceil((expiryAt - now) / 86_400_000)
    : null;
  return { status, expired, blocking, daysUntilExpiry };
};
