import type { SupabaseClient } from '@supabase/supabase-js';

export type BidderDecisionSeed = {
  bidId: string;
  companyId: string | null;
  driverId: string | null;
  userId: string | null;
  quoteVehicleId?: string | null;
};

export type BidderDecisionIdentity = {
  bidId: string;
  companyId: string | null;
  driverId: string | null;
  companyName: string | null;
  personName: string | null;
  companyType: string | null;
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
  vehicleRegistration: string | null;
  quotedVehicleId: string | null;
  linkedDriverId: string | null;
  driverDocumentStatuses: Record<string,string>;
  vehicleDocumentStatuses: Record<string,string>;
  complianceRetrieved: boolean;
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
  options: { includeCompliance?: boolean } = {},
): Promise<BidderDecisionIdentity[]> {
  if (seeds.length === 0) return [];

  const driverIds = [...new Set(seeds.map((seed) => seed.driverId).filter((id): id is string => Boolean(id)))];
  const userIds = [...new Set(seeds.map((seed) => seed.userId).filter((id): id is string => Boolean(id)))];
  const [driversResult, profilesResult] = await Promise.all([
    driverIds.length
      ? admin.from('drivers').select('id, display_name, company_id, availability_status').in('id', driverIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? admin.from('profiles').select('user_id, full_name, company_id').in('user_id', userIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (driversResult.error || profilesResult.error) {
    throw driversResult.error ?? profilesResult.error ?? new Error('Bidder profile enrichment failed.');
  }

  const usersDriversResult = userIds.length
    ? await admin.from('drivers').select('id,user_id,display_name,company_id,availability_status').in('user_id',userIds)
    : {data: [], error: null};
  if (usersDriversResult.error) throw usersDriversResult.error;
  const drivers = new Map([...(driversResult.data ?? []),...(usersDriversResult.data ?? [])].map((row) => [row.id, row]));
  const driversByUser = new Map((usersDriversResult.data ?? []).map(row => [row.user_id, row]));
  const resolvedDriverId = (seed:BidderDecisionSeed) => seed.driverId ?? (seed.userId ? driversByUser.get(seed.userId)?.id ?? null : null);
  const resolvedDriverIds = [...new Set(seeds.map(resolvedDriverId).filter((id):id is string => Boolean(id)))];
  const profiles = new Map((profilesResult.data ?? []).map((row) => [row.user_id, row]));
  const resolvedCompanyId = (seed: BidderDecisionSeed) => {
    const driverId = resolvedDriverId(seed);
    const driver = driverId ? drivers.get(driverId) : null;
    const profile = seed.userId ? profiles.get(seed.userId) : null;
    return seed.companyId ?? driver?.company_id ?? profile?.company_id ?? null;
  };
  const companyIds = [...new Set(seeds.map(resolvedCompanyId).filter((id): id is string => Boolean(id)))];
  const companiesResult = companyIds.length
    ? await admin.from('companies').select('id, name, xd_id, phone, company_type').in('id', companyIds)
    : { data: [], error: null };
  if (companiesResult.error) throw companiesResult.error;

  const companyVehiclesResult = companyIds.length
    ? await admin.from('vehicles').select('id, company_id, assigned_driver_id, type, reg_plate, has_tail_lift, pallets_capacity').in('company_id', companyIds)
    : { data: [], error: null };
  const driverVehiclesResult = resolvedDriverIds.length
    ? await admin.from('vehicles').select('id, company_id, assigned_driver_id, type, reg_plate, has_tail_lift, pallets_capacity').in('assigned_driver_id', resolvedDriverIds)
    : { data: [], error: null };
  if (companyVehiclesResult.error || driverVehiclesResult.error) {
    throw companyVehiclesResult.error ?? driverVehiclesResult.error ?? new Error('Bidder vehicle enrichment failed.');
  }

  const companies = new Map((companiesResult.data ?? []).map((row) => [row.id, row]));
  const allVehicles = new Map<string, (typeof companyVehiclesResult.data extends Array<infer T> ? T : never)>();
  for (const vehicle of [...(companyVehiclesResult.data ?? []), ...(driverVehiclesResult.data ?? [])]) {
    allVehicles.set(vehicle.id, vehicle);
  }
  const quoteVehicleIds = [...new Set(seeds.map(seed=>seed.quoteVehicleId).filter((id):id is string=>Boolean(id)))];
  if(quoteVehicleIds.length){
    const {data:quotedVehicles,error:quotedVehicleError}=await admin.from('vehicles').select('id,company_id,assigned_driver_id,type,reg_plate,has_tail_lift,pallets_capacity').in('id',quoteVehicleIds);
    if(quotedVehicleError)throw quotedVehicleError;
    for(const vehicle of quotedVehicles??[])allVehicles.set(vehicle.id,vehicle);
  }
  const vehicles = [...allVehicles.values()];
  const vehicleIds = vehicles.map(vehicle=>vehicle.id);
  const [driverDocs,vehicleDocs] = await Promise.all([
    options.includeCompliance && resolvedDriverIds.length ? admin.from('driver_documents').select('driver_id,doc_type,status,expiry_date,verified_at,created_at').in('driver_id',resolvedDriverIds).order('created_at',{ascending:false}).limit(1000) : Promise.resolve({data:[],error:null}),
    options.includeCompliance && vehicleIds.length ? admin.from('vehicle_documents').select('vehicle_id,doc_type,status,expiry_date,verified_at,created_at').in('vehicle_id',vehicleIds).order('created_at',{ascending:false}).limit(1000) : Promise.resolve({data:[],error:null}),
  ]);
  const complianceRetrieved=options.includeCompliance===true&&!driverDocs.error&&!vehicleDocs.error;
  const documentStatuses=(docs:Array<{doc_type:string;status:string;expiry_date:string|null;verified_at:string|null}>)=>{
    const out:Record<string,string>={};
    for(const doc of docs){
      const key=String(doc.doc_type||'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
      if(!key||out[key])continue;
      const expired=!!doc.expiry_date&&Date.parse(doc.expiry_date)<Date.now();
      const accepted=['approved','verified','valid'].includes(String(doc.status||'').toLowerCase())&&!!doc.verified_at;
      out[key]=expired?'Expired':accepted?'Verified':String(doc.status||'Pending review').replaceAll('_',' ');
    }
    return out;
  };
  const vehicleByDriver = new Map<string, (typeof vehicles)[number]>();
  for (const vehicle of vehicles) {
    if (vehicle.assigned_driver_id && !vehicleByDriver.has(vehicle.assigned_driver_id)) vehicleByDriver.set(vehicle.assigned_driver_id, vehicle);
  }
  return seeds.map((seed) => {
    const effectiveDriverId = resolvedDriverId(seed);
    const driver = effectiveDriverId ? drivers.get(effectiveDriverId) ?? null : null;
    const profile = seed.userId ? profiles.get(seed.userId) ?? null : null;
    const companyId = resolvedCompanyId(seed);
    const company = companyId ? companies.get(companyId) ?? null : null;
    const driverVehicle = seed.quoteVehicleId ? allVehicles.get(seed.quoteVehicleId) ?? null : effectiveDriverId ? vehicleByDriver.get(effectiveDriverId) ?? null : null;
    const companyFleet = companyId ? vehicles.filter((vehicle) => vehicle.company_id === companyId) : [];
    const fleetVehicleTypes = [...new Set(companyFleet.map((vehicle) => text(vehicle.type)).filter((value): value is string => Boolean(value)))].sort();
    const specialistServices = [...new Set(companyFleet.flatMap((vehicle) => vehicleServices(vehicle.type, vehicle.has_tail_lift)))].sort();
    const companyName = text(company?.name);
    const personName = text(driver?.display_name) ?? text(profile?.full_name);

    return {
      bidId: seed.bidId,
      companyId,
      driverId: effectiveDriverId,
      companyName,
      personName,
      companyType: text(company?.company_type) ?? (companyId ? null : 'owner_driver'),
      displayName: companyName ?? personName ?? 'Carrier profile incomplete',
      memberId: text(company?.xd_id),
      businessPhone: text(company?.phone),
      quoteLevel: effectiveDriverId ? 'driver' as const : 'company' as const,
      driverAvailability: text(driver?.availability_status),
      driverVehicleType: text(driverVehicle?.type),
      driverVehicleTailLift: driverVehicle?.has_tail_lift === true,
      driverVehiclePallets: numeric(driverVehicle?.pallets_capacity),
      fleetVehicleTypes,
      specialistServices,
      linkedDriverId: effectiveDriverId,
      quotedVehicleId: seed.quoteVehicleId??null,
      vehicleRegistration: text(driverVehicle?.reg_plate),
      complianceRetrieved,
      driverDocumentStatuses: documentStatuses(((driverDocs.data??[]) as Array<{driver_id:string;doc_type:string;status:string;expiry_date:string|null;verified_at:string|null}>).filter(doc=>doc.driver_id===effectiveDriverId)),
      vehicleDocumentStatuses: documentStatuses(((vehicleDocs.data??[]) as Array<{vehicle_id:string;doc_type:string;status:string;expiry_date:string|null;verified_at:string|null}>).filter(doc=>doc.vehicle_id===driverVehicle?.id)),
    };
  });
}
