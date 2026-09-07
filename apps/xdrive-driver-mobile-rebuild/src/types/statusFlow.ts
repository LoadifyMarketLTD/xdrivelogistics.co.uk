import type { CanonicalJobStatus } from './driver';

export const statusFlow: Array<{
  status: CanonicalJobStatus;
  label: string;
  endpoint: string;
}> = [
  { status: 'on_my_way_pickup', label: 'On my way to pickup', endpoint: 'on-my-way-pickup' },
  { status: 'arrived_pickup', label: 'Arrived at pickup', endpoint: 'arrived-pickup' },
  { status: 'loaded', label: 'Loaded / collected', endpoint: 'loaded' },
  { status: 'on_my_way_delivery', label: 'On my way to delivery', endpoint: 'on-my-way-delivery' },
  { status: 'arrived_delivery', label: 'Arrived at delivery', endpoint: 'arrived-delivery' },
  { status: 'delivered', label: 'Complete Delivery', endpoint: 'delivered' },
];

export function getNextStep(current: CanonicalJobStatus) {
  if (current === 'awarded') return statusFlow[0];
  const index = statusFlow.findIndex((step) => step.status === current);
  return index >= 0 ? statusFlow[index + 1] : undefined;
}

export function statusLabel(status: CanonicalJobStatus) {
  if (status === 'awarded') return 'Accepted';
  return statusFlow.find((step) => step.status === status)?.label ?? status;
}