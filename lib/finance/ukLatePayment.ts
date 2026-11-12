/**
 * Advisory UK B2B late-payment estimate, never an automatic charge.
 * The caller must supply the applicable Bank of England reference rate.
 * Statutory eligibility and contractual remedies require human review.
 */
export type LatePaymentEstimate = {
  daysOverdue: number;
  principalGbp: number;
  annualRatePercent: number;
  interestGbp: number;
  compensationGbp: 40 | 70 | 100;
  totalPotentialClaimGbp: number;
  requiresReview: true;
};
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
function day(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid ISO date');
  const n = Date.parse(value + 'T00:00:00Z');
  if (!Number.isFinite(n) || new Date(n).toISOString().slice(0, 10) !== value) throw new Error('Invalid date');
  return n;
}
export function estimateUkLatePayment(input: {
  dueDate: string;
  asOfDate: string;
  originalDebtGbp: number;
  outstandingGbp: number;
  applicableBaseRatePercent: number;
}): LatePaymentEstimate | null {
  const due = day(input.dueDate);
  const today = day(input.asOfDate);
  const { originalDebtGbp, outstandingGbp, applicableBaseRatePercent } = input;
  if (![originalDebtGbp, outstandingGbp, applicableBaseRatePercent].every(Number.isFinite)
      || originalDebtGbp <= 0 || outstandingGbp < 0 || outstandingGbp > originalDebtGbp
      || applicableBaseRatePercent < 0 || applicableBaseRatePercent > 100) throw new Error('Invalid financial values');
  const daysOverdue = Math.max(0, Math.round((today - due) / 86400000));
  if (!daysOverdue || !outstandingGbp) return null;
  const annualRatePercent = applicableBaseRatePercent + 8;
  const interestGbp = round(outstandingGbp * annualRatePercent / 100 * daysOverdue / 365);
  const compensationGbp: 40 | 70 | 100 = originalDebtGbp < 1000 ? 40 : originalDebtGbp < 10000 ? 70 : 100;
  return {
    daysOverdue, principalGbp: round(outstandingGbp), annualRatePercent,
    interestGbp, compensationGbp,
    totalPotentialClaimGbp: round(outstandingGbp + interestGbp + compensationGbp),
    requiresReview: true,
  };
}
