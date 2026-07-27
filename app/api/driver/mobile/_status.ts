export const CANONICAL_DRIVER_OPERATIONAL_STATUSES = [
  'posted',
  'quoted',
  'awarded',
  'allocated',
  'accepted',
  'on_my_way_to_pickup',
  'on_site_pickup',
  'loaded',
  'on_my_way_to_delivery',
  'on_site_delivery',
  'delivered',
] as const;

type CanonicalOperationalStatus = (typeof CANONICAL_DRIVER_OPERATIONAL_STATUSES)[number];

/**
 * Strict operational aliases — legacy wire names for canonical driver operational states only.
 * Marketplace-terminal states (completed, invoiced, paid) are intentionally excluded: they are
 * not driver operational states and must never silently resolve to 'delivered'.
 */
const DRIVER_OPERATIONAL_ALIASES: Record<string, CanonicalOperationalStatus> = {
  posted: 'posted',
  quoted: 'quoted',
  awarded: 'awarded',
  allocated: 'allocated',
  assigned: 'allocated',
  accepted: 'accepted',
  on_my_way_to_pickup: 'on_my_way_to_pickup',
  on_my_way: 'on_my_way_to_pickup',
  on_site_pickup: 'on_site_pickup',
  arrived_pickup: 'on_site_pickup',
  loaded: 'loaded',
  collected: 'loaded',
  on_my_way_to_delivery: 'on_my_way_to_delivery',
  in_transit: 'on_my_way_to_delivery',
  on_route_delivery: 'on_my_way_to_delivery',
  on_site_delivery: 'on_site_delivery',
  arrived_delivery: 'on_site_delivery',
  delivered: 'delivered',
};

/**
 * Full alias map including marketplace-terminal states, used only by
 * normalizeDriverOperationalStatus for backward-compatible read normalisation.
 * Must never be used to determine the active driver operational status.
 */
const DRIVER_STATUS_ALIASES: Record<string, CanonicalOperationalStatus> = {
  ...DRIVER_OPERATIONAL_ALIASES,
  completed: 'delivered',
  invoiced: 'delivered',
  paid: 'delivered',
};

export function normalizeDriverOperationalStatus(value: unknown): CanonicalOperationalStatus | null {
  const raw = String(value ?? '').toLowerCase().trim();
  return DRIVER_STATUS_ALIASES[raw] ?? null;
}

/**
 * Returns the canonical driver operational status derived from the stored
 * `current_status` field only.  Returns null when the field is absent or
 * unrecognised — the job is explicitly non-actionable in that state.
 *
 * Marketplace-derived status (job.status) is intentionally NOT consulted:
 * marketplace values such as 'completed', 'invoiced', and 'paid' are terminal
 * marketplace states and must not silently coerce into an operational status.
 */
export function mobileOperationalStatus(currentStatus: unknown): CanonicalOperationalStatus | null {
  const raw = String(currentStatus ?? '').toLowerCase().trim();
  return DRIVER_OPERATIONAL_ALIASES[raw] ?? null;
}

/**
 * Legacy-bootstrap helper for rows that pre-date the `current_status` column.
 * Uses a strict allowlist that excludes marketplace-terminal states, so a
 * 'completed', 'invoiced', or 'paid' marketplace status never bootstraps an
 * operational 'delivered' state.
 *
 * Must only be called explicitly for known legacy migration paths; it must
 * never be used as a generic silent fallback in the normal API mapper.
 */
export function legacyBootstrapOperationalStatus(marketplaceStatus: unknown): CanonicalOperationalStatus | null {
  const raw = String(marketplaceStatus ?? '').toLowerCase().trim();
  return DRIVER_OPERATIONAL_ALIASES[raw] ?? null;
}
