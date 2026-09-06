import type { SupabaseClient } from '@supabase/supabase-js';

type AdminClient = SupabaseClient;

type DriverRow = {
  id: string;
  user_id: string | null;
  company_id: string | null;
  status: string | null;
  is_active: boolean | null;
  app_access: boolean | null;
  can_commercial_bid: boolean | null;
  driver_type: string | null;
};

type VehicleRow = {
  id: string;
  company_id: string | null;
  assigned_driver_id: string | null;
  status: string | null;
  type: string | null;
  reg_plate: string | null;
};

type VehicleDocumentRow = {
  vehicle_id: string;
  doc_type: string | null;
  status: string | null;
  expiry_date: string | null;
};

export type DriverOperationalEligibility = {
  eligible: boolean;
  driverId: string;
  userId: string | null;
  companyId: string | null;
  driverType: string | null;
  canonicalVehicleId: string | null;
  blockers: string[];
  checks: {
    accountActive: boolean;
    appAccess: boolean;
    commercialBidEnabled: boolean;
    identityVerified: boolean;
    onboardingApproved: boolean;
    personalComplianceValid: boolean;
    companyActive: boolean;
    membershipActive: boolean;
    canonicalVehiclePresent: boolean;
    canonicalVehicleUnambiguous: boolean;
    vehicleActive: boolean;
    vehicleComplianceValid: boolean;
  };
};

const normalise = (value: unknown) => String(value ?? '').trim().toLowerCase();
const normaliseDocType = (value: unknown) => normalise(value).replace(/[^a-z0-9]+/g, '');

const canonicalVehicleDocType = (value: unknown) => {
  const doc = normaliseDocType(value);
  if (['mot', 'vehiclemot', 'goodsvehicletest'].includes(doc)) return 'mot';
  if (['insurance', 'vehicleinsurance', 'motorfleetinsurance', 'insurancecertificate'].includes(doc)) return 'insurance';
  return doc;
};

const dateIsCurrent = (value: string | null | undefined) => {
  if (!value) return false;
  const expiry = new Date(`${value.slice(0, 10)}T23:59:59.999Z`).getTime();
  return Number.isFinite(expiry) && expiry >= Date.now();
};

export async function resolveDriverOperationalEligibility(
  supabaseAdmin: AdminClient,
  driverId: string,
): Promise<DriverOperationalEligibility> {
  const blockers: string[] = [];

  const { data: rawDriver, error: driverError } = await supabaseAdmin
    .from('drivers')
    .select('id,user_id,company_id,status,is_active,app_access,can_commercial_bid,driver_type')
    .eq('id', driverId)
    .maybeSingle();
  if (driverError) throw new Error(driverError.message);

  const driver = (rawDriver ?? null) as DriverRow | null;
  if (!driver) {
    return {
      eligible: false,
      driverId,
      userId: null,
      companyId: null,
      driverType: null,
      canonicalVehicleId: null,
      blockers: ['driver_not_found'],
      checks: {
        accountActive: false,
        appAccess: false,
        commercialBidEnabled: false,
        identityVerified: false,
        onboardingApproved: false,
        personalComplianceValid: false,
        companyActive: false,
        membershipActive: false,
        canonicalVehiclePresent: false,
        canonicalVehicleUnambiguous: false,
        vehicleActive: false,
        vehicleComplianceValid: false,
      },
    };
  }

  const driverStatus = normalise(driver.status);
  const accountActive = driverStatus === 'active' && driver.is_active === true;
  const appAccess = driver.app_access === true;
  const commercialBidEnabled = driver.can_commercial_bid === true;
  if (!accountActive) blockers.push('driver_account_not_active');
  if (!appAccess) blockers.push('driver_app_access_disabled');
  if (!commercialBidEnabled) blockers.push('commercial_bidding_not_permitted');
  if (!driver.user_id) blockers.push('driver_user_identity_missing');
  if (!driver.company_id) blockers.push('driver_company_context_missing');

  const userId = driver.user_id;
  const companyId = driver.company_id;

  const [identityResult, onboardingResult, companyResult, membershipResult, vehiclesResult] = await Promise.all([
    userId
      ? supabaseAdmin.from('platform_identity_registry').select('user_id,company_id,identity_mode,status,verified_at').eq('user_id', userId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    userId && companyId
      ? supabaseAdmin.from('onboarding_applications').select('id,company_id,account_type,status,risk_status,reviewed_at').eq('user_id', userId).eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    companyId
      ? supabaseAdmin.from('companies').select('id,status').eq('id', companyId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    userId && companyId
      ? supabaseAdmin.from('company_memberships').select('company_id,user_id,status,role_in_company').eq('user_id', userId).eq('company_id', companyId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabaseAdmin.from('vehicles').select('id,company_id,assigned_driver_id,status,type,reg_plate').eq('assigned_driver_id', driver.id).eq('status', 'active').limit(3),
  ]);

  const firstError = identityResult.error ?? onboardingResult.error ?? companyResult.error ?? membershipResult.error ?? vehiclesResult.error;
  if (firstError) throw new Error(firstError.message);

  const identity = identityResult.data as {
    user_id?: string | null;
    company_id?: string | null;
    identity_mode?: string | null;
    status?: string | null;
    verified_at?: string | null;
  } | null;
  const canonicalDriverType = normalise(driver.driver_type);
  const expectedIdentityMode = canonicalDriverType === 'owner_driver'
    ? 'owner_driver'
    : canonicalDriverType === 'company_driver'
      ? 'company_driver'
      : null;
  const identityVerified = Boolean(
    identity
    && normalise(identity.status) === 'active'
    && Boolean(identity.verified_at)
    && identity.company_id === companyId
    && expectedIdentityMode
    && normalise(identity.identity_mode) === expectedIdentityMode
  );
  if (!identityVerified) blockers.push('verified_driver_identity_missing');

  const onboarding = onboardingResult.data as {
    id?: string | null;
    company_id?: string | null;
    account_type?: string | null;
    status?: string | null;
    risk_status?: string | null;
    reviewed_at?: string | null;
  } | null;
  const expectedOnboardingTypes = canonicalDriverType === 'owner_driver'
    ? ['owner_driver']
    : canonicalDriverType === 'company_driver'
      ? ['individual_driver', 'company_driver']
      : [];
  const onboardingApproved = Boolean(
    onboarding
    && normalise(onboarding.status) === 'approved'
    && normalise(onboarding.risk_status) === 'clear'
    && onboarding.company_id === companyId
    && expectedOnboardingTypes.includes(normalise(onboarding.account_type))
  );
  if (!onboardingApproved) blockers.push('driver_onboarding_not_approved');

  let personalComplianceValid = false;
  if (onboardingApproved && onboarding?.id) {
    const { data: missingDocs, error: missingDocsError } = await supabaseAdmin.rpc(
      'get_missing_onboarding_documents',
      { p_application_id: onboarding.id },
    );
    if (missingDocsError) throw new Error(missingDocsError.message);
    personalComplianceValid = Array.isArray(missingDocs) && missingDocs.length === 0;
  }
  if (!personalComplianceValid) blockers.push('driver_personal_compliance_not_current');

  const companyStatus = normalise((companyResult.data as { status?: string | null } | null)?.status);
  const companyActive = Boolean(companyId) && ['active', 'approved'].includes(companyStatus);
  if (!companyActive) blockers.push('driver_company_not_active');

  const membershipActive = Boolean(
    membershipResult.data
    && normalise((membershipResult.data as { status?: string | null }).status) === 'active'
  );
  if (!membershipActive) blockers.push('driver_company_membership_not_active');

  const activeVehicles = ((vehiclesResult.data ?? []) as VehicleRow[])
    .filter((vehicle) => vehicle.assigned_driver_id === driver.id && normalise(vehicle.status) === 'active');
  const canonicalVehiclePresent = activeVehicles.length > 0;
  const canonicalVehicleUnambiguous = activeVehicles.length === 1;
  const canonicalVehicle = canonicalVehicleUnambiguous ? activeVehicles[0] : null;
  const vehicleActive = Boolean(canonicalVehicle);

  if (!canonicalVehiclePresent) blockers.push('canonical_vehicle_missing');
  if (activeVehicles.length > 1) blockers.push('canonical_vehicle_ambiguous');

  let vehicleComplianceValid = false;
  if (canonicalVehicle) {
    if (canonicalVehicle.company_id !== companyId) blockers.push('canonical_vehicle_company_mismatch');

    const { data: rawVehicleDocs, error: vehicleDocsError } = await supabaseAdmin
      .from('vehicle_documents')
      .select('vehicle_id,doc_type,status,expiry_date')
      .eq('vehicle_id', canonicalVehicle.id);
    if (vehicleDocsError) throw new Error(vehicleDocsError.message);

    const vehicleDocs = (rawVehicleDocs ?? []) as VehicleDocumentRow[];
    const validDocTypes = new Set(
      vehicleDocs
        .filter((document) => normalise(document.status) === 'approved' && dateIsCurrent(document.expiry_date))
        .map((document) => canonicalVehicleDocType(document.doc_type))
        .filter(Boolean),
    );
    const requiredVehicleDocs = ['mot', 'insurance'];
    const missingVehicleDocs = requiredVehicleDocs.filter((docType) => !validDocTypes.has(docType));
    vehicleComplianceValid = missingVehicleDocs.length === 0;
    for (const docType of missingVehicleDocs) blockers.push(`vehicle_document_missing_or_invalid:${docType}`);
  }

  return {
    eligible: blockers.length === 0,
    driverId: driver.id,
    userId,
    companyId,
    driverType: canonicalDriverType || null,
    canonicalVehicleId: canonicalVehicle?.id ?? null,
    blockers,
    checks: {
      accountActive,
      appAccess,
      commercialBidEnabled,
      identityVerified,
      onboardingApproved,
      personalComplianceValid,
      companyActive,
      membershipActive,
      canonicalVehiclePresent,
      canonicalVehicleUnambiguous,
      vehicleActive,
      vehicleComplianceValid,
    },
  };
}
