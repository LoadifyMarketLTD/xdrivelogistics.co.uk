import {
  getRequiredOnboardingDocuments,
  normalizeCanonicalOnboardingAccountType,
  type CanonicalOnboardingAccountType,
} from './onboardingContract';

const REQUIRED_FIELDS: Record<CanonicalOnboardingAccountType, readonly string[]> = {
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

const hasValue = (value: unknown) =>
  typeof value === 'string'
    ? value.trim().length > 0
    : typeof value === 'number' || typeof value === 'boolean';

export function calculateOnboardingProgress(
  accountType: string | null | undefined,
  payload: Record<string, unknown>,
): number {
  const canonical = normalizeCanonicalOnboardingAccountType(accountType);
  if (!canonical) return 5;

  const requiredFields = REQUIRED_FIELDS[canonical];
  const completeFields = requiredFields.filter((key) => hasValue(payload[key])).length;
  const fieldRatio = requiredFields.length > 0 ? completeFields / requiredFields.length : 1;

  const requiredDocuments = getRequiredOnboardingDocuments(canonical);
  const completeDocuments = requiredDocuments.filter((doc) => hasValue(payload[`doc_${doc.type}`])).length;
  const documentRatio = requiredDocuments.length > 0 ? completeDocuments / requiredDocuments.length : 1;

  const weighted = 5 + fieldRatio * 70 + documentRatio * 20;
  return Math.min(95, Math.max(5, Math.round(weighted)));
}
