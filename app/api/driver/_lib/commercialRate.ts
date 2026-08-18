import type { SupabaseClient } from '@supabase/supabase-js';

export type DriverCommercialJobSeed = {
  id: string;
  agreed_rate_gbp?: number | string | null;
  agreed_rate?: number | string | null;
};

type CommercialRow = Record<string, unknown>;

function moneyValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Canonical read-only hierarchy for the rate won by a Driver/Carrier.
 *
 * Customer-side job budget is deliberately absent. XDrive is an exchange: the
 * commercial execution rate is the accepted quote/agreement, never a fallback
 * to the amount the customer or broker may have budgeted for the load.
 */
export function resolveDriverAgreedRate(
  job: DriverCommercialJobSeed,
  agreement?: CommercialRow | null,
  acceptedBid?: CommercialRow | null,
): number | null {
  return moneyValue(agreement?.agreed_amount)
    ?? moneyValue(job.agreed_rate_gbp)
    ?? moneyValue(job.agreed_rate)
    ?? moneyValue(acceptedBid?.bid_price_gbp)
    ?? moneyValue(acceptedBid?.amount)
    ?? null;
}

export async function loadDriverAgreedRates(
  client: SupabaseClient,
  jobs: DriverCommercialJobSeed[],
): Promise<{ rates: Map<string, number | null>; partial: boolean }> {
  const jobIds = [...new Set(jobs.map((job) => job.id).filter(Boolean))];
  const rates = new Map<string, number | null>();
  if (jobIds.length === 0) return { rates, partial: false };

  const [agreementsResult, bidsResult] = await Promise.all([
    client
      .from('job_commercial_agreements')
      .select('*')
      .in('job_id', jobIds)
      .order('created_at', { ascending: false }),
    client
      .from('job_bids')
      .select('*')
      .in('job_id', jobIds)
      .eq('status', 'accepted')
      .order('created_at', { ascending: false }),
  ]);

  const agreements = new Map<string, CommercialRow>();
  if (!agreementsResult.error) {
    for (const raw of agreementsResult.data ?? []) {
      const row = raw as CommercialRow;
      const jobId = typeof row.job_id === 'string' ? row.job_id : '';
      if (jobId && !agreements.has(jobId)) agreements.set(jobId, row);
    }
  }

  const acceptedBids = new Map<string, CommercialRow>();
  if (!bidsResult.error) {
    for (const raw of bidsResult.data ?? []) {
      const row = raw as CommercialRow;
      const jobId = typeof row.job_id === 'string' ? row.job_id : '';
      if (jobId && !acceptedBids.has(jobId)) acceptedBids.set(jobId, row);
    }
  }

  for (const job of jobs) {
    rates.set(job.id, resolveDriverAgreedRate(job, agreements.get(job.id), acceptedBids.get(job.id)));
  }

  return {
    rates,
    partial: Boolean(agreementsResult.error || bidsResult.error),
  };
}
