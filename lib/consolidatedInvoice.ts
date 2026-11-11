import { calculateInvoiceVatTotals, type InvoiceVatTreatment } from './invoiceVat';

/** Pure calculation adapter for one or more completed XDrive jobs; never issues or persists invoices. */
export function calculateConsolidatedInvoice(
  jobs: ReadonlyArray<{ ref: string; pickup: string; delivery: string; amount: number }>,
  treatment: InvoiceVatTreatment = 'standard',
) {
  if (jobs.length === 0) throw new Error('At least one job is required.');
  const references = new Set<string>();
  let totalPence = 0;
  const lines = jobs.map((job, index) => {
    const ref = job.ref.trim();
    const pickup = job.pickup.trim();
    const delivery = job.delivery.trim();
    if (!ref || !pickup || !delivery) throw new Error(`Job ${index + 1}: missing reference or route.`);
    const key = ref.toLocaleLowerCase('en-GB');
    if (references.has(key)) throw new Error(`Duplicate job reference: ${ref}`);
    references.add(key);
    if (!Number.isFinite(job.amount) || job.amount < 0) throw new Error(`Job ${index + 1}: invalid amount.`);
    const pence = Math.round((job.amount + Number.EPSILON) * 100);
    if (!Number.isSafeInteger(pence)) throw new Error(`Job ${index + 1}: amount exceeds safe bounds.`);
    totalPence += pence;
    if (!Number.isSafeInteger(totalPence)) throw new Error('Invoice exceeds safe bounds.');
    return { ref, pickup, delivery, amount: pence / 100 };
  });
  const netAmount = totalPence / 100;
  if (netAmount <= 0) throw new Error('Invoice total must be positive.');
  return { lines, ...calculateInvoiceVatTotals({ netAmount, treatment }) };
}
