/** Mirrors refresh_invoice_stripe_balance: cap each Stripe attempt's combined
 * refunded and lost-dispute amounts at the original charge amount. */
export type StripeAttemptBalance = {
  id: string;
  amount_minor: number;
};
export type StripeReversal = { attempt_id: string; amount_minor: number };
export type StripeDispute = { attempt_id: string; amount_minor: number; status: string };

export function calculateNetInvoicePaid(
  grossPaid: number,
  attempts: StripeAttemptBalance[],
  reversals: StripeReversal[],
  disputes: StripeDispute[],
): number {
  const refundsByAttempt = new Map<string, number>();
  for (const row of reversals) {
    refundsByAttempt.set(row.attempt_id, (refundsByAttempt.get(row.attempt_id) ?? 0) + Number(row.amount_minor));
  }
  const lostByAttempt = new Map<string, number>();
  for (const row of disputes) {
    if (row.status !== 'lost') continue;
    lostByAttempt.set(row.attempt_id, (lostByAttempt.get(row.attempt_id) ?? 0) + Number(row.amount_minor));
  }
  const reversedMinor = attempts.reduce((total, attempt) => total + Math.min(
    Number(attempt.amount_minor),
    (refundsByAttempt.get(attempt.id) ?? 0) + (lostByAttempt.get(attempt.id) ?? 0),
  ), 0);
  return Math.max(0, Math.round((grossPaid - reversedMinor / 100) * 100) / 100);
}
