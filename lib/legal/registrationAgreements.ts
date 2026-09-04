export type RegistrationLegalRole =
  | 'customer_shipper'
  | 'transport_broker'
  | 'owner_operator'
  | 'fleet_operator';

export type RegistrationAgreementCode =
  | 'platform_terms'
  | 'membership_subscription_terms'
  | 'marketplace_transport_terms'
  | 'customer_shipper_terms'
  | 'broker_terms'
  | 'owner_driver_terms'
  | 'carrier_fleet_terms';

export type RegistrationAgreementDefinition = {
  code: RegistrationAgreementCode;
  label: string;
  href: string;
  version: string;
  required: true;
  materialChangeRequiresReacceptance: boolean;
};

export type RegistrationRoleLegalConfig = {
  agreements: RegistrationAgreementDefinition[];
  authorityDeclaration: string;
  roleDeclaration: string;
  privacyAcknowledgement: string;
};

export const LEGAL_VERSION = '2026-09-04';
export const PRIVACY_VERSION = '2026-09-01';

const PLATFORM_TERMS: RegistrationAgreementDefinition = {
  code: 'platform_terms',
  label: 'XDrive Platform Terms',
  href: '/terms',
  version: '2026-09-01',
  required: true,
  materialChangeRequiresReacceptance: true,
};

const MEMBERSHIP_TERMS: RegistrationAgreementDefinition = {
  code: 'membership_subscription_terms',
  label: 'Membership & Subscription Terms',
  href: '/subscription-terms',
  version: '2026-09-01',
  required: true,
  materialChangeRequiresReacceptance: true,
};

const MARKETPLACE_TERMS: RegistrationAgreementDefinition = {
  code: 'marketplace_transport_terms',
  label: 'Marketplace & Transport Trading Terms',
  href: '/terms',
  version: '2026-09-01',
  required: true,
  materialChangeRequiresReacceptance: true,
};

const roleTerm = (
  code: RegistrationAgreementCode,
  label: string,
): RegistrationAgreementDefinition => ({
  code,
  label,
  // Until dedicated role-term routes receive final legal review, role obligations
  // resolve to the canonical Platform Terms rather than a non-existent document.
  href: '/terms',
  version: '2026-09-01',
  required: true,
  materialChangeRequiresReacceptance: true,
});

export const REGISTRATION_LEGAL_CONFIG: Record<RegistrationLegalRole, RegistrationRoleLegalConfig> = {
  customer_shipper: {
    agreements: [
      PLATFORM_TERMS,
      roleTerm('customer_shipper_terms', 'Customer / Shipper Trading Terms'),
      MARKETPLACE_TERMS,
      MEMBERSHIP_TERMS,
    ],
    authorityDeclaration:
      'I confirm that I am authorised to create and operate this XDrive account for the business or organisation I represent.',
    roleDeclaration:
      'I confirm that transport requirements and goods information I submit through XDrive will be accurate and lawful.',
    privacyAcknowledgement:
      'I acknowledge that XDrive will process my information as described in the Privacy Policy.',
  },
  transport_broker: {
    agreements: [
      PLATFORM_TERMS,
      roleTerm('broker_terms', 'Transport Broker Trading Terms'),
      MARKETPLACE_TERMS,
      MEMBERSHIP_TERMS,
    ],
    authorityDeclaration:
      'I confirm that I am authorised to create and operate this XDrive broker account for the business I represent.',
    roleDeclaration:
      'I confirm that I am authorised to submit or manage transport requirements for the customers or businesses I represent and that the information I provide will be accurate.',
    privacyAcknowledgement:
      'I acknowledge that XDrive will process my information as described in the Privacy Policy.',
  },
  owner_operator: {
    agreements: [
      PLATFORM_TERMS,
      roleTerm('owner_driver_terms', 'Owner Driver / Carrier Terms'),
      MARKETPLACE_TERMS,
      MEMBERSHIP_TERMS,
    ],
    authorityDeclaration:
      'I confirm that I am creating this account in a business capacity and am authorised to enter into the XDrive agreements for that business.',
    roleDeclaration:
      'I understand that eligibility to undertake transport work through XDrive is subject to identity, vehicle, insurance and compliance verification.',
    privacyAcknowledgement:
      'I acknowledge that XDrive will process my information as described in the Privacy Policy.',
  },
  fleet_operator: {
    agreements: [
      PLATFORM_TERMS,
      roleTerm('carrier_fleet_terms', 'Carrier / Fleet Trading Terms'),
      MARKETPLACE_TERMS,
      MEMBERSHIP_TERMS,
    ],
    authorityDeclaration:
      'I confirm that I am authorised to create and operate this XDrive carrier account for the company or transport business I represent.',
    roleDeclaration:
      'I confirm that the carrier is responsible for the drivers, vehicles, insurance and compliance information it provides to XDrive.',
    privacyAcknowledgement:
      'I acknowledge that XDrive will process my information as described in the Privacy Policy.',
  },
};

export const getRegistrationLegalConfig = (role: RegistrationLegalRole) =>
  REGISTRATION_LEGAL_CONFIG[role];
