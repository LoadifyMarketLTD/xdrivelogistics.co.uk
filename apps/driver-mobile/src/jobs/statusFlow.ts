import type { CanonicalJobStatus } from './types';

export type StatusStep = {
  status: CanonicalJobStatus;
  label: string;
  endpoint: string;
  requiresConfirmation: boolean;
  /** If true this step requires POD to be captured first */
  requiresPod?: boolean;
  /** If true this step can only be set by the backend, never by the driver */
  backendOnly?: boolean;
};

export const statusFlow: StatusStep[] = [
  { status: 'on_my_way_pickup', label: 'On My Way To Pickup', endpoint: 'on-my-way-pickup', requiresConfirmation: false },
  { status: 'arrived_pickup', label: 'On Site Pickup', endpoint: 'arrived-pickup', requiresConfirmation: true },
  { status: 'loaded', label: 'Loaded', endpoint: 'loaded', requiresConfirmation: true },
  { status: 'on_my_way_delivery', label: 'On My Way To Delivery', endpoint: 'on-my-way-delivery', requiresConfirmation: false },
  { status: 'arrived_delivery', label: 'On Site Delivery', endpoint: 'arrived-delivery', requiresConfirmation: true },
  { status: 'delivered', label: 'Delivered', endpoint: 'delivered', requiresConfirmation: true, requiresPod: true },
  { status: 'pod_completed', label: 'POD Completed', endpoint: 'pod', requiresConfirmation: false, backendOnly: true },
  { status: 'invoice_generated', label: 'Invoice Generated', endpoint: 'invoice-generated', requiresConfirmation: false, backendOnly: true },
  { status: 'completed', label: 'Completed', endpoint: 'completed', requiresConfirmation: false, backendOnly: true },
];

/** Full timeline including the initial accepted step, used for the Status tab display. */
export const FULL_TIMELINE: { status: CanonicalJobStatus; label: string }[] = [
  { status: 'awarded', label: 'Accepted' },
  { status: 'on_my_way_pickup', label: 'On My Way To Pickup' },
  { status: 'arrived_pickup', label: 'On Site Pickup' },
  { status: 'loaded', label: 'Loaded' },
  { status: 'on_my_way_delivery', label: 'On My Way To Delivery' },
  { status: 'arrived_delivery', label: 'On Site Delivery' },
  { status: 'delivered', label: 'Delivered (POD)' },
  { status: 'pod_completed', label: 'POD Completed' },
  { status: 'invoice_generated', label: 'Invoice Generated' },
  { status: 'completed', label: 'Completed' },
];

const STATUS_ORDER: CanonicalJobStatus[] = [
  'awarded',
  'on_my_way_pickup',
  'arrived_pickup',
  'loaded',
  'on_my_way_delivery',
  'arrived_delivery',
  'delivered',
  'pod_completed',
  'invoice_generated',
  'completed',
];

export function statusIndex(status: CanonicalJobStatus): number {
  return STATUS_ORDER.indexOf(status);
}

export function isStatusAtLeast(current: CanonicalJobStatus, target: CanonicalJobStatus): boolean {
  return statusIndex(current) >= statusIndex(target);
}

/**
 * Returns true when the transition from `current` to `next` is valid.
 * Rules:
 * - Cannot skip mandatory steps (steps must be taken in order).
 * - `invoice_generated` requires `pod_completed` to have been reached first.
 * - `completed` is always backend-only — client must never submit it.
 */
export function canTransitionTo(current: CanonicalJobStatus, next: CanonicalJobStatus): boolean {
  if (next === 'completed') return false; // backend-only
  const nextStep = statusFlow.find((s) => s.status === next);
  if (nextStep?.backendOnly) return false;
  const currentIdx = statusIndex(current);
  const nextIdx = statusIndex(next);
  // Must advance exactly one step at a time
  return nextIdx === currentIdx + 1;
}

export function getNextStep(status: CanonicalJobStatus) {
  if (status === 'awarded') return statusFlow[0];
  const currentIndex = statusFlow.findIndex((step) => step.status === status);
  if (currentIndex < 0) return undefined;
  const candidate = statusFlow[currentIndex + 1];
  if (!candidate || candidate.backendOnly) return undefined;
  return candidate;
}
