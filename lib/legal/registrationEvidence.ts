import { createHash } from 'node:crypto';

import {
  getRegistrationLegalConfig,
  LEGAL_VERSION,
  type RegistrationLegalRole,
} from './registrationAgreements';

const ROLE_VALUES = new Set<RegistrationLegalRole>([
  'customer_shipper',
  'transport_broker',
  'owner_operator',
  'fleet_operator',
]);

export type RegistrationLegalMetadata = {
  requested_role?: unknown;
  registration_role?: unknown;
  terms_accepted_at?: unknown;
  legal_agreements_accepted_at?: unknown;
  legal_agreement_codes?: unknown;
  legal_agreement_versions?: unknown;
  legal_agreements?: unknown;
  legal_version?: unknown;
  legal_authority_confirmed_at?: unknown;
  legal_role_declaration_confirmed_at?: unknown;
  privacy_acknowledged_at?: unknown;
  privacy_version?: unknown;
};

export type RegistrationLegalEvidence = {
  registrationRole: RegistrationLegalRole;
  legalVersion: string;
  agreements: Array<{ code: string; version: string }>;
  acceptanceStatement: string;
  authorityStatement: string;
  roleStatement: string;
  privacyStatement: string;
  privacyVersion: string;
  acceptedAt: string;
  evidenceHash: string;
};

const asIsoDate = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

const normalizeAgreements = (metadata: RegistrationLegalMetadata) => {
  if (Array.isArray(metadata.legal_agreements)) {
    const rows = metadata.legal_agreements.map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const candidate = entry as Record<string, unknown>;
      if (typeof candidate.code !== 'string' || typeof candidate.version !== 'string') return null;
      return { code: candidate.code, version: candidate.version };
    });
    return rows.every(Boolean) ? (rows as Array<{ code: string; version: string }>) : null;
  }

  if (!Array.isArray(metadata.legal_agreement_codes)) return null;
  if (!metadata.legal_agreement_versions || typeof metadata.legal_agreement_versions !== 'object') return null;

  const versions = metadata.legal_agreement_versions as Record<string, unknown>;
  const rows = metadata.legal_agreement_codes.map((code) => {
    if (typeof code !== 'string' || typeof versions[code] !== 'string') return null;
    return { code, version: versions[code] as string };
  });
  return rows.every(Boolean) ? (rows as Array<{ code: string; version: string }>) : null;
};

export const hasModernRegistrationLegalMetadata = (metadata: RegistrationLegalMetadata) =>
  Boolean(
    metadata.registration_role ||
    metadata.legal_version ||
    metadata.legal_agreements ||
    metadata.legal_agreement_codes ||
    metadata.legal_agreement_versions ||
    metadata.legal_authority_confirmed_at ||
    metadata.legal_role_declaration_confirmed_at,
  );

export const buildRegistrationLegalEvidence = (
  metadata: RegistrationLegalMetadata,
): RegistrationLegalEvidence | null => {
  const role = metadata.registration_role ?? metadata.requested_role;
  if (typeof role !== 'string' || !ROLE_VALUES.has(role as RegistrationLegalRole)) return null;

  const registrationRole = role as RegistrationLegalRole;
  const config = getRegistrationLegalConfig(registrationRole);
  const agreements = normalizeAgreements(metadata);
  const acceptedAt = asIsoDate(metadata.legal_agreements_accepted_at ?? metadata.terms_accepted_at);
  const authorityAt = asIsoDate(metadata.legal_authority_confirmed_at);
  const roleDeclarationAt = asIsoDate(metadata.legal_role_declaration_confirmed_at);
  const privacyAt = asIsoDate(metadata.privacy_acknowledged_at);
  const legalVersion = typeof metadata.legal_version === 'string' ? metadata.legal_version : LEGAL_VERSION;

  if (!agreements || !acceptedAt || !authorityAt || !roleDeclarationAt || !privacyAt) return null;
  if (legalVersion !== LEGAL_VERSION || metadata.privacy_version !== '2026-09-01') return null;

  const expectedAgreements = config.agreements.map(({ code, version }) => ({ code, version }));
  if (JSON.stringify(agreements) !== JSON.stringify(expectedAgreements)) return null;

  // Registration captures the contractual gate as one deliberate action. The
  // evidence timestamps must therefore all refer to that same acceptance event.
  if (authorityAt !== acceptedAt || roleDeclarationAt !== acceptedAt || privacyAt !== acceptedAt) return null;

  const acceptanceStatement = `I agree to the XDrive agreements listed for my ${registrationRole} registration role.`;
  const canonical = JSON.stringify({
    registrationRole,
    legalVersion: LEGAL_VERSION,
    agreements: expectedAgreements,
    acceptanceStatement,
    authorityStatement: config.authorityDeclaration,
    roleStatement: config.roleDeclaration,
    privacyStatement: config.privacyAcknowledgement,
    privacyVersion: '2026-09-01',
    acceptedAt,
  });

  return {
    registrationRole,
    legalVersion: LEGAL_VERSION,
    agreements: expectedAgreements,
    acceptanceStatement,
    authorityStatement: config.authorityDeclaration,
    roleStatement: config.roleDeclaration,
    privacyStatement: config.privacyAcknowledgement,
    privacyVersion: '2026-09-01',
    acceptedAt,
    evidenceHash: createHash('sha256').update(canonical).digest('hex'),
  };
};
