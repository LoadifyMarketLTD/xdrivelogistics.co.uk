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
  registration_role?: unknown;
  legal_version?: unknown;
  legal_agreements?: unknown;
  legal_agreements_accepted_at?: unknown;
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

const normalizeAgreements = (value: unknown) => {
  if (!Array.isArray(value)) return null;
  const rows = value.map((entry) => {
    if (!entry || typeof entry !== 'object') return null;
    const candidate = entry as Record<string, unknown>;
    if (typeof candidate.code !== 'string' || typeof candidate.version !== 'string') return null;
    return { code: candidate.code, version: candidate.version };
  });
  return rows.every(Boolean) ? (rows as Array<{ code: string; version: string }>) : null;
};

export const buildRegistrationLegalEvidence = (
  metadata: RegistrationLegalMetadata,
): RegistrationLegalEvidence | null => {
  const role = metadata.registration_role;
  if (typeof role !== 'string' || !ROLE_VALUES.has(role as RegistrationLegalRole)) return null;

  const registrationRole = role as RegistrationLegalRole;
  const config = getRegistrationLegalConfig(registrationRole);
  const agreements = normalizeAgreements(metadata.legal_agreements);
  const acceptedAt = asIsoDate(metadata.legal_agreements_accepted_at);
  const authorityAt = asIsoDate(metadata.legal_authority_confirmed_at);
  const roleDeclarationAt = asIsoDate(metadata.legal_role_declaration_confirmed_at);
  const privacyAt = asIsoDate(metadata.privacy_acknowledged_at);

  if (!agreements || !acceptedAt || !authorityAt || !roleDeclarationAt || !privacyAt) return null;
  if (metadata.legal_version !== LEGAL_VERSION || metadata.privacy_version !== '2026-09-01') return null;

  const expectedAgreements = config.agreements.map(({ code, version }) => ({ code, version }));
  if (JSON.stringify(agreements) !== JSON.stringify(expectedAgreements)) return null;

  // The three confirmations are captured by the registration UI as one atomic
  // contractual gate. Require their timestamps to represent that same action.
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
