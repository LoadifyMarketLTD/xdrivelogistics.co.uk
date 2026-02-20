export type CompanyRole = 'owner' | 'admin' | 'dispatcher' | 'viewer';
export type MembershipStatus = 'invited' | 'active' | 'suspended';
export type DocStatus = 'pending' | 'approved' | 'rejected' | 'expired';
export type JobStatus = 'draft' | 'posted' | 'allocated' | 'in_transit' | 'delivered' | 'cancelled' | 'disputed';
export type CargoType = 'documents' | 'packages' | 'pallets' | 'furniture' | 'equipment' | 'other';
export type VehicleType = 'bicycle' | 'motorbike' | 'car' | 'van_small' | 'van_large' | 'luton' | 'truck_7_5t' | 'truck_18t' | 'artic';
export type TrackingEventType = 'created' | 'allocated' | 'driver_en_route' | 'arrived_pickup' | 'collected' | 'in_transit' | 'arrived_delivery' | 'delivered' | 'failed' | 'cancelled' | 'note';

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  is_driver: boolean;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  name: string;
  company_number: string | null;
  vat_number: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  country: string;
  created_by: string | null;
  created_at: string;
}

export interface CompanyMembership {
  id: string;
  company_id: string;
  user_id: string | null;
  invited_email: string | null;
  role_in_company: CompanyRole;
  status: MembershipStatus;
  created_at: string;
  updated_at: string;
}

export interface Driver {
  id: string;
  company_id: string;
  user_id: string | null;
  display_name: string;
  phone: string | null;
  email: string | null;
  status: string;
  created_at: string;
}

export interface Vehicle {
  id: string;
  company_id: string;
  assigned_driver_id: string | null;
  type: VehicleType;
  reg_plate: string | null;
  make: string | null;
  model: string | null;
  payload_kg: number | null;
  pallets_capacity: number | null;
  has_tail_lift: boolean;
  has_straps: boolean;
  has_blankets: boolean;
  created_at: string;
}

export interface DriverDocument {
  id: string;
  driver_id: string;
  doc_type: string;
  file_path: string | null;
  issued_date: string | null;
  expiry_date: string | null;
  status: DocStatus;
  rejection_reason: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
}

export interface VehicleDocument {
  id: string;
  vehicle_id: string;
  doc_type: string;
  file_path: string | null;
  issued_date: string | null;
  expiry_date: string | null;
  status: DocStatus;
  rejection_reason: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
}

export interface DbJob {
  id: string;
  company_id: string;
  created_by: string | null;
  status: JobStatus;
  vehicle_type: VehicleType | null;
  cargo_type: CargoType | null;
  pickup_location: string | null;
  pickup_postcode: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  pickup_datetime: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  delivery_datetime: string | null;
  pallets: number | null;
  boxes: number | null;
  bags: number | null;
  items: number | null;
  weight_kg: number | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  currency: string;
  budget_amount: number | null;
  is_fixed_price: boolean;
  load_details: string | null;
  special_requirements: string | null;
  access_restrictions: string | null;
  job_distance_miles: number | null;
  job_distance_minutes: number | null;
  created_at: string;
  updated_at: string;
}

export interface JobBid {
  id: string;
  job_id: string;
  company_id: string | null;
  bidder_user_id: string;
  bidder_driver_id: string | null;
  amount: number;
  currency: string;
  message: string | null;
  status: string;
  created_at: string;
}

export interface Quote {
  id: string;
  company_id: string;
  created_by: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  pickup_location: string | null;
  delivery_location: string | null;
  vehicle_type: VehicleType | null;
  cargo_type: CargoType | null;
  amount: number | null;
  currency: string;
  status: string;
  created_at: string;
}
