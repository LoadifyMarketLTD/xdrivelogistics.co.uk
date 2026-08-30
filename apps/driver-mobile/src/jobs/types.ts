export type CanonicalJobStatus =
  | 'awarded'
  | 'on_my_way_pickup'
  | 'arrived_pickup'
  | 'loaded'
  | 'on_my_way_delivery'
  | 'arrived_delivery'
  | 'delivered'
  | 'pod_completed'
  | 'invoice_generated'
  | 'completed';

export type JobScope = 'active' | 'upcoming' | 'completed';

export type AttachmentCategory =
  | 'pod'
  | 'invoice'
  | 'cmr'
  | 'manifest'
  | 'customs'
  | 'delivery_photos'
  | 'collection_photos'
  | 'damage_photos';

export type AttachmentFileType = 'pdf' | 'jpg' | 'png' | 'docx' | 'xlsx';

export type JobAttachment = {
  id: string;
  category: AttachmentCategory;
  fileType: AttachmentFileType;
  url: string;
  name: string;
  uploadedBy: string;
  uploadedAt: string;
  canDelete: boolean;
};

export type JobStop = {
  id: string;
  type: 'collection' | 'delivery';
  sequence: number;
  address: string;
  company?: string;
  contactPerson?: string;
  telephone?: string;
  timeWindowFrom?: string;
  timeWindowTo?: string;
  status?: 'pending' | 'arrived' | 'completed' | 'skipped';
  arrivedAt?: string;
  completedAt?: string;
  notes?: string;
  gpsCoordinates?: string;
  photos?: string[];
  documents?: string[];
  collectionDetails?: string;
  deliveryDetails?: string;
};

export type AuditEntry = {
  id: string;
  status: CanonicalJobStatus;
  user: string;
  role: string;
  timestamp: string;
  gps?: string;
  device?: string;
  osVersion?: string;
  appVersion?: string;
  ipAddress?: string;
  notes?: string;
  attachments?: string[];
};

export type PodRecord = {
  receiverName: string;
  receiverCompany?: string;
  signatureData?: string;
  date: string;
  time: string;
  gps?: string;
  deliveryPhotoUris: string[];
  damagePhotoUris: string[];
  documentUris: string[];
  quantityDelivered?: string;
  itemsMissing?: string;
  itemsDamaged?: string;
  comments?: string;
  receiverNotes?: string;
  driverNotes?: string;
  completedBy: string;
  completedByRole: string;
  auditHistory?: AuditEntry[];
};

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
  /** @deprecated use podCompleted */
  podGenerated?: boolean;
  podCompleted?: boolean;
  contactAllowed: boolean;
  contactName?: string;
  contactPhone?: string;
  requirements?: string;
  updatedAt?: string | null;
  // Extended fields
  client?: string;
  distance?: string;
  eta?: string;
  weight?: string;
  dimensions?: string;
  palletCount?: number;
  adr?: boolean;
  tailLift?: boolean;
  temperatureControlled?: boolean;
  badges?: string[];
  stops?: JobStop[];
  auditTrail?: AuditEntry[];
  attachments?: JobAttachment[];
  customerNotes?: string;
  dispatcherNotes?: string;
  specialInstructions?: string;
  customerReference?: string;
  internalReference?: string;
  paymentTerms?: string;
  customerDetails?: string;
  pod?: PodRecord | null;
};

export type QueuedActionStatus = 'pending' | 'syncing' | 'synced' | 'failed';