import { buildJobAuditTrail } from './jobAuditPresentation';

export const driverJobOperationalSelect = [
  'pallets',
  'weight_kg',
  'length_cm',
  'width_cm',
  'height_cm',
  'job_distance_minutes',
  'customer_reference',
  'purchase_order_number',
  'booking_reference',
  'collection_tail_lift_required',
  'delivery_tail_lift_required',
  'document_checklist',
].join(',');

type OperationalJobRow = Record<string, unknown> & {
  id: string;
  pickup_location?: string | null;
  delivery_location?: string | null;
  pickup_datetime?: string | null;
  delivery_datetime?: string | null;
  collection_contact_name?: string | null;
  collection_contact_phone?: string | null;
  delivery_contact_name?: string | null;
  delivery_contact_phone?: string | null;
  client_name?: string | null;
  load_details?: string | null;
  special_requirements?: string | null;
  access_restrictions?: string | null;
  distance_miles?: number | string | null;
  job_distance_miles?: number | string | null;
  status_history?: unknown;
  pod_generated_at?: string | null;
};

function positiveNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function checklist(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
    : [];
}

export function buildJobOperationalPresentation(row: OperationalJobRow) {
  const distance = positiveNumber(row.distance_miles ?? row.job_distance_miles);
  const durationMinutes = positiveNumber(row.job_distance_minutes);
  const weightKg = positiveNumber(row.weight_kg);
  const lengthCm = positiveNumber(row.length_cm);
  const widthCm = positiveNumber(row.width_cm);
  const heightCm = positiveNumber(row.height_cm);
  const palletCount = positiveNumber(row.pallets);
  const requirementsText = [text(row.special_requirements), text(row.access_restrictions)].filter(Boolean).join(' ');
  const documentChecklist = checklist(row.document_checklist);

  return {
    client: text(row.client_name),
    distance: distance ? `${distance.toFixed(1)} mi` : undefined,
    eta: durationMinutes ? `${Math.round(durationMinutes)} min` : undefined,
    weight: weightKg ? `${weightKg.toLocaleString('en-GB')} kg` : undefined,
    dimensions: lengthCm && widthCm && heightCm
      ? `${lengthCm} × ${widthCm} × ${heightCm} cm`
      : undefined,
    palletCount: palletCount ? Math.round(palletCount) : undefined,
    adr: /\badr\b|hazardous/i.test(requirementsText) || undefined,
    tailLift: row.collection_tail_lift_required === true || row.delivery_tail_lift_required === true || undefined,
    temperatureControlled: /temperature[\s_-]*controlled|refrigerat/i.test(requirementsText) || undefined,
    badges: documentChecklist.length ? documentChecklist : undefined,
    customerNotes: text(row.load_details),
    specialInstructions: text(row.special_requirements),
    customerReference: text(row.customer_reference),
    internalReference: text(row.booking_reference),
    auditTrail: buildJobAuditTrail(row),
    legacyStops: [
      {
        id: `${row.id}:collection`,
        type: 'collection',
        sequence: 0,
        address: text(row.pickup_location) || 'Pickup TBC',
        contactPerson: text(row.collection_contact_name),
        telephone: text(row.collection_contact_phone),
        timeWindowFrom: text(row.pickup_datetime),
        collectionDetails: text(row.load_details),
        notes: text(row.access_restrictions),
      },
      {
        id: `${row.id}:delivery`,
        type: 'delivery',
        sequence: 1,
        address: text(row.delivery_location) || 'Delivery TBC',
        contactPerson: text(row.delivery_contact_name),
        telephone: text(row.delivery_contact_phone),
        timeWindowFrom: text(row.delivery_datetime),
        deliveryDetails: text(row.special_requirements),
        notes: text(row.access_restrictions),
      },
    ],
  };
}
