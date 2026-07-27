import type { CanonicalJobStatus } from './types';

export type StatusStep = {
  /** Canonical DB status value written when this action completes. */
  status: CanonicalJobStatus;
  /** Display label for the action button. Never persisted. */
  label: string;
  /** URL path segment for the action API endpoint. */
  endpoint: string;
  requiresConfirmation: boolean;
};

/**
 * Explicit driver workflow transition matrix.
 *
 * Key   = current canonical status value (what the job is in right now).
 * Value = the next StatusStep the driver can execute.
 *
 * posted and quoted are receiving-only statuses — drivers cannot advance them.
 * awarded is an alias entry point that maps to the same first action as allocated.
 * delivered is the terminal state — no entry.
 */
const NEXT_STEP: Partial<Record<CanonicalJobStatus, StatusStep>> = {
  allocated:             { status: 'accepted',              label: 'Accept job',             endpoint: 'accept',            requiresConfirmation: true  },
  accepted:              { status: 'on_my_way_to_pickup',   label: 'On my way to pickup',    endpoint: 'on-my-way-pickup',  requiresConfirmation: false },
  on_my_way_to_pickup:   { status: 'on_site_pickup',        label: 'Arrived at pickup',      endpoint: 'arrived-pickup',    requiresConfirmation: true  },
  on_site_pickup:        { status: 'loaded',                label: 'Loaded / collected',     endpoint: 'loaded',            requiresConfirmation: true  },
  loaded:                { status: 'on_my_way_to_delivery', label: 'On my way to delivery',  endpoint: 'on-my-way-delivery',requiresConfirmation: false },
  on_my_way_to_delivery: { status: 'on_site_delivery',      label: 'Arrived at delivery',    endpoint: 'arrived-delivery',  requiresConfirmation: true  },
  on_site_delivery:      { status: 'delivered',             label: 'Delivered',              endpoint: 'delivered',         requiresConfirmation: true  },
};

/**
 * Ordered list of all driver-executable workflow steps for reference.
 * Does not include non-executable statuses (posted, quoted).
 * Use getNextStep() for runtime transition lookup.
 */
export const statusFlow: StatusStep[] = [
  NEXT_STEP.allocated!,
  NEXT_STEP.accepted!,
  NEXT_STEP.on_my_way_to_pickup!,
  NEXT_STEP.on_site_pickup!,
  NEXT_STEP.loaded!,
  NEXT_STEP.on_my_way_to_delivery!,
  NEXT_STEP.on_site_delivery!,
];

/**
 * Returns the next driver action step for the given canonical status, or
 * undefined when:
 *   - the status is `posted` or `quoted` (not driver-executable),
 *   - the status is `delivered` (terminal state), or
 *   - the status is unknown.
 *
 * `awarded` maps to the same first action as `allocated` (accept job).
 */
export function getNextStep(status: CanonicalJobStatus): StatusStep | undefined {
  if (status === 'posted' || status === 'quoted') return undefined;
  if (status === 'awarded') return NEXT_STEP.allocated;
  return NEXT_STEP[status];
}
