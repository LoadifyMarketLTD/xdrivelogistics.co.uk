/**
 * Production helpers for quote line-item computation and payload building.
 * These are imported by both the UI (LiveLoadsScreen) and the unit tests so
 * that tests exercise the real algorithm rather than a copy.
 */

export const VAT_RATE = 0.2;

/** Backend accepts GBP only. */
export const SUPPORTED_CURRENCY = 'GBP' as const;

/** Maximum characters allowed in the bid `message` field. */
export const MESSAGE_MAX_CHARS = 1_000;

export type QuoteLineItems = {
  /** Always 'GBP' — the only currency the backend accepts. */
  currency: typeof SUPPORTED_CURRENCY;
  amount: string;
  extras: string;
  waitingTime: string;
  tolls: string;
  ferry: string;
  overnight: string;
  parking: string;
  congestion: string;
  driverNotes: string;
  estimatedCollectionTime: string;
  /** Minutes after acceptance in which the Driver expects to reach collection. */
  collectWithinMinutes: string;
  vatEnabled: boolean;
};

export const DEFAULT_LINE_ITEMS: QuoteLineItems = {
  currency: SUPPORTED_CURRENCY,
  amount: '',
  extras: '',
  waitingTime: '',
  tolls: '',
  ferry: '',
  overnight: '',
  parking: '',
  congestion: '',
  driverNotes: '',
  estimatedCollectionTime: '',
  collectWithinMinutes: '',
  vatEnabled: false,
};

/**
 * Parse a locale-formatted numeric string to a positive finite number.
 * Commas are treated as decimal separators (European format support).
 * Returns 0 for empty, non-numeric, negative, zero or non-finite values.
 */
export function parseNum(value: string): number {
  const n = Number(value.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Compute the subtotal (before VAT) from all line items.
 */
export function computeSubtotal(items: Pick<QuoteLineItems, 'amount' | 'extras' | 'waitingTime' | 'tolls' | 'ferry' | 'overnight' | 'parking' | 'congestion'>): number {
  return (
    parseNum(items.amount)
    + parseNum(items.extras)
    + parseNum(items.waitingTime)
    + parseNum(items.tolls)
    + parseNum(items.ferry)
    + parseNum(items.overnight)
    + parseNum(items.parking)
    + parseNum(items.congestion)
  );
}

/** Structured extras before VAT, excluding the base transport amount. */
export function computeStructuredExtras(items: Pick<QuoteLineItems, 'amount' | 'extras' | 'waitingTime' | 'tolls' | 'ferry' | 'overnight' | 'parking' | 'congestion'>): number {
  return Math.max(0, Number((computeSubtotal(items) - parseNum(items.amount)).toFixed(2)));
}

/**
 * Compute the final total from all line items, applying VAT when requested.
 */
export function computeTotal(items: QuoteLineItems): number {
  const subtotal = computeSubtotal(items);
  return items.vatEnabled ? subtotal * (1 + VAT_RATE) : subtotal;
}

/**
 * Build the deterministic `message` string that is sent to the backend.
 * The result is always ≤ MESSAGE_MAX_CHARS characters.
 * Extra-charge line items are included only when non-zero.
 * The final total is included so the backend and dispatcher see the same figure.
 */
export function buildQuoteMessage(items: QuoteLineItems): string {
  const subtotal = computeSubtotal(items);
  const total = computeTotal(items);

  const lines: string[] = [];

  if (parseNum(items.extras) > 0) lines.push(`Extras: £${parseNum(items.extras).toFixed(2)}`);
  if (parseNum(items.waitingTime) > 0) lines.push(`Waiting time: £${parseNum(items.waitingTime).toFixed(2)}`);
  if (parseNum(items.tolls) > 0) lines.push(`Tolls: £${parseNum(items.tolls).toFixed(2)}`);
  if (parseNum(items.ferry) > 0) lines.push(`Ferry: £${parseNum(items.ferry).toFixed(2)}`);
  if (parseNum(items.overnight) > 0) lines.push(`Overnight: £${parseNum(items.overnight).toFixed(2)}`);
  if (parseNum(items.parking) > 0) lines.push(`Parking: £${parseNum(items.parking).toFixed(2)}`);
  if (parseNum(items.congestion) > 0) lines.push(`Congestion: £${parseNum(items.congestion).toFixed(2)}`);

  if (items.vatEnabled) {
    lines.push(`Subtotal: £${subtotal.toFixed(2)}`);
    lines.push(`VAT (20%): £${(total - subtotal).toFixed(2)}`);
  }

  lines.push(`Total: £${total.toFixed(2)}`);

  const collectWithin = Math.round(parseNum(items.collectWithinMinutes));
  if (collectWithin >= 5 && collectWithin <= 240) {
    lines.push(`Collect within: ${collectWithin} min`);
  }

  if (items.estimatedCollectionTime.trim()) {
    lines.push(`Est. collection: ${items.estimatedCollectionTime.trim()}`);
  }

  if (items.driverNotes.trim()) {
    lines.push(`Notes: ${items.driverNotes.trim()}`);
  }

  const message = lines.join(' | ');
  return message.slice(0, MESSAGE_MAX_CHARS);
}

/**
 * Validate a quote before sending it. Returns an error string or null.
 */
export function validateQuote(items: QuoteLineItems): string | null {
  const amount = parseNum(items.amount);
  if (amount <= 0) return 'Enter a valid quote amount greater than zero.';
  if (!Number.isFinite(amount)) return 'Quote amount must be a valid number.';
  if (amount > 999_999) return 'Quote amount is unreasonably large.';
  const total = computeTotal(items);
  if (!Number.isFinite(total) || total <= 0 || total > 1_000_000) return 'Computed total is invalid.';
  if (items.collectWithinMinutes.trim()) {
    const collectWithin = Number(items.collectWithinMinutes.replace(',', '.'));
    if (!Number.isInteger(collectWithin) || collectWithin < 5 || collectWithin > 240) {
      return 'Collect within must be a whole number between 5 and 240 minutes.';
    }
  }
  return null;
}
