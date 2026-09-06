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

export function publicQuoteNotes(value: unknown) {
  const raw = marketplaceText(value);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return marketplaceText((parsed as Record<string, unknown>).publicQuoteNotes);
  } catch {
    return null;
  }
}

export function proposedPriceAmount(value: unknown) {
  const amount = marketplaceNumber(value);
  return amount !== null && amount > 0 ? amount : null;
}

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
