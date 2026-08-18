export type MarketplaceSource = Record<string, unknown>;

export function marketplaceText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function marketplaceNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function publicOutcode(value: unknown) {
  const raw = marketplaceText(value)?.toUpperCase().replace(/\s+/g, ' ');
  if (!raw) return null;

  const uk = raw.match(/^([A-Z]{1,2}\d[A-Z\d]?)/);
  if (uk?.[1]) return uk[1];

  const first = raw.split(' ')[0]?.trim();
  if (!first) return null;
  return first.length > 4 ? first.slice(0, 4) : first;
}

export function publicAreaLabel(postcode: unknown, countryCode: unknown, fallback: string) {
  const area = publicOutcode(postcode);
  const country = marketplaceText(countryCode)?.toUpperCase();
  if (area && country && !['GB', 'UK'].includes(country)) return `${area}, ${country}`;
  return area ?? country ?? fallback;
}

function loadDetailsObject(value: unknown): Record<string, unknown> | null {
  const raw = marketplaceText(value);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

export function isBrokerCommercialJob(job: MarketplaceSource) {
  const details = loadDetailsObject(job.load_details);
  if (!details) return false;

  const source = marketplaceText(details.source)?.toLowerCase() ?? '';
  if (source.includes('broker')) return true;

  // Compatibility for broker-created rows that pre-date the explicit source
  // marker but already carried a private carrier-cost target in load_details.
  return marketplaceNumber(details.targetCarrierCost) !== null;
}

/**
 * Only explicitly separated v2 Public Quote Notes are allowed to cross the
 * pre-award Marketplace boundary. Legacy free-text load_details is private by
 * default because it may contain site contacts, access codes or other
 * execution-only instructions.
 */
export function publicQuoteNotes(value: unknown) {
  const parsed = loadDetailsObject(value);
  return parsed ? marketplaceText(parsed.publicQuoteNotes) : null;
}

/**
 * Legacy/customer Marketplace jobs may use a positive budget_amount as the
 * poster's proposed carrier price. Broker customer revenue is deliberately
 * private: broker load_details marks its source/target carrier cost, so that
 * value must never become a carrier/driver proposed price.
 */
export function proposedPriceAmount(value: unknown) {
  const amount = marketplaceNumber(value);
  return amount !== null && amount > 0 ? amount : null;
}

export function publicProposedPrice(job: MarketplaceSource) {
  return isBrokerCommercialJob(job) ? null : proposedPriceAmount(job.budget_amount);
}

/**
 * Never return raw special_requirements before award. It is a mixed legacy
 * field. Project only recognised quote-safe capability/handling flags.
 */
export function quoteSafeRequirementFlags(job: MarketplaceSource) {
  const flags = new Set<string>();
  if (job.collection_tail_lift_required === true || job.delivery_tail_lift_required === true) flags.add('Tail lift');
  if (job.collection_forklift_available === true || job.delivery_forklift_available === true) flags.add('Forklift');
  if (job.collection_handball_required === true || job.delivery_handball_required === true) flags.add('Handball');
  if (job.direct_delivery_required === true) flags.add('Direct delivery');

  const requirements = String(job.special_requirements ?? '').toLowerCase();
  if (requirements.includes('adr required')) flags.add('ADR');
  if (requirements.includes('temperature controlled')) flags.add('Temperature controlled');
  if (requirements.includes('fragile goods')) flags.add('Fragile');
  if (requirements.includes('tail lift required')) flags.add('Tail lift');
  if (requirements.includes('forklift required')) flags.add('Forklift');
  if (requirements.includes('handball required')) flags.add('Handball');

  return [...flags];
}