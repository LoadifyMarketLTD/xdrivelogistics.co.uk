/**
 * Canonical driver job status values — these are the exact strings persisted in
 * the database (current_status or lifecycle status column) and must never be
 * aliased or remapped in client code.
 *
 * Receiving statuses (posted / quoted) are returned by the API when a job has
 * not yet been fully assigned. They are not driver-executable workflow steps.
 *
 * Lifecycle entry statuses (awarded / allocated) indicate assignment.
 * `accepted` is the explicit driver acknowledgement before physical work begins.
 * The physical workflow then proceeds through the on_my_way_to_pickup … delivered chain.
 */
export type CanonicalJobStatus =
  // Receiving statuses — not driver-executable
  | 'posted'
  | 'quoted'
  // Assignment / acceptance statuses
  | 'awarded'
  | 'allocated'
  | 'accepted'           // driver has explicitly accepted the job
  // Physical workflow statuses (exact strings persisted in jobs.current_status)
  | 'on_my_way_to_pickup'   // en route to pickup location
  | 'on_site_pickup'         // arrived at pickup location
  | 'loaded'                 // cargo loaded / collected
  | 'on_my_way_to_delivery'  // en route to delivery location
  | 'on_site_delivery'       // arrived at delivery location
  | 'delivered';             // delivery complete — terminal state

export type JobScope = 'active' | 'upcoming' | 'completed';

export type DriverJob = {
  id: string;
  reference: string;
  /** Exact persisted value from jobs.current_status (or jobs.status as fallback). */
  status: CanonicalJobStatus;
  /** Macro lifecycle status (jobs.status). */
  lifecycleStatus?: string | null;
  pickupLocation: string;
  deliveryLocation: string;
  pickupPostcode?: string | null;
  deliveryPostcode?: string | null;
  pickupTime: string;
  deliveryTime: string;
  cargoType: string;
  vehicleRequirement: string;
  price: string;
  priority: 'normal' | 'high';
  podRequired: boolean;
  podGenerated?: boolean;
  // Contacts — authorised contact details revealed after allocation
  contactAllowed: boolean;
  /** Primary display contact (delivery preferred, then pickup, then client). */
  contactName?: string;
  contactPhone?: string;
  pickupContactName?: string | null;
  pickupContactPhone?: string | null;
  deliveryContactName?: string | null;
  deliveryContactPhone?: string | null;
  // Cargo details
  loadDetails?: string | null;
  specialRequirements?: string | null;
  accessRestrictions?: string | null;
  /** Combined requirements string for compact display. */
  requirements?: string;
  pallets?: number | null;
  boxes?: number | null;
  bags?: number | null;
  items?: number | null;
  weightKg?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  // Routing / distance
  distanceMiles?: number | null;
  distanceMinutes?: number | null;
  // Coordinates for map display
  pickupLat?: number | null;
  pickupLng?: number | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  updatedAt?: string | null;
};

export type QueuedActionStatus = 'pending' | 'syncing' | 'synced' | 'failed';
