/**
 * Adapter: converts a raw Supabase jobs row (with optional joins) into a
 * canonical CompanyJobListItem.
 *
 * All admin/company workspace pages should call adaptJobRow() rather than
 * mapping DB rows themselves.  This is the only place that contains
 * field-access logic for the jobs table.
 */

import type { CompanyJobListItem, CompanyJobAction } from './companyJobTypes';
import {
  safeStr,
  displayText,
  formatLocationSummary,
  formatPostcode,
  formatRoute,
  formatVehicleLabel,
  formatJobRef,
} from './companyJobFormatters';
import { getPermittedActions } from './companyJobStatus';
import { getJobClientFields } from './jobClientFields';

// ── Raw DB row shape ──────────────────────────────────────────────────────────

/**
 * Minimal type describing the raw Supabase row shape the adapter accepts.
 * Only the fields actually used here are typed; extra fields are ignored.
 */
export interface RawJobRow {
  id: string;
  company_id?: string | null;
  status?: string | null;
  current_status?: string | null;
  exchange_visibility?: string | null;

  pickup_location?: string | null;
  pickup_postcode?: string | null;
  pickup_datetime?: string | null;
  pickup_time_slot?: string | null;

  delivery_location?: string | null;
  delivery_postcode?: string | null;
  delivery_datetime?: string | null;
  delivery_time_slot?: string | null;

  vehicle_type?: string | null;
  requested_vehicle_label?: string | null;

  cargo_type?: string | null;
  requested_cargo_label?: string | null;
  weight_kg?: number | null;
  pallets?: number | null;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
  cargo_value_gbp?: number | null;
  pallet_type?: string | null;
  pallet_stackable?: boolean | null;

  customer_reference?: string | null;
  purchase_order_number?: string | null;
  booking_reference?: string | null;

  // Client fields (may be stored in special_requirements for legacy rows)
  client_name?: string | null;
  client_email?: string | null;
  client_phone?: string | null;
  special_requirements?: string | null;

  budget_amount?: number | null;
  is_fixed_price?: boolean | null;
  currency?: string | null;

  awarded_carrier_company_id?: string | null;
  assigned_driver_id?: string | null;

  delivery_photos?: string[] | null;
  load_details?: string | null;

  access_restrictions?: string | null;
  document_checklist?: string[] | null;

  collection_contact_name?: string | null;
  collection_contact_phone?: string | null;
  delivery_contact_name?: string | null;
  delivery_contact_phone?: string | null;

  collection_forklift_available?: boolean | null;
  collection_tail_lift_required?: boolean | null;
  collection_handball_required?: boolean | null;
  delivery_forklift_available?: boolean | null;
  delivery_tail_lift_required?: boolean | null;
  delivery_handball_required?: boolean | null;

  created_at?: string | null;
  updated_at?: string | null;

  // Optional joined relations
  companies?: { name?: string | null } | Array<{ name?: string | null }> | null;
  awarded_carrier?: { name?: string | null } | Array<{ name?: string | null }> | null;
  drivers?: { display_name?: string | null } | Array<{ display_name?: string | null }> | null;
  vehicles?: { reg_plate?: string | null } | Array<{ reg_plate?: string | null }> | null;
}

// ── Optional context for adapter ─────────────────────────────────────────────

export interface AdaptJobRowOptions {
  /** The viewer's company id — used to decide which actions are permitted. */
  viewerCompanyId?: string | null;
  /** Pre-resolved bid for this job from the viewer's company. */
  ownBid?: {
    id: string;
    amountGbp: number | null;
    status: string;
  } | null;
  /** Total number of bids (all companies) on this job. */
  bidCount?: number;
}

// ── Normalise joined single-or-array ─────────────────────────────────────────

function normalizeJoin<T>(
  value: T | T[] | null | undefined,
): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export function adaptJobRow(
  row: RawJobRow,
  options: AdaptJobRowOptions = {},
): CompanyJobListItem {
  const { viewerCompanyId, ownBid = null, bidCount = 0 } = options;

  const id = safeStr(row.id) || 'unknown';
  const status = safeStr(row.status ?? row.current_status) || 'draft';

  // Client fields (handles legacy special_requirements packing)
  const clientFields = getJobClientFields({
    client_name: row.client_name,
    client_email: row.client_email,
    client_phone: row.client_phone,
    special_requirements: row.special_requirements,
    load_details: row.load_details,
  });

  // Company name from join
  const companyJoin = normalizeJoin(row.companies);
  const companyName = displayText(companyJoin?.name, 'Unknown Company');

  // Awarded carrier name from join
  const awardedJoin = normalizeJoin(row.awarded_carrier);
  const awardedCarrierName = awardedJoin?.name ? safeStr(awardedJoin.name) : null;

  // Assigned driver name from join
  const driverJoin = normalizeJoin(row.drivers);
  const assignedDriverName = driverJoin?.display_name ? safeStr(driverJoin.display_name) : null;

  // Assigned vehicle from join
  const vehicleJoin = normalizeJoin(row.vehicles);
  const assignedVehicleReg = vehicleJoin?.reg_plate ? safeStr(vehicleJoin.reg_plate) : null;

  // Vehicle label — prefer explicit label, fall back to type key
  const vehicleTypeKey = safeStr(row.vehicle_type) || '';
  const vehicleLabel =
    safeStr(row.requested_vehicle_label) ||
    formatVehicleLabel(vehicleTypeKey);

  // Permitted actions based on status (may be further filtered by caller)
  const permittedActions: CompanyJobAction[] = getPermittedActions(status);

  // Cargo summary
  const cargoLabel = safeStr(row.requested_cargo_label || row.cargo_type);
  const pallets = typeof row.pallets === 'number' ? row.pallets : null;
  const weightKg = typeof row.weight_kg === 'number' ? row.weight_kg : null;
  const cargoSummary = [
    cargoLabel || null,
    pallets != null ? `${pallets} plt` : null,
    weightKg != null ? `${weightKg} kg` : null,
  ]
    .filter(Boolean)
    .join(', ') || '—';

  // Distance — stored as distance_miles in some rows; fall back to null
  const rowAny = row as unknown as Record<string, unknown>;
  const rawDistance = rowAny.distance_miles;
  const distanceMiles =
    typeof rawDistance === 'number' && Number.isFinite(rawDistance)
      ? rawDistance
      : null;

  return {
    id,
    jobRef: formatJobRef(id, rowAny.job_ref as string | null | undefined),
    companyId: safeStr(row.company_id) || viewerCompanyId || '',
    companyName,

    pickupSummary: formatLocationSummary(row.pickup_location),
    pickupPostcode: formatPostcode(row.pickup_postcode),
    pickupDatetime: safeStr(row.pickup_datetime) || null,

    deliverySummary: formatLocationSummary(row.delivery_location),
    deliveryPostcode: formatPostcode(row.delivery_postcode),
    deliveryDatetime: safeStr(row.delivery_datetime) || null,

    routeDisplay: formatRoute(row.pickup_location, row.delivery_location),
    distanceMiles,

    vehicleTypeKey,
    vehicleLabel,
    cargoSummary,
    weightKg,
    pallets,
    lengthCm: typeof row.length_cm === 'number' ? row.length_cm : null,
    widthCm: typeof row.width_cm === 'number' ? row.width_cm : null,
    heightCm: typeof row.height_cm === 'number' ? row.height_cm : null,
    cargoValueGbp: typeof row.cargo_value_gbp === 'number' ? row.cargo_value_gbp : null,
    palletType: safeStr(row.pallet_type) || null,
    palletStackable: row.pallet_stackable ?? null,

    customerReference: safeStr(row.customer_reference) || null,
    purchaseOrderNumber: safeStr(row.purchase_order_number) || null,
    bookingReference: safeStr(row.booking_reference) || null,

    clientName: clientFields.name,
    clientEmail: clientFields.email,
    clientPhone: clientFields.phone,

    budgetAmountGbp: typeof row.budget_amount === 'number' ? row.budget_amount : null,
    isFixedPrice: row.is_fixed_price ?? false,
    currency: safeStr(row.currency) || 'GBP',

    bidCount,
    ownBidAmountGbp: ownBid?.amountGbp ?? null,
    ownBidStatus: ownBid?.status ?? null,
    ownBidId: ownBid?.id ?? null,

    awardedCarrierCompanyId: safeStr(row.awarded_carrier_company_id) || null,
    awardedCarrierName,
    assignedDriverId: safeStr(row.assigned_driver_id) || null,
    assignedDriverName,
    assignedVehicleId: null, // not available in most queries; caller may set
    assignedVehicleReg,

    status,
    exchangeVisibility: safeStr(row.exchange_visibility) || null,

    hasDeliveryPhotos: Array.isArray(row.delivery_photos) && row.delivery_photos.length > 0,
    invoiceStatus: null, // enriched separately if needed

    permittedActions,

    createdAt: safeStr(row.created_at) || new Date().toISOString(),
    updatedAt: safeStr(row.updated_at) || new Date().toISOString(),

    loadNotes: safeStr(row.load_details) || null,
    accessRestrictions: safeStr(row.access_restrictions) || null,
    specialRequirements: clientFields.cargoNotes || null,
    documentChecklist: Array.isArray(row.document_checklist)
      ? row.document_checklist.filter((s): s is string => typeof s === 'string')
      : [],

    collectionForkliftAvailable: row.collection_forklift_available ?? null,
    collectionTailLiftRequired: row.collection_tail_lift_required ?? null,
    collectionHandballRequired: row.collection_handball_required ?? null,
    deliveryForkliftAvailable: row.delivery_forklift_available ?? null,
    deliveryTailLiftRequired: row.delivery_tail_lift_required ?? null,
    deliveryHandballRequired: row.delivery_handball_required ?? null,

    collectionContactName: safeStr(row.collection_contact_name) || null,
    collectionContactPhone: safeStr(row.collection_contact_phone) || null,
    deliveryContactName: safeStr(row.delivery_contact_name) || null,
    deliveryContactPhone: safeStr(row.delivery_contact_phone) || null,
  };
}

/**
 * Adapts an array of raw job rows in one call.
 */
export function adaptJobRows(
  rows: RawJobRow[],
  options: AdaptJobRowOptions = {},
): CompanyJobListItem[] {
  return rows.map((row) => adaptJobRow(row, options));
}
