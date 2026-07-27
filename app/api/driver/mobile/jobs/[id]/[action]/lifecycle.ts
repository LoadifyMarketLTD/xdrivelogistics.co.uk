import { CANONICAL_DRIVER_OPERATIONAL_STATUSES } from '../../../_status';

export type ActionConfig = {
  fromStatus: (typeof CANONICAL_DRIVER_OPERATIONAL_STATUSES)[number];
  toStatus: (typeof CANONICAL_DRIVER_OPERATIONAL_STATUSES)[number];
  timestampField?: 'on_my_way_at' | 'on_site_pickup_at' | 'loaded_at' | 'on_site_delivery_at' | 'delivered_at';
  eventType: string;
  label: string;
  requiresPod?: boolean;
};

export const actions: Record<string, ActionConfig> = {
  accept: {
    fromStatus: 'allocated',
    toStatus: 'accepted',
    eventType: 'note',
    label: 'Job accepted by driver',
  },
  'on-my-way-pickup': {
    fromStatus: 'accepted',
    toStatus: 'on_my_way_to_pickup',
    timestampField: 'on_my_way_at',
    eventType: 'driver_en_route',
    label: 'On my way to pickup',
  },
  'arrived-pickup': {
    fromStatus: 'on_my_way_to_pickup',
    toStatus: 'on_site_pickup',
    timestampField: 'on_site_pickup_at',
    eventType: 'arrived_pickup',
    label: 'Arrived at pickup',
  },
  loaded: {
    fromStatus: 'on_site_pickup',
    toStatus: 'loaded',
    timestampField: 'loaded_at',
    eventType: 'collected',
    label: 'Loaded / collected',
  },
  'on-my-way-delivery': {
    fromStatus: 'loaded',
    toStatus: 'on_my_way_to_delivery',
    eventType: 'in_transit',
    label: 'On my way to delivery',
  },
  'arrived-delivery': {
    fromStatus: 'on_my_way_to_delivery',
    toStatus: 'on_site_delivery',
    timestampField: 'on_site_delivery_at',
    eventType: 'arrived_delivery',
    label: 'Arrived at delivery',
  },
  delivered: {
    fromStatus: 'on_site_delivery',
    toStatus: 'delivered',
    timestampField: 'delivered_at',
    eventType: 'delivered',
    label: 'Delivered',
    requiresPod: true,
  },
};

export function validateLifecycleActionTransition(action: string, currentStatus: string | null) {
  const config = actions[action];
  if (!config) return { ok: false as const, reason: 'unsupported_action' as const };
  if (currentStatus !== config.fromStatus) {
    return { ok: false as const, reason: 'invalid_from_state' as const, expected: config.fromStatus };
  }
  return { ok: true as const, config };
}
