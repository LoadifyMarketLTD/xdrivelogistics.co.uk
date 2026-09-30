import { describe, expect, it } from 'vitest';
import { legalDraftKey, readLegalDraft, type LegalAcceptanceDraft } from '../lib/legal/legalAcceptanceDraft';
const now = Date.now();
const draft: LegalAcceptanceDraft = { savedAt: now, signerFullName: 'Test Signer', acceptedDocumentCodes: ['platform_terms'], agreementsAccepted: true,
  authorityConfirmed: true, roleDeclarationConfirmed: true, privacyAcknowledged: true, initialEvidenceRemediationConfirmed: true };
describe('unsigned legal draft recovery', () => {
  it('preserves explicitly selected confirmations and name', () => {
    expect(readLegalDraft(JSON.stringify(draft), ['platform_terms'], now)).toEqual(draft);
  });
  it('isolates drafts by authenticated user, company and exact requirement fingerprint', () => {
    const key = legalDraftKey('user-a', 'company-a', 'hash-a');
    expect(key).not.toBe(legalDraftKey('user-b', 'company-a', 'hash-a'));
    expect(key).not.toBe(legalDraftKey('user-a', 'company-b', 'hash-a'));
    expect(key).not.toBe(legalDraftKey('user-a', 'company-a', 'hash-b'));
  });
  it('drops expired or future-dated drafts', () => {
    expect(readLegalDraft(JSON.stringify(draft), [], now + 13 * 3600000)).toBeNull();
    expect(readLegalDraft(JSON.stringify({ ...draft, savedAt: now + 120000 }), [], now)).toBeNull();
  });
  it.each([null, '', '{broken', 'null', '{}'])('ignores unavailable or corrupted storage: %s', raw => {
    expect(readLegalDraft(raw, ['platform_terms'], now)).toBeNull();
  });
  it('never restores document codes outside the current mandatory package', () => {
    const value = readLegalDraft(JSON.stringify({ ...draft, acceptedDocumentCodes: ['obsolete', 'platform_terms'] }), ['platform_terms'], now);
    expect(value?.acceptedDocumentCodes).toEqual(['platform_terms']);
  });
  it('does not coerce strings into consent', () => {
    expect(readLegalDraft(JSON.stringify({ ...draft, agreementsAccepted: 'true' }), ['platform_terms'], now)?.agreementsAccepted).toBe(false);
  });
});
