export type CanonicalJobStatus =
  | 'awarded'
  | 'on_my_way_pickup'
  | 'arrived_pickup'
  | 'loaded'
  | 'on_my_way_delivery'
  | 'arrived_delivery'
  | 'delivered';

export type JobScope = 'active' | 'upcoming' | 'completed';

export type DriverJob = {
  id: string;
  reference: string;
  status: CanonicalJobStatus;
  lifecycleStatus?: string | null;
  pickupLocation: string;
  deliveryLocation: string;
  pickupTime: string;
  deliveryTime: string;
  cargoType: string;
  vehicleRequirement: string;
  price: string;
  priority: 'normal' | 'high';
  podRequired: boolean;
  podGenerated?: boolean;
  contactAllowed: boolean;
  contactName?: string;
  contactPhone?: string;
  requirements?: string;
  updatedAt?: string | null;
};

export type QueuedActionStatus = 'pending' | 'syncing' | 'synced' | 'failed';
