import { describe, expect, it } from 'vitest';

import { getRegistrationLegalConfig, LEGAL_VERSION, PRIVACY_VERSION } from '../lib/legal/registrationAgreements';
import {
  buildRegistrationLegalEvidence,
  hasModernRegistrationLegalMetadata,
} from '../lib/legal/registrationEvidence';

const acceptedAt = '2026-09-04T20:30:00.000Z';

const validMetadata = (role: 'customer_shipper' | 'transport_broker' | 'owner_operator' | 'fleet_operator') => {
  const config = getRegistrationLegalConfig(role);
  return {
    requested_role: role,
    terms_accepted_at: acceptedAt,
    legal_agreement_codes: config.agreements.map((agreement) => agreement.code),
    legal_agreement_versions: Object.fromEntries(
      config.agreements.map((agreement) => [agreement.code, agreement.version]),
    ),
    legal_authority_confirmed_at: acceptedAt,
    legal_role_declaration_confirmed_at: acceptedAt,
    privacy_acknowledged_at: acceptedAt,
    privacy_version: PRIVACY_VERSION,
    legal_acceptance_language: 'en',
    legal_language_comprehension_confirmed_at: acceptedAt,
  };
};

describe('registration legal evidence', () => {
  it.each([
    'customer_shipper',
    'transport_broker',
    'owner_operator',
    'fleet_operator',
  ] as const)('builds deterministic evidence for %s', (role) => {
    const metadata = validMetadata(role);
    const evidence = buildRegistrationLegalEvidence(metadata);

    expect(evidence).not.toBeNull();
    expect(evidence?.registrationRole).toBe(role);
    expect(evidence?.legalVersion).toBe(LEGAL_VERSION);
    expect(evidence?.evidenceHash).toMatch(/^[0-9a-f]{64}$/);
    expect(evidence?.agreements.map(({ code, version, language }) => ({ code, version, language }))).toEqual(
      getRegistrationLegalConfig(role).agreements.map(({ code, version }) => ({ code, version, language: 'en' })),
    );
    expect(evidence?.agreements.every((agreement) => /^[0-9a-f]{64}$/.test(agreement.documentHash))).toBe(true);
  });

  it('rejects tampered agreement versions', () => {
    const metadata = validMetadata('owner_operator');
    metadata.legal_agreement_versions = {
      ...metadata.legal_agreement_versions,
      owner_driver_terms: 'tampered-version',
    };

    expect(buildRegistrationLegalEvidence(metadata)).toBeNull();
  });

  it('rejects timestamps that do not represent the same acceptance event', () => {
    const metadata = validMetadata('transport_broker');
    metadata.privacy_acknowledged_at = '2026-09-04T20:31:00.000Z';

    expect(buildRegistrationLegalEvidence(metadata)).toBeNull();
  });

  it('fails closed without same-event legal language comprehension confirmation', () => {
    const missing = { ...validMetadata('owner_operator'), legal_language_comprehension_confirmed_at: undefined };
    expect(buildRegistrationLegalEvidence(missing)).toBeNull();

    const mismatched = validMetadata('owner_operator');
    mismatched.legal_language_comprehension_confirmed_at = '2026-09-04T20:31:00.000Z';
    expect(buildRegistrationLegalEvidence(mismatched)).toBeNull();
  });

  it('does not classify legacy registration metadata as the modern legal gate', () => {
    expect(hasModernRegistrationLegalMetadata({
      requested_role: 'owner_operator',
      terms_accepted_at: acceptedAt,
      privacy_acknowledged_at: acceptedAt,
      privacy_version: '2026-09-01',
    })).toBe(false);
  });

  it('detects incomplete modern legal-gate metadata for fail-closed handling', () => {
    expect(hasModernRegistrationLegalMetadata({
      requested_role: 'owner_operator',
      legal_agreement_codes: ['platform_terms'],
    })).toBe(true);
  });
});
