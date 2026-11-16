import { describe, expect, it } from 'vitest';
import { assessOutreachEligibility, type EligibilityInput } from './outreachEligibility';

const valid: EligibilityInput = {
  legalForm: 'ltd', contactKind: 'generic_business', channel: 'email',
  hasDocumentedConsent: false, hasVerifiedSource: true, privacyNoticeReady: true,
  legitimateInterestsAssessmentApproved: false, suppressed: false,
  corporateSubscriberVerified: true,
};
describe('B2B outreach eligibility is fail closed', () => {
  it('permits review of verified corporate generic email only when all controls pass', () => {
    expect(assessOutreachEligibility(valid).allowed).toBe(true);
  });
  it.each([
    { suppressed: true },
    { hasVerifiedSource: false },
    { privacyNoticeReady: false },
    { corporateSubscriberVerified: false },
    { legalForm: 'unknown' as const },
    { contactKind: 'unknown' as const },
    { legalForm: 'sole_trader' as const },
  ])('blocks missing gate %j', (change) => {
    expect(assessOutreachEligibility({ ...valid, ...change }).allowed).toBe(false);
  });
  it('blocks named contact without lawful basis assessment', () => {
    expect(assessOutreachEligibility({ ...valid, contactKind: 'named_person' }).allowed).toBe(false);
  });
  it('blocks calls without TPS/CTPS screening', () => {
    expect(assessOutreachEligibility({ ...valid, channel: 'phone' }).allowed).toBe(false);
  });
  it('blocks calls to screened registered numbers', () => {
    expect(assessOutreachEligibility({
      ...valid, channel: 'phone', tpsCtpsChecked: true, tpsCtpsBlocked: true,
    }).allowed).toBe(false);
  });
});
