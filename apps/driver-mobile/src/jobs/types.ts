/**
 * Canonical driver job status values — these are the exact strings persisted in
 * the database (current_status or lifecycle status column) and must never be
 * aliased or remapped in client code.
 *
 * Lifecycle entry statuses (awarded / allocated / accepted) indicate the job
 * has been assigned to this driver but the physical workflow has not started.
 * current_status progresses through the driver workflow statuses below.
 */
export type CanonicalJobStatus =
  // Lifecycle entry statuses — job assigned, workflow not yet started
  | 'awarded'
  | 'allocated'
  | 'accepted'
  // Driver workflow statuses (match jobs.current_status column)
  | 'on_my_way'        // en route to pickup
  | 'on_site_pickup'   // arrived at pickup location
  | 'loaded'           // cargo loaded / collected
  | 'in_transit'       // en route to delivery
  | 'on_site_delivery' // arrived at delivery location
  | 'delivered';       // delivery complete

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
