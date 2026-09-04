import { createHash } from 'node:crypto';

import {
  getRegistrationLegalConfig,
  LEGAL_VERSION,
  PRIVACY_VERSION,
  type RegistrationAgreementDefinition,
  type RegistrationLegalRole,
} from './registrationAgreements';

export type LegalAgreementSnapshot = {
  code: string;
  version: string;
};

export type LegalAcceptanceSnapshot = {
  registrationRole: string;
  legalVersion: string;
  agreements: LegalAgreementSnapshot[];
};

export type CurrentLegalRequirement = {
  registrationRole: RegistrationLegalRole;
  legalVersion: string;
  privacyVersion: string;
  agreements: RegistrationAgreementDefinition[];
  acceptanceStatement: string;
  authorityStatement: string;
  roleStatement: string;
  privacyStatement: string;
  requirementFingerprint: string;
};

export type CurrentLegalEvidence = {
  registrationRole: RegistrationLegalRole;
  legalVersion: string;
  agreements: LegalAgreementSnapshot[];
  acceptanceStatement: string;
  authorityStatement: string;
  roleStatement: string;
  privacyStatement: string;
  privacyVersion: string;
  acceptedAt: string;
  evidenceHash: string;
};

export type LegalAcceptanceEvaluation = {
  requiresReacceptance: boolean;
  reasons: string[];
};

const canonicalJson = (value: unknown) => JSON.stringify(value);

export const computeLegalRequirementFingerprint = (input: {
  registrationRole: RegistrationLegalRole;
  legalVersion: string;
  agreements: RegistrationAgreementDefinition[];
}) => {
  const materialAgreements = input.agreements
    .filter((agreement) => agreement.materialChangeRequiresReacceptance)
    .map(({ code, version }) => ({ code, version }));

  return createHash('sha256')
    .update(
      canonicalJson({
        registrationRole: input.registrationRole,
        legalVersion: input.legalVersion,
        materialAgreements,
      }),
    )
    .digest('hex');
};

export const buildCurrentLegalRequirement = (
  registrationRole: RegistrationLegalRole,
): CurrentLegalRequirement => {
  const config = getRegistrationLegalConfig(registrationRole);
  const acceptanceStatement = `I agree to the XDrive agreements listed for my ${registrationRole} registration role.`;

  return {
    registrationRole,
    legalVersion: LEGAL_VERSION,
    privacyVersion: PRIVACY_VERSION,
    agreements: config.agreements,
    acceptanceStatement,
    authorityStatement: config.authorityDeclaration,
    roleStatement: config.roleDeclaration,
    privacyStatement: config.privacyAcknowledgement,
    requirementFingerprint: computeLegalRequirementFingerprint({
      registrationRole,
      legalVersion: LEGAL_VERSION,
      agreements: config.agreements,
    }),
  };
};

export const evaluateLegalAcceptance = (
  requirement: CurrentLegalRequirement,
  acceptance: LegalAcceptanceSnapshot | null | undefined,
): LegalAcceptanceEvaluation => {
  if (!acceptance) {
    return {
      requiresReacceptance: true,
      reasons: ['missing_acceptance'],
    };
  }

  const reasons: string[] = [];
  if (acceptance.registrationRole !== requirement.registrationRole) {
    reasons.push('registration_role_changed');
  }
  if (acceptance.legalVersion !== requirement.legalVersion) {
    reasons.push('legal_version_changed');
  }

  const acceptedVersions = new Map(
    acceptance.agreements.map((agreement) => [agreement.code, agreement.version]),
  );

  for (const agreement of requirement.agreements) {
    if (!agreement.materialChangeRequiresReacceptance) continue;
    if (acceptedVersions.get(agreement.code) !== agreement.version) {
      reasons.push(`material_agreement_changed:${agreement.code}`);
    }
  }

  return {
    requiresReacceptance: reasons.length > 0,
    reasons,
  };
};

export const findCurrentLegalAcceptanceIndex = (
  requirement: CurrentLegalRequirement,
  history: LegalAcceptanceSnapshot[],
) => history.findIndex((acceptance) => !evaluateLegalAcceptance(requirement, acceptance).requiresReacceptance);

export const buildCurrentLegalEvidence = (
  registrationRole: RegistrationLegalRole,
  acceptedAt: string,
): CurrentLegalEvidence => {
  const requirement = buildCurrentLegalRequirement(registrationRole);
  const agreements = requirement.agreements.map(({ code, version }) => ({ code, version }));
  const canonical = canonicalJson({
    registrationRole,
    legalVersion: requirement.legalVersion,
    agreements,
    acceptanceStatement: requirement.acceptanceStatement,
    authorityStatement: requirement.authorityStatement,
    roleStatement: requirement.roleStatement,
    privacyStatement: requirement.privacyStatement,
    privacyVersion: requirement.privacyVersion,
    acceptedAt,
  });

  return {
    registrationRole,
    legalVersion: requirement.legalVersion,
    agreements,
    acceptanceStatement: requirement.acceptanceStatement,
    authorityStatement: requirement.authorityStatement,
    roleStatement: requirement.roleStatement,
    privacyStatement: requirement.privacyStatement,
    privacyVersion: requirement.privacyVersion,
    acceptedAt,
    evidenceHash: createHash('sha256').update(canonical).digest('hex'),
  };
};
