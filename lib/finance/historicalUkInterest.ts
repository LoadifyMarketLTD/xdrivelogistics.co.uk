/**
 * Review-only historical simple-interest calculator for UK B2B late payments.
 * Input rate periods must be legally verified before use; no charges are posted.
 * Dates are UTC calendar dates; interest starts the day after the due date.
 */
export type RatePeriod = { from: string; annualBaseRatePercent: number };
export type DebtPayment = { on: string; amountGbp: number };
export type HistoricalInterestResult = {
  interestGbp: number;
  daysOverdue: number;
  outstandingGbp: number;
  compensationGbp: 40 | 70 | 100;
  breakdown: { from: string; to: string; days: number; outstandingGbp: number; annualRatePercent: number; interestGbp: number }[];
  requiresReview: true;
};
const DAY = 86400000;
function parseDay(v: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error('Expected YYYY-MM-DD');
  const n = Date.parse(v + 'T00:00:00Z');
  if (!Number.isFinite(n) || new Date(n).toISOString().slice(0,10) !== v) throw new Error('Invalid date');
  return n;
}
const iso = (n:number) => new Date(n).toISOString().slice(0,10);
const money = (n:number) => Math.round((n + Number.EPSILON) * 100) / 100;
export function calculateHistoricalUkInterest(input: {
  dueDate: string;
  throughDate: string;
  originalDebtGbp: number;
  baseRatePeriods: RatePeriod[];
  payments: DebtPayment[];
}): HistoricalInterestResult | null {
  const due = parseDay(input.dueDate);
  const through = parseDay(input.throughDate);
  const amount = input.originalDebtGbp;
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invalid debt');
  if (through <= due) return null;
  const rates = input.baseRatePeriods.map(r => ({ at: parseDay(r.from), rate: r.annualBaseRatePercent }))
    .sort((a,b) => a.at-b.at);
  if (!rates.length || rates.some(r => !Number.isFinite(r.rate) || r.rate < 0 || r.rate > 100))
    throw new Error('Verified rate periods required');
  const start = due + DAY;
  if (rates[0].at > start) throw new Error('Rate schedule does not cover overdue start');
  const payments = input.payments.map(p => ({ at: parseDay(p.on), amount: p.amountGbp }))
    .sort((a,b) => a.at-b.at);
  if (payments.some(p => !Number.isFinite(p.amount) || p.amount <= 0 || p.at > through || p.at < due))
    throw new Error('Invalid payment schedule');
  let outstanding = amount;
  for (const p of payments.filter(p => p.at < start)) outstanding -= p.amount;
  if (outstanding < -0.005) throw new Error('Payments exceed debt');
  if (outstanding <= 0.005) return null;
  let accrued = 0;
  const breakdown: HistoricalInterestResult['breakdown'] = [];
  let cursor = start;
  const endExclusive = through + DAY;
  const boundaries = [...new Set([start,endExclusive,
    ...rates.map(r=>r.at).filter(n=>n>start&&n<endExclusive),
    ...payments.map(p=>p.at).filter(n=>n>start&&n<endExclusive)])].sort((a,b)=>a-b);
  for (let i=0;i<boundaries.length-1;i++) {
    cursor=boundaries[i];
    for (const p of payments.filter(p=>p.at===cursor)) outstanding-=p.amount;
    if (outstanding < -0.005) throw new Error('Payments exceed debt');
    const next=boundaries[i+1];
    const days=Math.round((next-cursor)/DAY);
    const base=rates.filter(r=>r.at<=cursor).at(-1);
    if (!base) throw new Error('Missing base rate');
    const interest=Math.max(0,outstanding)*(base.rate+8)/100*days/365;
    accrued+=interest;
    breakdown.push({from:iso(cursor),to:iso(next-DAY),days,outstandingGbp:money(Math.max(0,outstanding)),
      annualRatePercent:base.rate+8,interestGbp:money(interest)});
  }
  const compensationGbp:40|70|100=amount<1000?40:amount<10000?70:100;
  return {interestGbp:money(accrued),daysOverdue:Math.round((through-due)/DAY),
    outstandingGbp:money(Math.max(0,outstanding)),compensationGbp,breakdown,requiresReview:true};
}
