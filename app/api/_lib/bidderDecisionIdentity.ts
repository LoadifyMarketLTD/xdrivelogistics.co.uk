import type { SupabaseClient } from '@supabase/supabase-js';

export type BidderDecisionSeed = {
  bidId: string;
  companyId: string | null;
  driverId: string | null;
  userId: string | null;
};

export type BidderDecisionIdentity = {
  bidId: string;
  companyId: string | null;
  driverId: string | null;
  companyName: string | null;
  personName: string | null;
  companyType: string | null;
  driverType: string | null;
  memberSince: string | null;
  completedJobs: number | null;
  customerRating: number | null;
  documentStatuses: Array<{ name: string; status: string; expiryDate: string | null }>;
  verificationUnavailable: boolean;
  displayName: string;
  memberId: string | null;
  businessPhone: string | null;
  quoteLevel: 'driver' | 'company';
  driverAvailability: string | null;
  driverVehicleType: string | null;
  driverVehicleTailLift: boolean;
  driverVehiclePallets: number | null;
  fleetVehicleTypes: string[];
  specialistServices: string[];
};
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
const numeric = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const vehicleServices = (typeValue: unknown, hasTailLift: unknown) => {
  const type = String(typeValue ?? '').trim().toLowerCase();
  const services = new Set<string>();
  if (type.includes('hiab')) services.add('Hiab');
  if (type.includes('moffett')) services.add('Moffett');
  if (type.includes('adr')) services.add('ADR');
  if (type.includes('refrigerated')) services.add('Refrigerated');
  if (type.includes('temperature')) services.add('Temperature controlled');
  if (type.includes('curtainside') || type.includes('curtainsider')) services.add('Curtainside');
  if (type.includes('flatbed')) services.add('Flatbed');
  if (hasTailLift === true || type.includes('tail_lift') || type.includes('tail lift')) services.add('Tail lift');
  return [...services];
};

export async function enrichBidderDecisionIdentities(
  admin: SupabaseClient,
  seeds: BidderDecisionSeed[],
): Promise<BidderDecisionIdentity[]> {
  if (seeds.length === 0) return [];

  const driverIds = [...new Set(seeds.map((seed) => seed.driverId).filter((id): id is string => Boolean(id)))];
  const userIds = [...new Set(seeds.map((seed) => seed.userId).filter((id): id is string => Boolean(id)))];
  const [driversResult, profilesResult] = await Promise.all([
    driverIds.length
      ? admin.from('drivers').select('id, display_name, company_id, availability_status, driver_type, created_at, user_id').in('id', driverIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? admin.from('profiles').select('user_id, full_name, company_id').in('user_id', userIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (driversResult.error || profilesResult.error) {
    throw driversResult.error ?? profilesResult.error ?? new Error('Bidder profile enrichment failed.');
  }

  const drivers = new Map((driversResult.data ?? []).map((row) => [row.id, row]));
  const profiles = new Map((profilesResult.data ?? []).map((row) => [row.user_id, row]));
  const resolvedCompanyId = (seed: BidderDecisionSeed) => {
    const driver = seed.driverId ? drivers.get(seed.driverId) : null;
    const profile = seed.userId ? profiles.get(seed.userId) : null;
    return seed.companyId ?? driver?.company_id ?? profile?.company_id ?? null;
  };
  const companyIds = [...new Set(seeds.map(resolvedCompanyId).filter((id): id is string => Boolean(id)))];
  const companiesResult = companyIds.length
    ? await admin.from('companies').select('id, name, xd_id, phone, company_type, created_at').in('id', companyIds)
    : { data: [], error: null };
  if (companiesResult.error) throw companiesResult.error;

  const companyVehiclesResult = companyIds.length
    ? await admin.from('vehicles').select('id, company_id, assigned_driver_id, type, has_tail_lift, pallets_capacity').in('company_id', companyIds)
    : { data: [], error: null };
  const driverVehiclesResult = driverIds.length
    ? await admin.from('vehicles').select('id, company_id, assigned_driver_id, type, has_tail_lift, pallets_capacity').in('assigned_driver_id', driverIds)
    : { data: [], error: null };
  if (companyVehiclesResult.error || driverVehiclesResult.error) {
    throw companyVehiclesResult.error ?? driverVehiclesResult.error ?? new Error('Bidder vehicle enrichment failed.');
  }

  const companies = new Map((companiesResult.data ?? []).map((row) => [row.id, row]));
  const allVehicles = new Map<string, (typeof companyVehiclesResult.data extends Array<infer T> ? T : never)>();
  for (const vehicle of [...(companyVehiclesResult.data ?? []), ...(driverVehiclesResult.data ?? [])]) {
    allVehicles.set(vehicle.id, vehicle);
  }
  const vehicles = [...allVehicles.values()];
  const vehicleByDriver = new Map<string, (typeof vehicles)[number]>();
  for (const vehicle of vehicles) {
    if (vehicle.assigned_driver_id && !vehicleByDriver.has(vehicle.assigned_driver_id)) vehicleByDriver.set(vehicle.assigned_driver_id, vehicle);
  }
  // Commercial award reviews show only verification metadata; never expose document files or identity numbers.
  const vehicleIds = vehicles.map((vehicle) => vehicle.id);
  const reviewedUserIds = [...new Set((driversResult.data ?? []).map((driver) => driver.user_id).filter((id): id is string => Boolean(id)))];
  const empty = { data: [], error: null };
  const [driverDocs, vehicleDocs, companyDocs, completed, reviews] = await Promise.all([
    driverIds.length ? admin.from('driver_documents').select('driver_id, doc_type, status, expiry_date').in('driver_id', driverIds) : Promise.resolve(empty),
    vehicleIds.length ? admin.from('vehicle_documents').select('vehicle_id, doc_type, status, expiry_date').in('vehicle_id', vehicleIds) : Promise.resolve(empty),
    companyIds.length ? admin.from('company_documents').select('company_id, doc_type, status, expiry_date').in('company_id', companyIds) : Promise.resolve(empty),
    driverIds.length ? admin.from('jobs').select('assigned_driver_id, current_status').in('assigned_driver_id', driverIds).in('current_status', ['delivered', 'completed']).limit(5000) : Promise.resolve(empty),
    reviewedUserIds.length ? admin.from('reviews').select('reviewed_user_id, rating').in('reviewed_user_id', reviewedUserIds) : Promise.resolve(empty),
  ]);
  // Supplementary verification data must not block core bidder identity or awarding.
  const verificationUnavailable = Boolean(driverDocs.error || vehicleDocs.error || companyDocs.error);
  const statusOf = (value: unknown, expiry: unknown) => {
    const raw = String(value ?? 'unknown').trim().toLowerCase();
    if (expiry && !Number.isNaN(Date.parse(String(expiry))) && Date.parse(String(expiry)) < Date.now()) return "Expired";
    return raw === 'approved' || raw === 'verified' ? 'Approved' : raw === 'rejected' ? 'Rejected' : raw === 'pending' ? 'Pending' : raw === 'expired' ? 'Expired' : 'Not verified';
  };
  const makeRecord = (scope: string, doc: { doc_type?: unknown; status?: unknown; expiry_date?: unknown }) => ({
    name: scope + ' · ' + String(doc.doc_type ?? 'Document'),
    status: statusOf(doc.status, doc.expiry_date),
    expiryDate: doc.expiry_date ? String(doc.expiry_date) : null,
  });

  return seeds.map((seed) => {
    const driver = seed.driverId ? drivers.get(seed.driverId) ?? null : null;
    const profile = seed.userId ? profiles.get(seed.userId) ?? null : null;
    const companyId = resolvedCompanyId(seed);
    const company = companyId ? companies.get(companyId) ?? null : null;
    const driverVehicle = seed.driverId ? vehicleByDriver.get(seed.driverId) ?? null : null;
    const companyFleet = companyId ? vehicles.filter((vehicle) => vehicle.company_id === companyId) : [];
    const fleetVehicleTypes = [...new Set(companyFleet.map((vehicle) => text(vehicle.type)).filter((value): value is string => Boolean(value)))].sort();
    const specialistServices = [...new Set(companyFleet.flatMap((vehicle) => vehicleServices(vehicle.type, vehicle.has_tail_lift)))].sort();
    const companyName = text(company?.name);
    const personName = text(driver?.display_name) ?? text(profile?.full_name);
    const associatedVehicleIds = new Set(vehicles.filter((vehicle) => vehicle.assigned_driver_id === seed.driverId || (!seed.driverId && vehicle.company_id === companyId)).map((vehicle) => vehicle.id));
    const documentStatuses = [
      ...(driverDocs.error ? [] : driverDocs.data ?? []).filter((doc) => doc.driver_id === seed.driverId).map((doc) => makeRecord('Driver', doc)),
      ...(vehicleDocs.error ? [] : vehicleDocs.data ?? []).filter((doc) => associatedVehicleIds.has(doc.vehicle_id)).map((doc) => makeRecord('Vehicle', doc)),
      ...(companyDocs.error ? [] : companyDocs.data ?? []).filter((doc) => doc.company_id === companyId).map((doc) => makeRecord('Company', doc)),
    ];
    const completedJobs = seed.driverId && !completed.error ? (completed.data ?? []).filter((job) => job.assigned_driver_id === seed.driverId).length : null;
    const subjectUserId = driver?.user_id ?? seed.userId;
    const ratings = (reviews.error ? [] : reviews.data ?? []).filter((review) => review.reviewed_user_id === subjectUserId && typeof review.rating === "number").map((review) => review.rating as number);
    const customerRating = ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : null;


    return {
      bidId: seed.bidId,
      companyId,
      driverId: seed.driverId,
      companyName,
      personName,
      companyType: text(company?.company_type) ?? (companyId ? null : 'owner_driver'),
      driverType: text(driver?.driver_type),
      memberSince: text(driver?.created_at) ?? text(company?.created_at),
      completedJobs,
      customerRating,
      documentStatuses,
      verificationUnavailable,
      displayName: companyName ?? personName ?? 'Carrier profile incomplete',
      memberId: text(company?.xd_id),
      businessPhone: text(company?.phone),
      quoteLevel: seed.driverId ? 'driver' as const : 'company' as const,
      driverAvailability: text(driver?.availability_status),
      driverVehicleType: text(driverVehicle?.type),
      driverVehicleTailLift: driverVehicle?.has_tail_lift === true,
      driverVehiclePallets: numeric(driverVehicle?.pallets_capacity),
      fleetVehicleTypes,
      specialistServices,
    };
  });
}
