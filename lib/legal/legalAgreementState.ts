import { createHash } from 'node:crypto';

import {
  buildControlledLegalDocument,
  CONTROLLED_PRIVACY_VERSION,
  normalizeLegalLanguage,
  type LegalLanguage,
} from './controlledLegalDocuments';
import {
  getRegistrationLegalConfig,
  LEGAL_VERSION,
  PRIVACY_VERSION,
  type RegistrationAgreementDefinition,
  type RegistrationAgreementCode,
  type RegistrationLegalRole,
} from './registrationAgreements';
import { getLocalizedAcceptanceStatement } from './registrationDeclarations';

export type LegalAgreementSnapshot = {
  code: string;
  version: string;
  language?: LegalLanguage;
  translationVersion?: string;
  documentHash?: string;
};

export type LegalAcceptanceSnapshot = {
  registrationRole: string;
  legalVersion: string;
  agreements: LegalAgreementSnapshot[];
  acceptanceLanguage?: LegalLanguage;
  acceptanceStatement?: string | null;
  privacyDocumentHash?: string | null;
};

export type CurrentLegalRequirement = {
  registrationRole: RegistrationLegalRole;
  legalVersion: string;
  privacyVersion: string;
  acceptanceLanguage: LegalLanguage;
  agreements: Array<RegistrationAgreementDefinition & { language: LegalLanguage; translationVersion: string; documentHash: string }>;
  privacyDocumentHash: string;
  acceptanceStatement: string;
  authorityStatement: string;
  roleStatement: string;
  privacyStatement: string;
  requirementFingerprint: string;
};

export type CurrentLegalEvidence = {
  registrationRole: RegistrationLegalRole;
  legalVersion: string;
  agreements: Required<Pick<LegalAgreementSnapshot,'code'|'version'|'language'|'translationVersion'|'documentHash'>>[];
  acceptanceLanguage: LegalLanguage;
  acceptanceStatement: string;
  authorityStatement: string;
  roleStatement: string;
  privacyStatement: string;
  privacyVersion: string;
  privacyDocumentHash: string;
  acceptedAt: string;
  evidenceHash: string;
};

export type LegalAcceptanceEvaluation = { requiresReacceptance: boolean; reasons: string[] };
const canonicalJson = (value: unknown) => JSON.stringify(value);
const sha256 = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex');

const buildDocumentSnapshot = (code: RegistrationAgreementCode, version: string, language: LegalLanguage) => {
  const document = buildControlledLegalDocument(code as Parameters<typeof buildControlledLegalDocument>[0], language);
  if (document.version !== version) throw new Error(`Controlled legal document version mismatch for ${code}.`);
  return {
    code,
    version,
    language,
    translationVersion: document.translationVersion,
    documentHash: sha256(document),
  };
};

export const computeLegalRequirementFingerprint = (input: {
  registrationRole: RegistrationLegalRole;
  legalVersion: string;
  acceptanceLanguage?: LegalLanguage;
  agreements: CurrentLegalRequirement['agreements'];
  privacyDocumentHash?: string;
  acceptanceStatement?: string;
}) => {
  const acceptanceLanguage = input.acceptanceLanguage ?? input.agreements[0]?.language ?? 'en';
  const privacyDocumentHash = input.privacyDocumentHash ?? sha256(buildControlledLegalDocument('privacy_policy', acceptanceLanguage));
  const acceptanceStatement = input.acceptanceStatement ?? getLocalizedAcceptanceStatement(input.registrationRole, acceptanceLanguage);
  return createHash('sha256').update(canonicalJson({
    registrationRole: input.registrationRole,
    legalVersion: input.legalVersion,
    acceptanceLanguage,
    acceptanceStatement,
    materialAgreements: input.agreements.filter((agreement) => agreement.materialChangeRequiresReacceptance).map(({ code, version, language, translationVersion, documentHash }) => ({ code, version, language, translationVersion, documentHash })),
    privacyDocumentHash,
  })).digest('hex');
};

export const buildCurrentLegalRequirement = (
  registrationRole: RegistrationLegalRole,
  languageInput: unknown = 'en',
): CurrentLegalRequirement => {
  const acceptanceLanguage = normalizeLegalLanguage(languageInput);
  const config = getRegistrationLegalConfig(registrationRole, acceptanceLanguage);
  const agreements = config.agreements.map((agreement) => ({ ...agreement, ...buildDocumentSnapshot(agreement.code, agreement.version, acceptanceLanguage) }));
  const privacyDocument = buildControlledLegalDocument('privacy_policy', acceptanceLanguage);
  if (privacyDocument.version !== PRIVACY_VERSION || privacyDocument.version !== CONTROLLED_PRIVACY_VERSION) throw new Error('Controlled privacy document version mismatch.');
  const privacyDocumentHash = sha256(privacyDocument);
  const acceptanceStatement = getLocalizedAcceptanceStatement(registrationRole, acceptanceLanguage);
  const requirementFingerprint = computeLegalRequirementFingerprint({ registrationRole, legalVersion: LEGAL_VERSION, acceptanceLanguage, agreements, privacyDocumentHash, acceptanceStatement });
  return {
    registrationRole,
    legalVersion: LEGAL_VERSION,
    privacyVersion: PRIVACY_VERSION,
    acceptanceLanguage,
    agreements,
    privacyDocumentHash,
    acceptanceStatement,
    authorityStatement: config.authorityDeclaration,
    roleStatement: config.roleDeclaration,
    privacyStatement: config.privacyAcknowledgement,
    requirementFingerprint,
  };
};

export const evaluateLegalAcceptance = (
  requirement: CurrentLegalRequirement,
  acceptance: LegalAcceptanceSnapshot | null | undefined,
): LegalAcceptanceEvaluation => {
  if (!acceptance) return { requiresReacceptance: true, reasons: ['missing_acceptance'] };
  const reasons: string[] = [];
  if (acceptance.registrationRole !== requirement.registrationRole) reasons.push('registration_role_changed');
  if (acceptance.legalVersion !== requirement.legalVersion) reasons.push('legal_version_changed');
  if (acceptance.acceptanceLanguage !== requirement.acceptanceLanguage) reasons.push('acceptance_language_changed');
  if (acceptance.acceptanceStatement !== requirement.acceptanceStatement) reasons.push('acceptance_statement_changed');
  if (acceptance.privacyDocumentHash !== requirement.privacyDocumentHash) reasons.push('privacy_document_changed');
  const acceptedAgreements = new Map(acceptance.agreements.map((agreement) => [agreement.code, agreement]));
  for (const agreement of requirement.agreements) {
    if (!agreement.materialChangeRequiresReacceptance) continue;
    const accepted = acceptedAgreements.get(agreement.code);
    if (!accepted || accepted.version !== agreement.version) {
      reasons.push(`material_agreement_changed:${agreement.code}`);
      continue;
    }
    if (accepted.language !== agreement.language) reasons.push(`agreement_language_changed:${agreement.code}`);
    if (accepted.translationVersion !== agreement.translationVersion) reasons.push(`agreement_translation_changed:${agreement.code}`);
    if (accepted.documentHash !== agreement.documentHash) reasons.push(`agreement_document_changed:${agreement.code}`);
  }
  return { requiresReacceptance: reasons.length > 0, reasons };
};

export const findCurrentLegalAcceptanceIndex = (
  requirement: CurrentLegalRequirement,
  history: LegalAcceptanceSnapshot[],
) => history.findIndex((acceptance) => !evaluateLegalAcceptance(requirement, acceptance).requiresReacceptance);

export const buildCurrentLegalEvidence = (
  registrationRole: RegistrationLegalRole,
  acceptedAt: string,
  languageInput: unknown = 'en',
): CurrentLegalEvidence => {
  const requirement = buildCurrentLegalRequirement(registrationRole, languageInput);
  const agreements = requirement.agreements.map(({ code, version, language, translationVersion, documentHash }) => ({ code, version, language, translationVersion, documentHash }));
  const canonical = {
    registrationRole,
    legalVersion: requirement.legalVersion,
    agreements,
    acceptanceLanguage: requirement.acceptanceLanguage,
    acceptanceStatement: requirement.acceptanceStatement,
    authorityStatement: requirement.authorityStatement,
    roleStatement: requirement.roleStatement,
    privacyStatement: requirement.privacyStatement,
    privacyVersion: requirement.privacyVersion,
    privacyDocumentHash: requirement.privacyDocumentHash,
    acceptedAt,
  };
  return {
    registrationRole,
    legalVersion: requirement.legalVersion,
    agreements,
    acceptanceLanguage: requirement.acceptanceLanguage,
    acceptanceStatement: requirement.acceptanceStatement,
    authorityStatement: requirement.authorityStatement,
    roleStatement: requirement.roleStatement,
    privacyStatement: requirement.privacyStatement,
    privacyVersion: requirement.privacyVersion,
    privacyDocumentHash: requirement.privacyDocumentHash,
    acceptedAt,
    evidenceHash: sha256(canonical),
  };
};
