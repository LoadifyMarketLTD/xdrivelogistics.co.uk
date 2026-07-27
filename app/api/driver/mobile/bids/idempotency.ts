const DEFAULT_BID_CURRENCY = 'GBP';
const DEFAULT_BID_MESSAGE = '';

export const IDEMPOTENCY_CONFLICT_ERROR = 'idempotency_conflict';

export type StoredBidReplayRow = {
  id: string;
  job_id: string;
  bidder_user_id: string | null;
  bidder_driver_id: string | null;
  amount: number | string | null;
  bid_price_gbp: number | string | null;
  currency: string | null;
  message: string | null;
};

export type IncomingBidReplayIntent = {
  jobId: string;
  bidderUserId: string;
  bidderDriverId: string | null;
  amount: number;
  currency: string;
  message: string;
};

type NormalizedBidReplayPayload = {
  jobId: string;
  bidderUserId: string;
  bidderDriverId: string;
  amount: string;
  currency: string;
  message: string;
};

function normalizeAmount(value: unknown): string | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Number(parsed).toString();
}

function normalizeCurrency(value: unknown): string {
  const normalized = String(value ?? '').trim().toUpperCase();
  return normalized || DEFAULT_BID_CURRENCY;
}

function normalizeMessage(value: unknown): string {
  return String(value ?? DEFAULT_BID_MESSAGE).trim();
}

function normalizeIdentity(value: unknown): string {
  return String(value ?? '').trim();
}

export function normalizeIncomingBidReplayIntent(
  intent: IncomingBidReplayIntent,
): NormalizedBidReplayPayload | null {
  const amount = normalizeAmount(intent.amount);
  if (!amount) return null;
  return {
    jobId: normalizeIdentity(intent.jobId),
    bidderUserId: normalizeIdentity(intent.bidderUserId),
    bidderDriverId: normalizeIdentity(intent.bidderDriverId),
    amount,
    currency: normalizeCurrency(intent.currency),
    message: normalizeMessage(intent.message),
  };
}

export function normalizeStoredBidReplayRow(
  row: StoredBidReplayRow,
): NormalizedBidReplayPayload | null {
  const amount = normalizeAmount(row.amount) ?? normalizeAmount(row.bid_price_gbp);
  if (!amount) return null;
  return {
    jobId: normalizeIdentity(row.job_id),
    bidderUserId: normalizeIdentity(row.bidder_user_id),
    bidderDriverId: normalizeIdentity(row.bidder_driver_id),
    amount,
    currency: normalizeCurrency(row.currency),
    message: normalizeMessage(row.message),
  };
}

export function isDeterministicBidReplay(
  stored: StoredBidReplayRow,
  incoming: IncomingBidReplayIntent,
): boolean {
  const normalizedStored = normalizeStoredBidReplayRow(stored);
  const normalizedIncoming = normalizeIncomingBidReplayIntent(incoming);
  if (!normalizedStored || !normalizedIncoming) return false;
  return normalizedStored.jobId === normalizedIncoming.jobId &&
    normalizedStored.bidderUserId === normalizedIncoming.bidderUserId &&
    normalizedStored.bidderDriverId === normalizedIncoming.bidderDriverId &&
    normalizedStored.amount === normalizedIncoming.amount &&
    normalizedStored.currency === normalizedIncoming.currency &&
    normalizedStored.message === normalizedIncoming.message;
}
