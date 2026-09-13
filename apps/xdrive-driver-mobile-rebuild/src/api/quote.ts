import { apiRequest } from './client';

export type DriverQuoteInput = {
  baseAmount: number;
  additionalExtrasGbp: number;
  collectWithinMinutes: number | null;
  message: string;
};

export async function submitStructuredQuote(jobId: string, input: DriverQuoteInput) {
  const baseAmount = Number(input.baseAmount);
  const extras = Number(input.additionalExtrasGbp || 0);
  if (!Number.isFinite(baseAmount) || baseAmount <= 0) throw new Error('Enter a valid quote amount.');
  if (!Number.isFinite(extras) || extras < 0) throw new Error('Additional extras cannot be negative.');
  const amount = Number((baseAmount + extras).toFixed(2));
  return apiRequest('/api/driver/mobile/bids', {
    method: 'POST',
    body: {
      jobId,
      amount,
      baseAmount: Number(baseAmount.toFixed(2)),
      additionalExtrasGbp: Number(extras.toFixed(2)),
      collectWithinMinutes: input.collectWithinMinutes,
      message: input.message.trim(),
    },
  });
}
