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
  lifecycleStatus?: string;
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

export type DriverNotification = {
  id: string;
  title: string;
  body: string | null;
  type: string | null;
  read_at: string | null;
  created_at: string | null;
};

export type DriverQuote = {
  id: string;
  status: string;
  price: string;
  message: string | null;
  createdAt: string | null;
  pickupLocation: string;
  deliveryLocation: string;
  pickupDatetime: string | null;
  vehicleType: string;
  jobStatus: string | null;
  jobId: string | null;
};

export type DriverVehicle = {
  id: string;
  reg_plate: string | null;
  type: string | null;
  make: string | null;
  model: string | null;
  payload_kg: number | null;
  pallets_capacity: number | null;
  has_tail_lift: boolean | null;
};

export type DriverProfile = {
  id: string;
  display_name: string;
  phone: string | null;
  email: string | null;
  status: string;
  company_id: string;
};

export type QueuedActionStatus = 'pending' | 'synced' | 'failed';
