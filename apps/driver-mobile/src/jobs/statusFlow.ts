import type { CanonicalJobStatus } from './types';

export type StatusStep = {
  status: CanonicalJobStatus;
  label: string;
  endpoint: string;
  requiresConfirmation: boolean;
};

export const statusFlow: StatusStep[] = [
  { status: 'on_my_way_pickup', label: 'On my way to pickup', endpoint: 'on-my-way-pickup', requiresConfirmation: false },
  { status: 'arrived_pickup', label: 'Arrived at pickup', endpoint: 'arrived-pickup', requiresConfirmation: true },
  { status: 'loaded', label: 'Loaded / collected', endpoint: 'loaded', requiresConfirmation: true },
  { status: 'on_my_way_delivery', label: 'On my way to delivery', endpoint: 'on-my-way-delivery', requiresConfirmation: false },
  { status: 'arrived_delivery', label: 'Arrived at delivery', endpoint: 'arrived-delivery', requiresConfirmation: true },
  { status: 'delivered', label: 'Delivered', endpoint: 'delivered', requiresConfirmation: true },
];

export function getNextStep(status: CanonicalJobStatus) {
  if (status === 'awarded') return statusFlow[0];
  const currentIndex = statusFlow.findIndex((step) => step.status === status);
  return currentIndex >= 0 ? statusFlow[currentIndex + 1] : undefined;
}
