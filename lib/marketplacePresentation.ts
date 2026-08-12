const normaliseComparable = (value: string | null | undefined) =>
  String(value ?? '').replace(/\s+/g, '').trim().toUpperCase();

export function formatMarketplaceLocation(
  location: string | null | undefined,
  postcode: string | null | undefined,
  fallback: string
) {
  const rawLocation = String(location ?? '').trim();
  const rawPostcode = String(postcode ?? '').trim();

  if (!rawLocation) return rawPostcode || fallback;

  const uniqueParts: string[] = [];
  const seen = new Set<string>();
  for (const part of rawLocation.split(',').map((value) => value.trim()).filter(Boolean)) {
    const key = normaliseComparable(part);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    uniqueParts.push(part);
  }

  return uniqueParts.join(', ') || rawPostcode || fallback;
}

export function getMarketplaceLoadNotes(raw: string | null | undefined) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const notes = (parsed as Record<string, unknown>).notes;
    return typeof notes === 'string' && notes.trim() ? notes.trim() : null;
  } catch {
    return trimmed;
  }
}

export function hasMarketplaceProposedPrice(
  isFixedPrice: boolean | null | undefined,
  budgetAmount: number | string | null | undefined
) {
  const amount = typeof budgetAmount === 'number' ? budgetAmount : Number(budgetAmount);
  return isFixedPrice === true && Number.isFinite(amount) && amount > 0;
}
