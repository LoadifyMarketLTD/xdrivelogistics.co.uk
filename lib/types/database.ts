export type CompanyRole = 'owner' | 'admin' | 'dispatcher' | 'finance' | 'member' | 'viewer';
export type MembershipStatus = 'invited' | 'active' | 'suspended';
export type DocStatus = 'pending' | 'approved' | 'rejected' | 'expired';
export type JobStatus =
  | 'draft'
  | 'posted'
  | 'quoted'
  | 'awarded'
  | 'allocated'
  | 'on_my_way'
  | 'on_site_pickup'
  | 'loaded'
  | 'on_site_delivery'
  | 'collected'
  | 'in_transit'
  | 'delivered'
  | 'completed'
  | 'invoiced'
  | 'paid'
  | 'cancelled'
  | 'disputed';
export type CargoType = 'documents' | 'packages' | 'parcels' | 'pallets' | 'machinery' | 'furniture' | 'retail_goods' | 'mixed_freight' | 'adr_goods' | 'temperature_controlled_freight' | 'equipment' | 'other';
export type VehicleType = 'bicycle' | 'motorbike' | 'car' | 'van_small' | 'van_large' | 'swb_van' | 'mwb_van' | 'lwb_van' | 'xlwb_van' | 'luton' | 'luton_tail_lift' | 'curtainside_van' | 'truck_3_5t' | 'truck_5t' | 'truck_7_5t' | 'truck_12t' | 'truck_18t' | 'truck_26t' | 'artic' | 'artic_44t_curtainsider' | 'artic_44t_box_trailer' | 'artic_44t_flatbed' | 'artic_44t_refrigerated' | 'artic_44t_double_deck' | 'hiab' | 'moffett' | 'adr_vehicle' | 'refrigerated_vehicle' | 'temperature_controlled_vehicle';
export type TrackingEventType = 'created' | 'allocated' | 'driver_en_route' | 'arrived_pickup' | 'collected' | 'in_transit' | 'arrived_delivery' | 'delivered' | 'failed' | 'cancelled' | 'note';

export interface Profile {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  role: string | null;
  status: string;
  company_id: string | null;
  is_driver: boolean;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  name: string;
  company_number: string | null;
  xd_id: string | null;
  vat_number: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  country: string;
  status: 'active' | 'inactive' | 'pending_approval' | 'rejected' | 'suspended';
  company_type: 'admin' | 'standard' | null;
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
  availability_status: 'available' | 'busy' | 'offline' | null;
  login_pin: string | null;
  app_access: boolean;
  temporary_password_seq: number | null;
  must_change_password: boolean;
  temp_password_generated_at: string | null;
  last_app_login: string | null;
  device_token: string | null;
  dob: string | null;
  nationality: string | null;
  residential_address: string | null;
  proof_of_address_path: string | null;
  right_to_work_evidence_path: string | null;
  visa_type: string | null;
  immigration_status: string | null;
  share_code: string | null;
  settled_status: boolean | null;
  pre_settled_status: boolean | null;
  identity_verification_status: 'unverified' | 'under_review' | 'verified' | 'rejected' | null;
  created_at: string;
}

export interface OnboardingApplication {
  id: string;
  user_id: string;
  email: string;
  account_type: 'customer_shipper' | 'broker_shipper' | 'fleet_courier' | 'owner_driver';
  status: 'draft' | 'in_progress' | 'submitted' | 'under_review' | 'compliance_review' | 'admin_approval' | 'approved' | 'rejected' | 'request_changes';
  current_step: string;
  completion_percentage: number;
  token_hash: string | null;
  token_expires_at: string | null;
  token_activated_at: string | null;
  token_last_sent_at: string | null;
  last_activity_at: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyDocument {
  id: string;
  company_id: string;
  onboarding_application_id: string | null;
  doc_type:
    | 'operator_licence'
    | 'public_liability'
    | 'goods_in_transit'
    | 'vehicle_insurance'
    | 'vat_registration'
    | 'company_registration';
  file_path: string | null;
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'expired';
  reviewed_by: string | null;
  reviewed_at: string | null;
  expiry_date: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DriverIdentityDocument {
  id: string;
  onboarding_application_id: string;
  doc_type: 'driving_licence' | 'cpc' | 'proof_of_address' | 'right_to_work' | 'visa_document' | 'insurance';
  file_path: string | null;
  upload_status: 'missing' | 'uploaded';
  verification_status: 'unverified' | 'under_review' | 'verified' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  expiry_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface OwnerDriverVehicle {
  id: string;
  onboarding_application_id: string;
  registration: string;
  make: string | null;
  model: string | null;
  payload: string | null;
  dimensions: string | null;
  tail_lift: boolean | null;
  insurance_details: string | null;
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: string;
  company_id: string;
  assigned_driver_id: string | null;
  type: VehicleType;
  reg_plate: string | null;
  make: string | null;
  model: string | null;
  manufacture_year: number | null;
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
  current_status: JobStatus | null;
  vehicle_type: VehicleType | null;
  cargo_type: CargoType | null;
  pickup_location: string | null;
  pickup_postcode: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  pickup_datetime: string | null;
  pickup_time_slot: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  delivery_datetime: string | null;
  delivery_time_slot: string | null;
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
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  collection_contact_name: string | null;
  collection_contact_phone: string | null;
  delivery_contact_name: string | null;
  delivery_contact_phone: string | null;
  customer_reference: string | null;
  purchase_order_number: string | null;
  booking_reference: string | null;
  requested_vehicle_label: string | null;
  requested_cargo_label: string | null;
  cargo_value_gbp: number | null;
  pallet_type: string | null;
  pallet_stackable: boolean | null;
  collection_forklift_available: boolean | null;
  collection_tail_lift_required: boolean | null;
  collection_handball_required: boolean | null;
  delivery_forklift_available: boolean | null;
  delivery_tail_lift_required: boolean | null;
  delivery_handball_required: boolean | null;
  document_checklist: string[] | null;
  load_details: string | null;
  special_requirements: string | null;
  access_restrictions: string | null;
  job_distance_miles: number | null;
  job_distance_minutes: number | null;
  distance_to_pickup_miles: number | null;
  collection_photo_url: string | null;
  delivery_photos: string[] | null;
  delivery_signature_data: string | null;
  status_history: Array<{ status: string; timestamp: string; note?: string }> | null;
  driver_notes: string | null;
  client_signature_name: string | null;
  exchange_visibility: 'private' | 'exchange' | 'direct' | null;
  awarded_carrier_company_id: string | null;
  exchange_posted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobBid {
  id: string;
  job_id: string;
  company_id: string | null;
  bidder_user_id: string;
  bidder_id: string | null;
  bidder_driver_id: string | null;
  amount: number;
  bid_price_gbp: number | null;
  currency: string;
  message: string | null;
  status: string;
  created_at: string;
}

export interface JobNote {
  id: string;
  job_id: string;
  company_id: string;
  created_by: string | null;
  note: string;
  created_at: string;
}

export interface JobDocument {
  id: string;
  job_id: string;
  company_id: string | null;
  uploaded_by: string | null;
  doc_type: string;
  file_path: string | null;
  file_name: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  uploaded_by_role: string | null;
  created_at: string;
}

export interface DriverLocation {
  id: string;
  driver_id: string;
  company_id: string | null;
  job_id: string | null;
  lat: number;
  lng: number;
  heading: number | null;
  speed_mph: number | null;
  recorded_at: string;
  updated_at: string;
}

export interface ReturnJourney {
  id: string;
  company_id: string;
  driver_id: string | null;
  vehicle_type: VehicleType | null;
  from_postcode: string | null;
  to_postcode: string | null;
  available_from: string | null;
  available_to: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

export type InvoiceStatus =
  | 'Draft'
  | 'Sent'
  | 'Overdue'
  | 'Paid'
  | 'Disputed'
  | 'Cancelled'
  | 'Pending'
  | 'Submitted'
  | 'Approved';

export interface Invoice {
  id: string;
  company_id: string;
  created_by: string | null;
  invoice_number: string;
  job_ref: string;
  job_id: string | null;
  invoice_date: string;
  due_date: string;
  status: InvoiceStatus;
  client_name: string;
  client_address: string | null;
  client_email: string | null;
  pickup_location: string | null;
  pickup_datetime: string | null;
  delivery_location: string | null;
  delivery_datetime: string | null;
  delivery_recipient: string | null;
  service_description: string | null;
  amount: number;
  net_amount: number;
  vat_amount: number;
  vat_rate: 0 | 5 | 20;
  currency: string;
  payment_terms: string;
  invoice_origin: string | null;
  late_fee: string | null;
  pod_photos: string[] | null;
  signature: string | null;
  recipient_name: string | null;
  submitted_at: string | null;
  submitted_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
  disputed_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceDocument {
  id: string;
  invoice_id: string;
  company_id: string;
  uploaded_by: string | null;
  doc_type: 'invoice_pdf' | 'pod_photo' | 'pod_signature' | 'other';
  file_url: string;
  file_name: string | null;
  file_size_bytes: number | null;
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
