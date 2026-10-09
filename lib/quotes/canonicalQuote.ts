export type CanonicalQuoteStage =
  | 'draft'
  | 'submitted'
  | 'viewed'
  | 'shortlisted'
  | 'accepted'
  | 'unsuccessful'
  | 'withdrawn'
  | 'expired'
  | 'archived';

export type QuotePerspective = 'poster' | 'bidder';

export type QuoteLifecycleRecord = {
  status?: string | null;
  viewed_at?: string | null;
  shortlisted_at?: string | null;
  poster_archived_at?: string | null;
  bidder_archived_at?: string | null;
};

export type QuoteLifecycleContext = {
  jobExpired?: boolean;
};

const normalise = (value: unknown) => String(value ?? '').trim().toLowerCase();

export function canonicalQuoteStage(
  quote: QuoteLifecycleRecord,
  perspective: QuotePerspective,
  context: QuoteLifecycleContext = {},
): CanonicalQuoteStage {
  const status = normalise(quote.status);
  const archivedAt = perspective === 'poster' ? quote.poster_archived_at : quote.bidder_archived_at;
  if (archivedAt) return 'archived';
  if (context.jobExpired && ['submitted', 'sent', 'viewed', 'shortlisted'].includes(status)) return 'expired';
  if (['accepted', 'converted', 'completed'].includes(status)) return 'accepted';
  if (['rejected', 'declined', 'unsuccessful', 'cancelled'].includes(status)) return 'unsuccessful';
  if (status === 'withdrawn') return 'withdrawn';
  if (status === 'draft') return 'draft';
  if (quote.shortlisted_at) return 'shortlisted';
  if (quote.viewed_at) return 'viewed';
  return 'submitted';
}

export function quoteStageLabel(stage: CanonicalQuoteStage) {
  if (stage === 'unsuccessful') return 'Unsuccessful';
  return stage.charAt(0).toUpperCase() + stage.slice(1);
}

export function isTerminalQuoteStage(stage: CanonicalQuoteStage) {
  return ['accepted', 'unsuccessful', 'withdrawn', 'expired', 'archived'].includes(stage);
}

export const POSTER_QUOTE_TABS: Array<{ id: CanonicalQuoteStage | 'received'; label: string }> = [
  { id: 'received', label: 'Received' },
  { id: 'shortlisted', label: 'Shortlisted' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'unsuccessful', label: 'Unsuccessful' },
  { id: 'archived', label: 'Archived' },
];

export const BIDDER_QUOTE_TABS: Array<{ id: CanonicalQuoteStage; label: string }> = [
  { id: 'submitted', label: 'Submitted' },
  { id: 'accepted', label: 'Won' },
  { id: 'unsuccessful', label: 'Unsuccessful' },
  { id: 'withdrawn', label: 'Withdrawn' },
  { id: 'expired', label: 'Expired' },
  { id: 'archived', label: 'Archived' },
];
