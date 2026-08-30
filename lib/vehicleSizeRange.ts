import { VEHICLE_TYPE_LABELS } from './vehicleTypes';

/**
 * Canonical comparable vehicle-size order for marketplace range filtering.
 * Specialist capabilities (Hiab, Moffett, ADR, refrigeration, temperature
 * control) are intentionally excluded because they are equipment/capability
 * requirements rather than a safe linear size progression.
 */
export const MARKETPLACE_VEHICLE_SIZE_ORDER = [
  'bicycle',
  'motorbike',
  'car',
  'van_small',
  'swb_van',
  'mwb_van',
  'lwb_van',
  'xlwb_van',
  'van_large',
  'luton',
  'luton_tail_lift',
  'curtainside_van',
  'truck_3_5t',
  'truck_5t',
  'truck_7_5t',
  'truck_12t',
  'truck_18t',
  'truck_26t',
  'artic',
  'artic_44t_curtainsider',
  'artic_44t_box_trailer',
  'artic_44t_flatbed',
  'artic_44t_refrigerated',
  'artic_44t_double_deck',
] as const;

export type MarketplaceVehicleSize = typeof MARKETPLACE_VEHICLE_SIZE_ORDER[number];

const rank = new Map<string, number>(MARKETPLACE_VEHICLE_SIZE_ORDER.map((value, index) => [value, index]));
const labelToSlug = new Map<string, MarketplaceVehicleSize>();
for (const value of MARKETPLACE_VEHICLE_SIZE_ORDER) {
  const label = VEHICLE_TYPE_LABELS[value];
  if (label) labelToSlug.set(label.trim().toLowerCase(), value);
}

export function normalizeMarketplaceVehicleSize(value: unknown): MarketplaceVehicleSize | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const slug = raw.toLowerCase().replace(/[\s-]+/g, '_');
  if (rank.has(slug)) return slug as MarketplaceVehicleSize;
  return labelToSlug.get(raw.toLowerCase()) ?? null;
}

export function marketplaceVehicleSizeRank(value: unknown): number | null {
  const normalized = normalizeMarketplaceVehicleSize(value);
  return normalized ? rank.get(normalized) ?? null : null;
}

export function vehicleMatchesMarketplaceSizeRange(
  value: unknown,
  minimum: unknown,
  maximum: unknown,
): boolean {
  const valueRank = marketplaceVehicleSizeRank(value);
  const minRank = marketplaceVehicleSizeRank(minimum);
  const maxRank = marketplaceVehicleSizeRank(maximum);

  if (minRank == null && maxRank == null) return true;
  // Unknown/specialist vehicle requirements must not be silently admitted into
  // a size range. Users can still find them with capability/body/freight filters.
  if (valueRank == null) return false;
  if (minRank != null && valueRank < minRank) return false;
  if (maxRank != null && valueRank > maxRank) return false;
  return true;
}

export function marketplaceVehicleSizeOptions() {
  return MARKETPLACE_VEHICLE_SIZE_ORDER.map((value) => ({
    value,
    label: VEHICLE_TYPE_LABELS[value] ?? value.replace(/_/g, ' '),
  }));
}
