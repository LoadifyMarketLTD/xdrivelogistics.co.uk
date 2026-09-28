import {
  getRequiredOnboardingDocuments,
  normalizeCanonicalOnboardingAccountType,
  type CanonicalOnboardingAccountType,
} from './onboardingContract';

export const REQUIRED_ONBOARDING_FIELDS: Record<CanonicalOnboardingAccountType, readonly string[]> = {
  customer_shipper: ['full_name', 'contact_email'],
  broker_shipper: [
    'company_name',
    'trading_name',
    'company_number',
    'billing_address',
    'trading_address',
    'contact_person',
    'finance_contact',
    'contact_email',
    'contact_phone',
  ],
  fleet_courier: [
    'legal_company_name',
    'trading_name',
    'company_number',
    'registered_address',
    'trading_address',
    'contact_person',
    'compliance_contact',
    'transport_contact',
  ],
  owner_driver: [
    'full_name',
    'dob',
    'address',
    'phone',
    'email',
    'right_to_work_status',
    'registration',
    'make',
    'model',
  ],
  company_driver: ['full_name', 'address', 'phone', 'email'],
};

const FIELD_LABELS: Record<string, string> = {
  full_name: 'Full name',
  contact_email: 'Contact email',
  company_name: 'Company name',
  trading_name: 'Trading name',
  company_number: 'Companies House number',
  billing_address: 'Billing address',
  trading_address: 'Trading address',
  contact_person: 'Contact person',
  finance_contact: 'Finance contact',
  contact_phone: 'Contact phone',
  legal_company_name: 'Legal company name',
  registered_address: 'Registered address',
  compliance_contact: 'Compliance contact',
  transport_contact: 'Transport contact',
  dob: 'Date of birth',
  address: 'Address',
  phone: 'Phone',
  email: 'Email',
  right_to_work_status: 'Right to work status',
  registration: 'Vehicle registration',
  make: 'Vehicle make',
  model: 'Vehicle model',
};

const hasValue = (value: unknown) =>
  typeof value === 'string'
    ? value.trim().length > 0
    : typeof value === 'number' || typeof value === 'boolean';

export type OnboardingRecoveryAssessment = {
  canonicalAccountType: CanonicalOnboardingAccountType | null;
  progress: number;
  complete: boolean;
  missingFields: Array<{ key: string; label: string }>;
  missingDocuments: Array<{ type: string; label: string }>;
  blockingReasons: string[];
};

export function assessOnboardingRecovery(
  accountType: string | null | undefined,
  payload: Record<string, unknown>,
  context?: { companyId?: string | null },
): OnboardingRecoveryAssessment {
  const canonical = normalizeCanonicalOnboardingAccountType(accountType);
  if (!canonical) {
    return {
      canonicalAccountType: null,
      progress: 5,
      complete: false,
      missingFields: [],
      missingDocuments: [],
      blockingReasons: ['Unsupported onboarding account type.'],
    };
  }

  const requiredFields = REQUIRED_ONBOARDING_FIELDS[canonical];
  const missingFields = requiredFields
    .filter((key) => !hasValue(payload[key]))
    .map((key) => ({ key, label: FIELD_LABELS[key] ?? key.replace(/_/g, ' ') }));

  const requiredDocuments = getRequiredOnboardingDocuments(canonical);
  const missingDocuments = requiredDocuments
    .filter((doc) => !hasValue(payload[`doc_${doc.type}`]))
    .map((doc) => ({ type: doc.type, label: doc.label }));

  const completeFields = requiredFields.length - missingFields.length;
  const fieldRatio = requiredFields.length > 0 ? completeFields / requiredFields.length : 1;
  const completeDocuments = requiredDocuments.length - missingDocuments.length;
  const documentRatio = requiredDocuments.length > 0 ? completeDocuments / requiredDocuments.length : 1;
  const documentWeight = requiredDocuments.length > 0 ? 20 : 0;
  const fieldWeight = requiredDocuments.length > 0 ? 70 : 90;
  const weighted = 5 + fieldRatio * fieldWeight + documentRatio * documentWeight;
  const progress = Math.min(95, Math.max(5, Math.round(weighted)));
  const requiresVerifiedCompany = canonical === 'broker_shipper' || canonical === 'fleet_courier';
  const blockingReasons = [
    ...(missingFields.length > 0
      ? [`Missing required information: ${missingFields.map((item) => item.label).join(', ')}.`]
      : []),
    ...(missingDocuments.length > 0
      ? [`Missing required documents: ${missingDocuments.map((item) => item.label).join(', ')}.`]
      : []),
    ...(requiresVerifiedCompany && !context?.companyId
      ? ['Companies House verification is required before onboarding can be submitted.']
      : []),
  ];

  return {
    canonicalAccountType: canonical,
    progress,
    complete: blockingReasons.length === 0,
    missingFields,
    missingDocuments,
    blockingReasons,
  };
}

export function calculateOnboardingProgress(
  accountType: string | null | undefined,
  payload: Record<string, unknown>,
  context?: { companyId?: string | null },
): number {
  return assessOnboardingRecovery(accountType, payload, context).progress;
}
