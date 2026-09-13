import type { CanonicalJobStatus } from './driver';

export const statusFlow: Array<{
  status: CanonicalJobStatus;
  label: string;
  endpoint: string;
}> = [
  { status: 'on_my_way_pickup', label: 'On My Way to Collection', endpoint: 'on-my-way-pickup' },
  { status: 'arrived_pickup', label: 'On Site (Collection)', endpoint: 'arrived-pickup' },
  { status: 'loaded', label: 'Loaded', endpoint: 'loaded' },
  { status: 'on_my_way_delivery', label: 'On My Way to Delivery', endpoint: 'on-my-way-delivery' },
  { status: 'arrived_delivery', label: 'On Site (Delivery)', endpoint: 'arrived-delivery' },
  { status: 'delivered', label: 'Complete Delivery', endpoint: 'delivered' },
];

export function getNextStep(current: CanonicalJobStatus) {
  if (current === 'available' || current === 'delivered' || current === 'cancelled') return undefined;
  if (current === 'awarded') return statusFlow[0];
  const index = statusFlow.findIndex((step) => step.status === current);
  return index >= 0 ? statusFlow[index + 1] : undefined;
}

export function statusLabel(status: CanonicalJobStatus) {
  if (status === 'available') return 'Available';
  if (status === 'awarded') return 'Accepted';
  if (status === 'delivered') return 'Delivered';
  if (status === 'cancelled') return 'Cancelled';
  const labels: Partial<Record<CanonicalJobStatus, string>> = {
    on_my_way_pickup: 'On My Way to Collection',
    arrived_pickup: 'On Site (Collection)',
    loaded: 'Loaded',
    on_my_way_delivery: 'On My Way to Delivery',
    arrived_delivery: 'On Site (Delivery)',
  };
  return labels[status] ?? status;
}
