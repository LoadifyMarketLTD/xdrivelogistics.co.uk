export type LoadDetailSource = {
  load_details?: string | null;
  pickup_time_slot?: string | null;
  delivery_time_slot?: string | null;
  collection_contact_name?: string | null;
  collection_contact_phone?: string | null;
  delivery_contact_name?: string | null;
  delivery_contact_phone?: string | null;
  customer_reference?: string | null;
  purchase_order_number?: string | null;
  booking_reference?: string | null;
  requested_vehicle_label?: string | null;
  requested_cargo_label?: string | null;
  cargo_value_gbp?: number | string | null;
  pallet_type?: string | null;
  pallet_stackable?: boolean | null;
  collection_forklift_available?: boolean | null;
  collection_tail_lift_required?: boolean | null;
  collection_handball_required?: boolean | null;
  delivery_forklift_available?: boolean | null;
  delivery_tail_lift_required?: boolean | null;
  delivery_handball_required?: boolean | null;
  document_checklist?: string[] | null;
  pickup_postcode?: string | null;
  delivery_postcode?: string | null;
  weight_kg?: number | string | null;
  length_cm?: number | string | null;
  width_cm?: number | string | null;
  height_cm?: number | string | null;
  pallets?: number | string | null;
  vehicle_type?: string | null;
  cargo_type?: string | null;
  access_restrictions?: string | null;
  special_requirements?: string | null;
};

type ParsedLoadDetails = {
  references?: {
    customerReference?: string | null;
    purchaseOrderNumber?: string | null;
    bookingReference?: string | null;
  };
  requestedVehicle?: string | null;
  requestedCargo?: string | null;
  collection?: {
    timeSlot?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
    forkliftAvailable?: boolean | null;
    tailLiftRequired?: boolean | null;
    handballRequired?: boolean | null;
  };
  delivery?: {
    timeSlot?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
    forkliftAvailable?: boolean | null;
    tailLiftRequired?: boolean | null;
    handballRequired?: boolean | null;
  };
  dimensionsCm?: {
    length?: string | number | null;
    width?: string | number | null;
    height?: string | number | null;
  };
  cargoValueGbp?: string | number | null;
  palletDetails?: {
    count?: string | number | null;
    type?: string | null;
    stackable?: boolean | null;
  } | null;
  documentChecklist?: string[];
  notes?: string | null;
};

export type LoadDetailItem = {
  label: string;
  value: string;
};

export type LoadDetailSection = {
  title: string;
  items: LoadDetailItem[];
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const parseDetails = (raw: string | null | undefined): ParsedLoadDetails | null => {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? (parsed as ParsedLoadDetails) : null;
  } catch {
    return null;
  }
};

const text = (...values: Array<string | number | boolean | null | undefined>) => {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const rendered = String(value).trim();
    if (rendered) return rendered;
  }
  return '';
};

const boolText = (value: boolean | null | undefined) => {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return '';
};

const money = (value: string | number | null | undefined) => {
  const rendered = text(value);
  if (!rendered) return '';
  const numeric = Number(rendered);
  return Number.isFinite(numeric) ? `GBP ${numeric.toFixed(2)}` : rendered;
};

const joinDimensions = (source: LoadDetailSource, parsed: ParsedLoadDetails | null) => {
  const length = text(source.length_cm, parsed?.dimensionsCm?.length);
  const width = text(source.width_cm, parsed?.dimensionsCm?.width);
  const height = text(source.height_cm, parsed?.dimensionsCm?.height);
  return [length, width, height].every(Boolean) ? `${length} x ${width} x ${height} cm` : '';
};

const add = (items: LoadDetailItem[], label: string, value: string) => {
  if (value) items.push({ label, value });
};

export const getLoadDetailSections = (source: LoadDetailSource): LoadDetailSection[] => {
  const parsed = parseDetails(source.load_details);
  const references: LoadDetailItem[] = [];
  const timing: LoadDetailItem[] = [];
  const contacts: LoadDetailItem[] = [];
  const cargo: LoadDetailItem[] = [];
  const loading: LoadDetailItem[] = [];
  const requirements: LoadDetailItem[] = [];
  const documents: LoadDetailItem[] = [];

  add(references, 'Customer ref', text(source.customer_reference, parsed?.references?.customerReference));
  add(references, 'PO number', text(source.purchase_order_number, parsed?.references?.purchaseOrderNumber));
  add(references, 'Booking ref', text(source.booking_reference, parsed?.references?.bookingReference));

  add(timing, 'Pickup slot', text(source.pickup_time_slot, parsed?.collection?.timeSlot));
  add(timing, 'Delivery slot', text(source.delivery_time_slot, parsed?.delivery?.timeSlot));
  add(timing, 'Pickup postcode', text(source.pickup_postcode));
  add(timing, 'Delivery postcode', text(source.delivery_postcode));

  add(contacts, 'Collection contact', [text(source.collection_contact_name, parsed?.collection?.contactName), text(source.collection_contact_phone, parsed?.collection?.contactPhone)].filter(Boolean).join(' / '));
  add(contacts, 'Delivery contact', [text(source.delivery_contact_name, parsed?.delivery?.contactName), text(source.delivery_contact_phone, parsed?.delivery?.contactPhone)].filter(Boolean).join(' / '));

  add(cargo, 'Vehicle', text(source.requested_vehicle_label, parsed?.requestedVehicle, source.vehicle_type?.replace(/_/g, ' ')));
  add(cargo, 'Cargo', text(source.requested_cargo_label, parsed?.requestedCargo, source.cargo_type?.replace(/_/g, ' ')));
  add(cargo, 'Weight', text(source.weight_kg) ? `${text(source.weight_kg)} kg` : '');
  add(cargo, 'Dimensions', joinDimensions(source, parsed));
  add(cargo, 'Cargo value', money(source.cargo_value_gbp ?? parsed?.cargoValueGbp));
  add(cargo, 'Pallets', text(source.pallets, parsed?.palletDetails?.count));
  add(cargo, 'Pallet type', text(source.pallet_type, parsed?.palletDetails?.type));
  add(cargo, 'Stackable', boolText(source.pallet_stackable ?? parsed?.palletDetails?.stackable));

  add(loading, 'Collection forklift', boolText(source.collection_forklift_available ?? parsed?.collection?.forkliftAvailable));
  add(loading, 'Collection tail lift', boolText(source.collection_tail_lift_required ?? parsed?.collection?.tailLiftRequired));
  add(loading, 'Collection handball', boolText(source.collection_handball_required ?? parsed?.collection?.handballRequired));
  add(loading, 'Delivery forklift', boolText(source.delivery_forklift_available ?? parsed?.delivery?.forkliftAvailable));
  add(loading, 'Delivery tail lift', boolText(source.delivery_tail_lift_required ?? parsed?.delivery?.tailLiftRequired));
  add(loading, 'Delivery handball', boolText(source.delivery_handball_required ?? parsed?.delivery?.handballRequired));

  add(requirements, 'Access', text(source.access_restrictions));
  add(requirements, 'Special', text(source.special_requirements));
  add(requirements, 'Notes', text(parsed?.notes));

  const checklist = source.document_checklist?.length ? source.document_checklist : parsed?.documentChecklist;
  add(documents, 'Requested docs', checklist?.join(', ') ?? '');

  return [
    { title: 'References', items: references },
    { title: 'Timing', items: timing },
    { title: 'Contacts', items: contacts },
    { title: 'Cargo', items: cargo },
    { title: 'Loading', items: loading },
    { title: 'Requirements', items: requirements },
    { title: 'Documents', items: documents },
  ].filter((section) => section.items.length > 0);
};

export const getLoadDetailSummary = (source: LoadDetailSource, limit = 6) => (
  getLoadDetailSections(source).flatMap((section) => section.items).slice(0, limit)
);
