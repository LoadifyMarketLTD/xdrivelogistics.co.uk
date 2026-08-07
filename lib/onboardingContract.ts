export const BROKER_DOCUMENT_TYPES = [
  'company_registration',
  'public_liability',
  'vat_registration',
] as const;

export const FLEET_DOCUMENT_TYPES = [
  'company_registration',
  'public_liability',
  'goods_in_transit',
  'vehicle_insurance',
  'operator_licence',
  'vat_registration',
] as const;

export const OWNER_DRIVER_DOCUMENT_TYPES = [
  'driving_licence',
  'proof_of_address',
  'right_to_work',
  'insurance',
  'cpc',
  'visa_document',
] as const;

export const COMPANY_DRIVER_DOCUMENT_TYPES = [
  'driving_licence',
  'proof_of_address',
  'right_to_work',
  'cpc',
  'visa_document',
] as const;

/**
 * Public registration exposes exactly these four product account identities.
 * The persisted Owner Operator identity remains `owner_driver` by design.
 */
export type PublicOnboardingAccountType =
  | 'customer_shipper'
  | 'transport_broker'
  | 'fleet_operator'
  | 'owner_driver';

/** Company Driver is invitation-only and never appears in public registration. */
export type InvitationOnlyOnboardingAccountType = 'company_driver';

export type CanonicalOnboardingAccountType =
  | PublicOnboardingAccountType
  | InvitationOnlyOnboardingAccountType;

export const PUBLIC_ONBOARDING_ACCOUNT_TYPES: readonly PublicOnboardingAccountType[] = [
  'customer_shipper',
  'transport_broker',
  'fleet_operator',
  'owner_driver',
] as const;

export const INVITATION_ONLY_ONBOARDING_ACCOUNT_TYPES: readonly InvitationOnlyOnboardingAccountType[] = [
  'company_driver',
] as const;

export type PersistedOnboardingAccountType = CanonicalOnboardingAccountType;

export type OnboardingDocumentFamily = 'company' | 'identity';
export type OnboardingDocumentRequirement = 'required' | 'conditional';

export type OnboardingDocumentDefinition = {
  type: string;
  label: string;
  family: OnboardingDocumentFamily;
  requirement: OnboardingDocumentRequirement;
  condition?: string;
};

export type OnboardingContractDefinition = {
  label: string;
  description: string;
  persistedAccountType: PersistedOnboardingAccountType;
  routeSegment: 'customer' | 'broker' | 'fleet' | 'owner-driver' | 'company-driver';
  publicRegistration: boolean;
  createsCompanyWorkspace: boolean;
  requiresPlatformReview: boolean;
  documents: readonly OnboardingDocumentDefinition[];
};

const document = (
  type: string,
  label: string,
  family: OnboardingDocumentFamily,
  requirement: OnboardingDocumentRequirement,
  condition?: string,
): OnboardingDocumentDefinition => ({ type, label, family, requirement, condition });

export const ONBOARDING_CONTRACT: Record<CanonicalOnboardingAccountType, OnboardingContractDefinition> = {
  customer_shipper: {
    label: 'Customer Shipper',
    description: 'A customer posting or managing freight without carrier permissions.',
    persistedAccountType: 'customer_shipper',
    routeSegment: 'customer',
    publicRegistration: true,
    createsCompanyWorkspace: true,
    requiresPlatformReview: false,
    documents: [],
  },
  transport_broker: {
    label: 'Transport Broker',
    description: 'A verified business arranging transport between customers and carriers.',
    persistedAccountType: 'transport_broker',
    routeSegment: 'broker',
    publicRegistration: true,
    createsCompanyWorkspace: true,
    requiresPlatformReview: true,
    documents: [
      document('company_registration', 'Company registration evidence', 'company', 'required'),
      document('public_liability', 'Public liability insurance', 'company', 'required'),
      document(
        'vat_registration',
        'VAT registration certificate',
        'company',
        'conditional',
        'Required only when the business is VAT registered.',
      ),
    ],
  },
  fleet_operator: {
    label: 'Fleet Operator',
    description: 'A carrier company operating a fleet and inviting its own Company Drivers.',
    persistedAccountType: 'fleet_operator',
    routeSegment: 'fleet',
    publicRegistration: true,
    createsCompanyWorkspace: true,
    requiresPlatformReview: true,
    documents: [
      document('company_registration', 'Company registration evidence', 'company', 'required'),
      document('public_liability', 'Public liability insurance', 'company', 'required'),
      document('goods_in_transit', 'Goods in Transit insurance', 'company', 'required'),
      document('vehicle_insurance', 'Vehicle or motor fleet insurance', 'company', 'required'),
      document(
        'operator_licence',
        'Operator licence',
        'company',
        'conditional',
        'Required only when the vehicles or operations legally require an operator licence.',
      ),
      document(
        'vat_registration',
        'VAT registration certificate',
        'company',
        'conditional',
        'Required only when the company is VAT registered.',
      ),
    ],
  },
  owner_driver: {
    label: 'Owner Operator',
    description: 'A verified owner-operator who runs the same business and driver workspace.',
    persistedAccountType: 'owner_driver',
    routeSegment: 'owner-driver',
    publicRegistration: true,
    createsCompanyWorkspace: true,
    requiresPlatformReview: true,
    documents: [
      document('driving_licence', 'Driving licence', 'identity', 'required'),
      document('proof_of_address', 'Proof of address', 'identity', 'required'),
      document('right_to_work', 'Right-to-work evidence', 'identity', 'required'),
      document('insurance', 'Carrier or vehicle insurance evidence', 'identity', 'required'),
      document(
        'cpc',
        'Driver CPC',
        'identity',
        'conditional',
        'Required only when the vehicle or work legally requires Driver CPC.',
      ),
      document(
        'visa_document',
        'Visa or immigration document',
        'identity',
        'conditional',
        'Required only when the right-to-work route needs this evidence.',
      ),
    ],
  },
  company_driver: {
    label: 'Company Driver',
    description: 'A driver invited by one Fleet Operator and operating only for that Fleet Operator.',
    persistedAccountType: 'company_driver',
    routeSegment: 'company-driver',
    publicRegistration: false,
    createsCompanyWorkspace: false,
    requiresPlatformReview: true,
    documents: [
      document('driving_licence', 'Driving licence', 'identity', 'required'),
      document('proof_of_address', 'Proof of address', 'identity', 'required'),
      document('right_to_work', 'Right-to-work evidence', 'identity', 'required'),
      document(
        'cpc',
        'Driver CPC',
        'identity',
        'conditional',
        'Required only when the vehicle or work legally requires Driver CPC.',
      ),
      document(
        'visa_document',
        'Visa or immigration document',
        'identity',
        'conditional',
        'Required only when the right-to-work route needs this evidence.',
      ),
    ],
  },
};

/**
 * Historical aliases are accepted only at read/normalisation boundaries so
 * existing records can be migrated safely. No caller should persist an alias.
 */
const ACCOUNT_TYPE_ALIASES: Readonly<Record<string, CanonicalOnboardingAccountType>> = {
  customer_shipper: 'customer_shipper',
  customer: 'customer_shipper',
  shipper: 'customer_shipper',
  client: 'customer_shipper',

  transport_broker: 'transport_broker',
  broker_shipper: 'transport_broker',
  freight_broker: 'transport_broker',
  broker: 'transport_broker',

  fleet_operator: 'fleet_operator',
  fleet_courier: 'fleet_operator',
  company_admin: 'fleet_operator',
  'fleet/courier': 'fleet_operator',

  owner_driver: 'owner_driver',
  'owner-driver': 'owner_driver',
  owner_operator: 'owner_driver',
  'owner-operator': 'owner_driver',
  sole_trader: 'owner_driver',

  company_driver: 'company_driver',
  fleet_driver: 'company_driver',
  individual_driver: 'company_driver',
  'individual-driver': 'company_driver',
  driver_only: 'company_driver',
  'driver-only': 'company_driver',
  solo_driver: 'company_driver',
};

export const normalizeCanonicalOnboardingAccountType = (
  raw: string | null | undefined,
): CanonicalOnboardingAccountType | null => {
  const value = (raw ?? '').trim().toLowerCase();
  if (!value) return null;
  return ACCOUNT_TYPE_ALIASES[value] ?? null;
};

export const getOnboardingContract = (
  raw: string | null | undefined,
): OnboardingContractDefinition | null => {
  const canonical = normalizeCanonicalOnboardingAccountType(raw);
  return canonical ? ONBOARDING_CONTRACT[canonical] : null;
};

export const toPersistedOnboardingAccountType = (
  raw: string | null | undefined,
): PersistedOnboardingAccountType | null => {
  const contract = getOnboardingContract(raw);
  return contract?.persistedAccountType ?? null;
};

export const isPublicOnboardingAccountType = (
  raw: string | null | undefined,
): boolean => {
  const canonical = normalizeCanonicalOnboardingAccountType(raw);
  return canonical !== null && canonical !== 'company_driver';
};

export const isCompanyDriverOnboardingApplication = (application: {
  account_type?: unknown;
  company_id?: unknown;
  payload?: unknown;
}): boolean => {
  const canonical = normalizeCanonicalOnboardingAccountType(
    typeof application.account_type === 'string' ? application.account_type : null,
  );
  if (canonical !== 'company_driver') return false;

  const payload =
    application.payload && typeof application.payload === 'object' && !Array.isArray(application.payload)
      ? (application.payload as Record<string, unknown>)
      : {};
  const payloadCanonical = normalizeCanonicalOnboardingAccountType(
    typeof payload.canonical_account_type === 'string' ? payload.canonical_account_type : null,
  );

  return Boolean(application.company_id) || payloadCanonical === 'company_driver' || Boolean(payload.invited_by_company_id);
};

export const getRequiredOnboardingDocuments = (raw: string | null | undefined) =>
  getOnboardingContract(raw)?.documents.filter((item) => item.requirement === 'required') ?? [];
