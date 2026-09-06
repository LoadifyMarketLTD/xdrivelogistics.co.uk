type JobRow = {
  awarded_carrier_company_id?: string | null;
  status?: string | null;
  delivery_datetime?: string | null;
  delivered_at?: string | null;
  completed_at?: string | null;
};
type InvoiceRow = {
  id: string;
  buyer_company_id?: string | null;
  amount?: number | string | null;
  due_date?: string | null;
  status?: string | null;
  payment_status?: string | null;
};
type PaymentRow = { invoice_id?: string | null; amount?: number | string | null; paid_at?: string | null; created_at?: string | null };
export type MemberReputation = {
  delivery: { score: number | null; evidenceCount: number; completedJobs: number };
  payment: { score: number | null; evidenceCount: number; onTimePaid: number; latePaid: number; overdueOpen: number };
};

const lower = (value: unknown) => String(value ?? '').trim().toLowerCase();
const finiteDate = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
};
const dueDeadline = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const raw = value.trim();
  const time = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T23:59:59.999Z`).getTime()
    : new Date(raw).getTime();
  return Number.isFinite(time) ? time : null;
};
const amount = (value: unknown) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
};
const score = (successes: number, evidence: number) => evidence > 0 ? Math.round((successes / evidence) * 100) : null;

export function buildMemberReputation(
  companyIds: string[],
  jobs: JobRow[],
  invoices: InvoiceRow[],
  payments: PaymentRow[],
  nowMs = Date.now(),
): Map<string, MemberReputation> {
  const result = new Map<string, MemberReputation>();
  for (const companyId of companyIds) result.set(companyId, {
    delivery: { score: null, evidenceCount: 0, completedJobs: 0 },
    payment: { score: null, evidenceCount: 0, onTimePaid: 0, latePaid: 0, overdueOpen: 0 },
  });

  const onTimeByCompany = new Map<string, number>();
  for (const job of jobs) {
    const companyId = job.awarded_carrier_company_id ?? null;
    const current = companyId ? result.get(companyId) : null;
    if (!current) continue;
    const status = lower(job.status);
    if (status === 'delivered' || status === 'completed') current.delivery.completedJobs += 1;
    const actual = finiteDate(job.delivered_at) ?? finiteDate(job.completed_at);
    const planned = finiteDate(job.delivery_datetime);
    if (actual == null || planned == null) continue;
    current.delivery.evidenceCount += 1;
    if (actual <= planned) onTimeByCompany.set(companyId!, (onTimeByCompany.get(companyId!) ?? 0) + 1);
  }
  for (const [companyId, current] of result) {
    current.delivery.score = score(onTimeByCompany.get(companyId) ?? 0, current.delivery.evidenceCount);
  }

  const paymentsByInvoice = new Map<string, Array<{ amount: number; paidAt: number }>>();
  for (const payment of payments) {
    const invoiceId = payment.invoice_id ?? null;
    const paidAt = finiteDate(payment.paid_at) ?? finiteDate(payment.created_at);
    const paidAmount = amount(payment.amount);
    if (!invoiceId || paidAt == null || paidAmount <= 0) continue;
    const list = paymentsByInvoice.get(invoiceId) ?? [];
    list.push({ amount: paidAmount, paidAt });
    paymentsByInvoice.set(invoiceId, list);
  }
  for (const list of paymentsByInvoice.values()) list.sort((a, b) => a.paidAt - b.paidAt);

  for (const invoice of invoices) {
    const companyId = invoice.buyer_company_id ?? null;
    const current = companyId ? result.get(companyId) : null;
    const due = dueDeadline(invoice.due_date);
    const gross = amount(invoice.amount);
    if (!current || due == null || gross <= 0) continue;
    let accumulated = 0;
    let settledAt: number | null = null;
    for (const payment of paymentsByInvoice.get(invoice.id) ?? []) {
      accumulated += payment.amount;
      if (accumulated >= gross - 0.005) { settledAt = payment.paidAt; break; }
    }
    if (settledAt != null) {
      current.payment.evidenceCount += 1;
      if (settledAt <= due) current.payment.onTimePaid += 1;
      else current.payment.latePaid += 1;
      continue;
    }
    const paymentState = lower(invoice.payment_status);
    const invoiceState = lower(invoice.status);
    const closedWithoutHistory = paymentState === 'paid' || invoiceState === 'paid';
    if (!closedWithoutHistory && due < nowMs) {
      current.payment.evidenceCount += 1;
      current.payment.overdueOpen += 1;
    }
  }
  for (const current of result.values()) current.payment.score = score(current.payment.onTimePaid, current.payment.evidenceCount);
  return result;
}
