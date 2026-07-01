import type { CargoType, VehicleType } from './types/database';

/**
 * Canonical display labels for all VehicleType slugs.
 * Used wherever a stored slug needs to be rendered as human-readable text.
 */
export const VEHICLE_TYPE_LABELS: Record<string, string> = {
  bicycle: 'Bicycle',
  motorbike: 'Motorbike',
  car: 'Car',
  van_small: 'Small Van',
  van_large: 'Large Van',
  swb_van: 'SWB Van',
  mwb_van: 'MWB Van',
  lwb_van: 'LWB Van',
  xlwb_van: 'XLWB Van',
  luton: 'Luton',
  luton_tail_lift: 'Luton Tail Lift',
  curtainside_van: 'Curtainside Van',
  truck_3_5t: '3.5T',
  truck_5t: '5T',
  truck_7_5t: '7.5t Truck',
  truck_12t: '12T',
  truck_18t: '18T',
  truck_26t: '26T',
  artic: 'Artic',
  artic_44t_curtainsider: 'Artic 44T Curtainsider',
  artic_44t_box_trailer: 'Artic 44T Box Trailer',
  artic_44t_flatbed: 'Artic 44T Flatbed',
  artic_44t_refrigerated: 'Artic 44T Refrigerated',
  artic_44t_double_deck: 'Artic 44T Double Deck',
  hiab: 'Hiab',
  moffett: 'Moffett',
  adr_vehicle: 'ADR Vehicle',
  refrigerated_vehicle: 'Refrigerated Vehicle',
  temperature_controlled_vehicle: 'Temperature Controlled Vehicle',
};

/**
 * Grouped vehicle types for <select>/<optgroup> rendering.
 * Each entry is [groupLabel, [[displayLabel, VehicleType], ...]].
 */
export const VEHICLE_GROUPS: Array<[string, Array<[string, VehicleType]>]> = [
  ['Vans', [
    ['Small Van', 'van_small'],
    ['SWB Van', 'swb_van'],
    ['MWB Van', 'mwb_van'],
    ['LWB Van', 'lwb_van'],
    ['XLWB Van', 'xlwb_van'],
    ['Large Van', 'van_large'],
    ['Luton', 'luton'],
    ['Luton Tail Lift', 'luton_tail_lift'],
    ['Curtainside Van', 'curtainside_van'],
  ]],
  ['Rigid Trucks', [
    ['3.5T', 'truck_3_5t'],
    ['5T', 'truck_5t'],
    ['7.5T', 'truck_7_5t'],
    ['12T', 'truck_12t'],
    ['18T', 'truck_18t'],
    ['26T', 'truck_26t'],
  ]],
  ['HGV / Artics', [
    ['Artic', 'artic'],
    ['Artic 44T Curtainsider', 'artic_44t_curtainsider'],
    ['Artic 44T Box Trailer', 'artic_44t_box_trailer'],
    ['Artic 44T Flatbed', 'artic_44t_flatbed'],
    ['Artic 44T Refrigerated', 'artic_44t_refrigerated'],
    ['Artic 44T Double Deck', 'artic_44t_double_deck'],
  ]],
  ['Specialist', [
    ['Hiab', 'hiab'],
    ['Moffett', 'moffett'],
    ['ADR Vehicle', 'adr_vehicle'],
    ['Refrigerated Vehicle', 'refrigerated_vehicle'],
    ['Temperature Controlled Vehicle', 'temperature_controlled_vehicle'],
  ]],
];

// Build a label → VehicleType lookup from VEHICLE_GROUPS (case-insensitive)
const _labelToVehicleType: Record<string, VehicleType> = {};
for (const [, options] of VEHICLE_GROUPS) {
  for (const [label, value] of options) {
    _labelToVehicleType[label.toLowerCase()] = value;
  }
}

/**
 * Map a human-readable vehicle label (e.g. "LWB Van", "Artic 44T Flatbed")
 * to its VehicleType slug. Falls back to 'van_large' for unrecognised values.
 */
export function labelToVehicleType(label: string): VehicleType {
  return _labelToVehicleType[label.toLowerCase()] ?? 'van_large';
}

/** Canonical display labels for all CargoType slugs. */
export const CARGO_TYPE_LABELS: Record<CargoType, string> = {
  documents: 'Documents',
  packages: 'Parcels',
  parcels: 'Parcels',
  pallets: 'Pallets',
  machinery: 'Machinery',
  furniture: 'Furniture',
  retail_goods: 'Retail Goods',
  mixed_freight: 'Mixed Freight',
  adr_goods: 'ADR Goods',
  temperature_controlled_freight: 'Temperature Controlled Freight',
  equipment: 'Equipment',
  other: 'Other',
};

// Build a label → CargoType lookup (case-insensitive)
const _labelToCargoType: Record<string, CargoType> = {
  documents: 'documents',
  parcels: 'packages',
  pallets: 'pallets',
  machinery: 'machinery',
  furniture: 'furniture',
  'retail goods': 'retail_goods',
  'mixed freight': 'mixed_freight',
  'adr goods': 'adr_goods',
  'temperature controlled freight': 'temperature_controlled_freight',
  other: 'other',
};

/**
 * Map a human-readable cargo label (e.g. "Retail Goods", "Mixed Freight")
 * to its CargoType slug. Falls back to 'other' for unrecognised values.
 */
export function labelToCargoType(label: string): CargoType {
  return _labelToCargoType[label.toLowerCase()] ?? 'other';
}
