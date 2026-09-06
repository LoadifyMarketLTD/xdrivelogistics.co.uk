import type { CanonicalJobStatus } from './types';

export type StatusStep = {
  status: CanonicalJobStatus;
  label: string;
  endpoint: string;
  requiresConfirmation: boolean;
};

export const statusFlow: StatusStep[] = [
  { status: 'on_my_way_pickup', label: 'Head to collection', endpoint: 'on-my-way-pickup', requiresConfirmation: false },
  { status: 'arrived_pickup', label: 'Confirm collection arrival', endpoint: 'arrived-pickup', requiresConfirmation: true },
  { status: 'loaded', label: 'Confirm cargo loaded', endpoint: 'loaded', requiresConfirmation: true },
  { status: 'on_my_way_delivery', label: 'Start delivery leg', endpoint: 'on-my-way-delivery', requiresConfirmation: false },
  { status: 'arrived_delivery', label: 'Confirm delivery arrival', endpoint: 'arrived-delivery', requiresConfirmation: true },
];

export function getNextStep(status: CanonicalJobStatus) {
  if (status === 'awarded') return statusFlow[0];
  const currentIndex = statusFlow.findIndex((step) => step.status === status);
  return currentIndex >= 0 ? statusFlow[currentIndex + 1] : undefined;
}
