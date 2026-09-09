export const DRIVER_CPC_STANDARD_MAM_LIMIT_KG = 3500;
export const DRIVER_CPC_ZERO_EMISSION_CATEGORY_B_LIMIT_KG = 4250;

const LIGHT_VEHICLE_TYPES = new Set([
  'bicycle', 'motorbike', 'car', 'van_small', 'van_large', 'swb_van', 'mwb_van',
  'lwb_van', 'xlwb_van', 'luton', 'luton_tail_lift', 'curtainside_van', 'truck_3_5t',
]);

const HEAVY_VEHICLE_TYPES = new Set([
  'truck_5t', 'truck_7_5t', 'truck_12t', 'truck_18t', 'truck_26t', 'artic',
  'artic_44t_curtainsider', 'artic_44t_box_trailer', 'artic_44t_flatbed',
  'artic_44t_refrigerated', 'artic_44t_double_deck',
]);

export const normalizeVehicleType = (value: unknown) =>
  String(value ?? '').trim().toLowerCase().replace(/[ .-]+/g, '_');

export const parseVehicleMamKg = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export function vehicleRequiresDriverCpc(input: {
  type?: unknown;
  maxWeightKg?: unknown;
  zeroEmission?: boolean | null;
}) {
  const mamKg = parseVehicleMamKg(input.maxWeightKg);
  if (mamKg !== null) {
    if (input.zeroEmission === true && mamKg <= DRIVER_CPC_ZERO_EMISSION_CATEGORY_B_LIMIT_KG) return false;
    return mamKg > DRIVER_CPC_STANDARD_MAM_LIMIT_KG;
  }
  const normalizedType = normalizeVehicleType(input.type);
  if (HEAVY_VEHICLE_TYPES.has(normalizedType)) return true;
  if (LIGHT_VEHICLE_TYPES.has(normalizedType)) return false;
  return true; // Specialist/unknown vehicles must declare MAM before CPC can be waived.
}

export function vehicleMamCanBeInferredFromType(type: unknown) {
  const normalized = normalizeVehicleType(type);
  return LIGHT_VEHICLE_TYPES.has(normalized) || HEAVY_VEHICLE_TYPES.has(normalized);
}

export function defaultMamForVehicleType(type: unknown): number | null {
  const normalized = normalizeVehicleType(type);
  const explicit: Record<string, number> = {
    truck_3_5t: 3500,
    truck_5t: 5000,
    truck_7_5t: 7500,
    truck_12t: 12000,
    truck_18t: 18000,
    truck_26t: 26000,
    artic: 44000,
    artic_44t_curtainsider: 44000,
    artic_44t_box_trailer: 44000,
    artic_44t_flatbed: 44000,
    artic_44t_refrigerated: 44000,
    artic_44t_double_deck: 44000,
  };
  if (explicit[normalized]) return explicit[normalized];
  if (LIGHT_VEHICLE_TYPES.has(normalized)) return 3500;
  return null;
}

export const VEHICLE_COMPATIBILITY_RANK: Record<string, number> = {
  bicycle: 0,
  motorbike: 0,
  car: 0,
  small_van: 1,
  van_small: 1,
  swb_van: 2,
  mwb_van: 3,
  lwb_van: 4,
  xlwb_van: 5,
  van_large: 5,
  luton: 6,
  luton_tail_lift: 6,
  curtainside_van: 6,
  truck_3_5t: 7,
  truck_5t: 8,
  truck_7_5t: 9,
  truck_12t: 10,
  truck_18t: 11,
  truck_26t: 12,
  artic: 13,
  artic_44t_curtainsider: 13,
  artic_44t_box_trailer: 13,
  artic_44t_flatbed: 13,
  artic_44t_refrigerated: 13,
  artic_44t_double_deck: 13,
};

export function vehicleCanCoverRequestedType(actualType: unknown, requestedType: unknown) {
  const actual = normalizeVehicleType(actualType);
  const requested = normalizeVehicleType(requestedType);
  if (!requested) return true;
  const actualRank = VEHICLE_COMPATIBILITY_RANK[actual] ?? 0;
  const requestedRank = VEHICLE_COMPATIBILITY_RANK[requested] ?? 0;
  if (actualRank > 0 && requestedRank > 0) return actualRank >= requestedRank;
  return actual === requested;
}

export function selectBestCompatibleVehicle<T extends { id: string; type?: unknown; vehicle_type?: unknown; max_weight_kg?: unknown }>(
  vehicles: T[],
  requestedType?: unknown,
): T | null {
  const compatible = vehicles.filter((vehicle) =>
    vehicleCanCoverRequestedType(vehicle.type ?? vehicle.vehicle_type, requestedType),
  );
  if (compatible.length === 0) return null;
  return [...compatible].sort((a, b) => {
    const aRank = VEHICLE_COMPATIBILITY_RANK[normalizeVehicleType(a.type ?? a.vehicle_type)] ?? Number.MAX_SAFE_INTEGER;
    const bRank = VEHICLE_COMPATIBILITY_RANK[normalizeVehicleType(b.type ?? b.vehicle_type)] ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    const aMam = parseVehicleMamKg(a.max_weight_kg) ?? Number.MAX_SAFE_INTEGER;
    const bMam = parseVehicleMamKg(b.max_weight_kg) ?? Number.MAX_SAFE_INTEGER;
    if (aMam !== bMam) return aMam - bMam;
    return a.id.localeCompare(b.id);
  })[0];
}

