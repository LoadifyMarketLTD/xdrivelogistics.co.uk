import type { CanonicalJobStatus } from './types';

export type StatusStep = {
  status: CanonicalJobStatus;
  label: string;
  endpoint: string;
  requiresConfirmation: boolean;
};

/**
 * Driver workflow progression steps.
 * `status` matches the DB current_status value written by the corresponding
 * API action. `endpoint` is the URL path segment used to call the action route.
 * Labels are for UI display only — they are never persisted.
 */
export const statusFlow: StatusStep[] = [
  { status: 'on_my_way', label: 'On my way to pickup', endpoint: 'on-my-way-pickup', requiresConfirmation: false },
  { status: 'on_site_pickup', label: 'Arrived at pickup', endpoint: 'arrived-pickup', requiresConfirmation: true },
  { status: 'loaded', label: 'Loaded / collected', endpoint: 'loaded', requiresConfirmation: true },
  { status: 'in_transit', label: 'On my way to delivery', endpoint: 'on-my-way-delivery', requiresConfirmation: false },
  { status: 'on_site_delivery', label: 'Arrived at delivery', endpoint: 'arrived-delivery', requiresConfirmation: true },
  { status: 'delivered', label: 'Delivered', endpoint: 'delivered', requiresConfirmation: true },
];

/**
 * Returns the next workflow step for the given current status.
 * All pre-workflow lifecycle statuses (awarded / allocated / accepted) map to
 * the first step so the driver can begin the physical workflow from any of them.
 */
export function getNextStep(status: CanonicalJobStatus) {
  if (status === 'awarded' || status === 'allocated' || status === 'accepted') return statusFlow[0];
  const currentIndex = statusFlow.findIndex((step) => step.status === status);
  return currentIndex >= 0 ? statusFlow[currentIndex + 1] : undefined;
}
