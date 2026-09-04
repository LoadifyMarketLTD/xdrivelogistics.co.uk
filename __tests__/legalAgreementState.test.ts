import { describe, expect, it } from 'vitest';

import {
  buildCurrentLegalEvidence,
  buildCurrentLegalRequirement,
  computeLegalRequirementFingerprint,
  evaluateLegalAcceptance,
  findCurrentLegalAcceptanceIndex,
} from '../lib/legal/legalAgreementState';

describe('legal agreement material re-acceptance state', () => {
  it('does not require re-acceptance when the latest evidence matches the current requirement', () => {
    const requirement = buildCurrentLegalRequirement('owner_operator');
    const evidence = buildCurrentLegalEvidence('owner_operator', '2026-09-04T21:45:00.000Z');

    expect(evaluateLegalAcceptance(requirement, evidence)).toEqual({
      requiresReacceptance: false,
      reasons: [],
    });
  });

  it('requires re-acceptance when a material agreement version changes', () => {
    const requirement = buildCurrentLegalRequirement('fleet_operator');
    const evidence = buildCurrentLegalEvidence('fleet_operator', '2026-09-04T21:45:00.000Z');
    const staleEvidence = {
      ...evidence,
      agreements: evidence.agreements.map((agreement) =>
        agreement.code === 'carrier_fleet_terms'
          ? { ...agreement, version: '2026-08-01' }
          : agreement,
      ),
    };

    const evaluation = evaluateLegalAcceptance(requirement, staleEvidence);
    expect(evaluation.requiresReacceptance).toBe(true);
    expect(evaluation.reasons).toContain('material_agreement_changed:carrier_fleet_terms');
  });

  it('requires fresh acceptance when the authoritative contractual role changes', () => {
    const requirement = buildCurrentLegalRequirement('transport_broker');
    const evidence = buildCurrentLegalEvidence('customer_shipper', '2026-09-04T21:45:00.000Z');

    const evaluation = evaluateLegalAcceptance(requirement, evidence);
    expect(evaluation.requiresReacceptance).toBe(true);
    expect(evaluation.reasons).toContain('registration_role_changed');
  });

  it('selects the newest legally sufficient event instead of blindly treating the newest row as current', () => {
    const requirement = buildCurrentLegalRequirement('owner_operator');
    const currentEvidence = buildCurrentLegalEvidence('owner_operator', '2026-09-04T21:45:00.000Z');
    const unrelatedNewerEvidence = buildCurrentLegalEvidence('transport_broker', '2026-09-04T21:46:00.000Z');

    expect(
      findCurrentLegalAcceptanceIndex(requirement, [unrelatedNewerEvidence, currentEvidence]),
    ).toBe(1);
  });

  it('does not change the requirement fingerprint for presentation-only label or href edits', () => {
    const requirement = buildCurrentLegalRequirement('customer_shipper');
    const presentationOnlyAgreements = requirement.agreements.map((agreement) => ({
      ...agreement,
      label: `${agreement.label} updated label`,
      href: `${agreement.href}?presentation=updated`,
    }));

    const fingerprint = computeLegalRequirementFingerprint({
      registrationRole: requirement.registrationRole,
      legalVersion: requirement.legalVersion,
      agreements: presentationOnlyAgreements,
    });

    expect(fingerprint).toBe(requirement.requirementFingerprint);
  });

  it('changes the requirement fingerprint when a material agreement version changes', () => {
    const requirement = buildCurrentLegalRequirement('customer_shipper');
    const changedAgreements = requirement.agreements.map((agreement, index) =>
      index === 0 ? { ...agreement, version: '2026-09-05' } : agreement,
    );

    const fingerprint = computeLegalRequirementFingerprint({
      registrationRole: requirement.registrationRole,
      legalVersion: requirement.legalVersion,
      agreements: changedAgreements,
    });

    expect(fingerprint).not.toBe(requirement.requirementFingerprint);
  });

  it('creates immutable evidence hashes from the full acceptance event', () => {
    const first = buildCurrentLegalEvidence('owner_operator', '2026-09-04T21:45:00.000Z');
    const second = buildCurrentLegalEvidence('owner_operator', '2026-09-04T21:46:00.000Z');

    expect(first.evidenceHash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.evidenceHash).not.toBe(second.evidenceHash);
  });
});
