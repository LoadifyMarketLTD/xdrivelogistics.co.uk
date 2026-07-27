export type NearbyJobRow = {
  id: string;
  company_id: string | null;
  status: string | null;
  exchange_visibility: string | null;
  awarded_carrier_company_id: string | null;
  assigned_company_id?: string | null;
  assigned_driver_id: string | null;
  direct_invite_company_id: string | null;
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
  pickup_country_code?: string | null;
  delivery_country_code?: string | null;
  service_mode?: string | null;
  direct_delivery_required?: boolean | null;
  vehicle_type: string | null;
  requested_vehicle_type?: string | null;
  requested_vehicle_label: string | null;
  cargo_type: string | null;
  requested_cargo_label: string | null;
  pallets: number | null;
  weight_kg: number | string | null;
  budget_amount: number | string | null;
  currency: string | null;
  is_fixed_price: boolean | null;
  load_details: string | null;
  special_requirements: string | null;
  access_restrictions: string | null;
  job_distance_miles: number | string | null;
  job_distance_minutes: number | null;
  distance_to_pickup_miles: number | string | null;
  exchange_posted_at: string | null;
  companies?: { name?: string | null; company_number?: string | null } | Array<{ name?: string | null; company_number?: string | null }> | null;
};

function publicArea(postcode: unknown) {
  const value = String(postcode ?? '').trim().toUpperCase();
  return value ? `Approx. area · ${value.split(/\s+/)[0]}` : 'Area disclosed after allocation';
}

function numberOrNull(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function companyInfo(companies: NearbyJobRow['companies']) {
  if (Array.isArray(companies)) return companies[0] ?? null;
  return companies ?? null;
}

export function mapNearbyJob(row: NearbyJobRow, extras: Record<string, unknown> = {}) {
  const hasProposedPrice = row.budget_amount != null && Number(row.budget_amount) > 0;
  const company = companyInfo(row.companies);
  return {
    id: row.id,
    publicReference: `XDL-${row.id.slice(0, 8).toUpperCase()}`,
    poster: { name: company?.name ?? null, memberCode: company?.company_number ?? null },
    posterCompanyName: company?.name ?? null,
    pickup: {
      addressSummary: publicArea(row.pickup_postcode),
      postcode: publicArea(row.pickup_postcode),
      latitude: null,
      longitude: null,
      collectionFrom: row.pickup_datetime || row.pickup_time_slot || null,
      collectionTo: null,
    },
    delivery: {
      addressSummary: publicArea(row.delivery_postcode),
      postcode: publicArea(row.delivery_postcode),
      latitude: null,
      longitude: null,
      deliveryFrom: row.delivery_datetime || row.delivery_time_slot || null,
      deliveryTo: null,
    },
    vehicleType: row.requested_vehicle_label || row.requested_vehicle_type || row.vehicle_type || null,
    bodyType: row.vehicle_type || null,
    pallets: numberOrNull(row.pallets),
    weightKg: numberOrNull(row.weight_kg),
    freightType: row.requested_cargo_label || row.cargo_type || null,
    notesSummary: null,
    distanceToPickupMiles: numberOrNull(row.distance_to_pickup_miles),
    journeyDistanceMiles: numberOrNull(row.job_distance_miles),
    estimatedJourneyMinutes: numberOrNull(row.job_distance_minutes),
    publicPrice: {
      visible: hasProposedPrice,
      amount: hasProposedPrice ? numberOrNull(row.budget_amount) : null,
      currency: hasProposedPrice ? row.currency || 'GBP' : null,
    },
    hasProposedPrice,
    proposedPriceGbp: hasProposedPrice ? numberOrNull(row.budget_amount) : null,
    canQuote: true,
    canSave: true,
    expiresAt: null,
    pickupCountryCode: row.pickup_country_code || 'GB',
    deliveryCountryCode: row.delivery_country_code || 'GB',
    serviceMode: row.service_mode || null,
    directDeliveryRequired: row.direct_delivery_required === true,
    ...extras,
  };
}
