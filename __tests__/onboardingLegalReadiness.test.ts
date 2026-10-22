import { describe, expect, it } from 'vitest';
import { buildCurrentLegalEvidence } from '../lib/legal/legalAgreementState';
import { hasCurrentOnboardingLegalEvidence } from '../lib/legal/onboardingLegalReadiness';
const evidence=buildCurrentLegalEvidence('owner_operator','2026-10-20T20:00:00Z','en');
const current=()=>({registration_role:evidence.registrationRole,legal_version:evidence.legalVersion,privacy_version:evidence.privacyVersion,
  agreements:evidence.agreements,acceptance_language:evidence.acceptanceLanguage,privacy_document_hash:evidence.privacyDocumentHash,
  accepted_at:evidence.acceptedAt,language_comprehension_confirmed_at:evidence.acceptedAt});
describe('current legal evidence at submission',()=>{
  it('requires current material versions, language and snapshots',()=>{expect(hasCurrentOnboardingLegalEvidence(current(),'owner_operator')).toBe(true);});
  it('does not retroactively invalidate an otherwise current historical signature',()=>{
    expect(hasCurrentOnboardingLegalEvidence({...current(),language_comprehension_confirmed_at:null},'owner_operator')).toBe(true);
  });
  it.each(['legal_version','privacy_version','acceptance_language','privacy_document_hash'])('rejects a missing or outdated %s',key=>{
    const row:Record<string,unknown>=current();row[key]='obsolete';expect(hasCurrentOnboardingLegalEvidence(row,'owner_operator')).toBe(false);
    delete row[key];expect(hasCurrentOnboardingLegalEvidence(row,'owner_operator')).toBe(false);
  });
  it('rejects missing document snapshots and another contractual role',()=>{
    expect(hasCurrentOnboardingLegalEvidence({...current(),agreements:[]},'owner_operator')).toBe(false);
    expect(hasCurrentOnboardingLegalEvidence(current(),'fleet_operator')).toBe(false);
  });
  it('rejects invalid or missing evidence',()=>{
    expect(hasCurrentOnboardingLegalEvidence(null,'owner_operator')).toBe(false);
    expect(hasCurrentOnboardingLegalEvidence({...current(),agreements:[null]},'owner_operator')).toBe(false);
  });
});
