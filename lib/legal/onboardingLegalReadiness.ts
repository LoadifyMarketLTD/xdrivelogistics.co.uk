import { buildCurrentLegalRequirement, evaluateLegalAcceptance, type LegalAgreementSnapshot } from './legalAgreementState';
import { LEGAL_LANGUAGES, type LegalLanguage } from './controlledLegalDocuments';
import type { RegistrationLegalRole } from './registrationAgreements';

/** Resuming a saved draft grants no contractual readiness. Submission still
 * requires a complete, explicitly signed package for today's exact documents. */
export function hasCurrentOnboardingLegalEvidence(row: Record<string, unknown> | null, role: RegistrationLegalRole): boolean {
  if (!row || typeof row.acceptance_language !== 'string' || !LEGAL_LANGUAGES.includes(row.acceptance_language as LegalLanguage)) return false;
  if (typeof row.accepted_at !== 'string' || !Number.isFinite(Date.parse(row.accepted_at))) return false;
  // Match the existing authoritative material-change evaluator. Do not turn
  // later acknowledgement metadata into retroactive invalidation of an
  // otherwise current historical signature. New POSTs still require every
  // explicit confirmation and persist its same-event timestamp.
  const requirement = buildCurrentLegalRequirement(role, row.acceptance_language);
  if (row.privacy_version !== requirement.privacyVersion || !Array.isArray(row.agreements)) return false;
  const agreements: LegalAgreementSnapshot[] = [];
  for (const value of row.agreements) {
    if (!value || typeof value !== 'object' || typeof value.code !== 'string' || typeof value.version !== 'string') return false;
    agreements.push(value as LegalAgreementSnapshot);
  }
  return !evaluateLegalAcceptance(requirement, {
    registrationRole: String(row.registration_role ?? ''),
    legalVersion: String(row.legal_version ?? ''),
    acceptanceLanguage: row.acceptance_language as LegalLanguage,
    agreements,
    privacyDocumentHash: typeof row.privacy_document_hash === 'string' ? row.privacy_document_hash : null,
  }).requiresReacceptance;
}
