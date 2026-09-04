export type RegisterRole = 'owner_operator' | 'fleet_operator' | 'transport_broker' | 'customer_shipper';

export const LEGAL_VERSION = '2026-09-04';

export type LegalAgreementLink = {
  key: string;
  label: string;
  href: string;
  version: string;
};

export type RoleContractualGate = {
  heading: string;
  agreements: LegalAgreementLink[];
  primaryDeclaration: string;
  complianceDeclaration?: string;
  privacyNotice: string;
};

const PLATFORM: LegalAgreementLink = { key: 'platform_terms', label: 'XDrive Platform Terms', href: '/terms', version: LEGAL_VERSION };
const MEMBERSHIP: LegalAgreementLink = { key: 'membership_terms', label: 'Membership & Subscription Terms', href: '/subscription-terms', version: LEGAL_VERSION };
const MARKETPLACE: LegalAgreementLink = { key: 'marketplace_transport_terms', label: 'Marketplace & Transport Trading Terms', href: '/terms#marketplace-transport', version: LEGAL_VERSION };

export const ROLE_CONTRACTUAL_GATE: Record<RegisterRole, RoleContractualGate> = {
  customer_shipper: {
    heading: 'Customer / Shipper agreements',
    agreements: [PLATFORM, MARKETPLACE, MEMBERSHIP],
    primaryDeclaration: 'I confirm that I am authorised to create and operate this account and to place transport requirements on behalf of the account holder.',
    privacyNotice: 'I have read the XDrive Privacy Policy and understand how XDrive processes account, marketplace and operational data.',
  },
  transport_broker: {
    heading: 'Transport Broker agreements',
    agreements: [PLATFORM, MARKETPLACE, MEMBERSHIP],
    primaryDeclaration: 'I confirm that I am authorised to create and operate this account and to arrange transport requirements for the customers or businesses I represent.',
    complianceDeclaration: 'I understand that information I post, quote, award or manage through XDrive must be accurate, lawful and within my authority to provide.',
    privacyNotice: 'I have read the XDrive Privacy Policy and understand how XDrive processes account, marketplace and operational data.',
  },
  owner_operator: {
    heading: 'Owner Driver agreements',
    agreements: [PLATFORM, MARKETPLACE, MEMBERSHIP],
    primaryDeclaration: 'I confirm that I am authorised to operate this account and to provide transport services through XDrive in the capacity I declare during onboarding.',
    complianceDeclaration: 'I understand that access to transport work is subject to applicable insurance, vehicle, licence, identity and compliance requirements and to the accuracy of the information I provide.',
    privacyNotice: 'I have read the XDrive Privacy Policy and understand how XDrive processes identity, compliance, account and operational data.',
  },
  fleet_operator: {
    heading: 'Carrier / Fleet agreements',
    agreements: [PLATFORM, MARKETPLACE, MEMBERSHIP],
    primaryDeclaration: 'I confirm that I am authorised to create and operate this account on behalf of the carrier or fleet business I represent.',
    complianceDeclaration: 'I understand that the carrier is responsible for the lawful operation of its vehicles, drivers and permitted subcontractors and for maintaining applicable insurance, licence and compliance requirements.',
    privacyNotice: 'I have read the XDrive Privacy Policy and understand how XDrive processes company, driver, compliance and operational data.',
  },
};
