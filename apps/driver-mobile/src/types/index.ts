// Canonical job statuses (mirrors lib/types/database.ts on the web platform)
export type JobStatus =
  | 'draft'
  | 'posted'
  | 'quoted'
  | 'awarded'
  | 'allocated'
  | 'collected'
  | 'in_transit'
  | 'delivered'
  | 'invoiced'
  | 'paid'
  | 'cancelled'
  | 'disputed';

// Driver execution actions (sent to POST /api/driver/mobile/jobs/:id/status)
export type DriverAction =
  | 'on-my-way-pickup'
  | 'arrived-pickup'
  | 'loaded'
  | 'on-my-way-delivery'
  | 'arrived-delivery'
  | 'delivered';

// Label displayed to the driver for each action
export const ACTION_LABELS: Record<DriverAction, string> = {
  'on-my-way-pickup': 'On My Way to Pickup',
  'arrived-pickup': 'Arrived at Pickup',
  loaded: 'Loaded — Ready to Go',
  'on-my-way-delivery': 'On My Way to Delivery',
  'arrived-delivery': 'Arrived at Delivery',
  delivered: 'Mark as Delivered',
};

// Which actions are available given the current job status
export const AVAILABLE_ACTIONS: Partial<Record<JobStatus, DriverAction[]>> = {
  awarded: ['on-my-way-pickup'],
  allocated: ['on-my-way-pickup', 'arrived-pickup', 'loaded'],
  collected: ['on-my-way-delivery'],
  in_transit: ['arrived-delivery', 'delivered'],
};

export interface JobSummary {
  id: string;
  status: JobStatus;
  pickup_location: string | null;
  pickup_datetime: string | null;
  delivery_location: string | null;
  delivery_datetime: string | null;
  vehicle_type: string | null;
  budget_amount: number | null;
  currency: string | null;
  pod_required: boolean | null;
  pod_generated: boolean | null;
}

export interface JobDetail extends JobSummary {
  pickup_lat: number | null;
  pickup_lng: number | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  pickup_contact_name: string | null;
  pickup_contact_phone: string | null;
  delivery_contact_name: string | null;
  delivery_contact_phone: string | null;
  load_details: string | null;
  special_instructions: string | null;
  pod_photos: PodEntry[] | null;
  status_history: { status: string; timestamp: string; note?: string }[] | null;
}

export interface PodEntry {
  url: string;
  type: 'photo' | 'signature' | 'document';
  note: string | null;
  driver_id: string;
  uploaded_at: string;
}

export interface TrackingEvent {
  id: string;
  event_type: string;
  message: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

// Offline queue item
export interface OfflineQueueItem {
  id: string; // local uuid
  created_at: string;
  endpoint: string;
  method: 'POST' | 'GET' | 'PATCH';
  body: Record<string, unknown>;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  retry_count: number;
  last_error: string | null;
}
