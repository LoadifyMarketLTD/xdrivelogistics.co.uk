export type LegalAcceptanceDraft = {
  savedAt: number;
  signerFullName: string;
  acceptedDocumentCodes: string[];
  agreementsAccepted: boolean;
  authorityConfirmed: boolean;
  roleDeclarationConfirmed: boolean;
  privacyAcknowledged: boolean;
  initialEvidenceRemediationConfirmed: boolean;
};
const MAX_DRAFT_AGE_MS = 12 * 60 * 60 * 1000;
export const legalDraftKey = (userId: string, companyId: string | null, fingerprint: string) =>
  `xdrive:legal-draft:v1:${userId}:${companyId ?? 'unbound'}:${fingerprint}`;
export function readLegalDraft(raw: string | null, requiredCodes: string[], now = Date.now()): LegalAcceptanceDraft | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<LegalAcceptanceDraft>;
    if (typeof value.savedAt !== 'number' || now - value.savedAt > MAX_DRAFT_AGE_MS || value.savedAt > now + 60_000) return null;
    if (typeof value.signerFullName !== 'string' || !Array.isArray(value.acceptedDocumentCodes)) return null;
    return { savedAt: value.savedAt, signerFullName: value.signerFullName.slice(0, 120),
      acceptedDocumentCodes: requiredCodes.filter(code => value.acceptedDocumentCodes!.includes(code)),
      agreementsAccepted: value.agreementsAccepted === true, authorityConfirmed: value.authorityConfirmed === true,
      roleDeclarationConfirmed: value.roleDeclarationConfirmed === true, privacyAcknowledged: value.privacyAcknowledged === true,
      initialEvidenceRemediationConfirmed: value.initialEvidenceRemediationConfirmed === true };
  } catch { return null; }
}
