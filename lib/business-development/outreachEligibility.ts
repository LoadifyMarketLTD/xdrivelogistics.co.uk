/** Conservative, fail-closed eligibility checks for proposed XDrive B2B CRM.
 * This is NOT permission to send messages. Legal review, privacy notice,
 * source provenance and suppression checks remain mandatory.
 */
export type LegalForm = 'ltd' | 'llp' | 'sole_trader' | 'other' | 'unknown';
export type ContactKind = 'generic_business' | 'named_person' | 'unknown';
export type ContactChannel = 'email' | 'phone';
export type OutreachEligibility = {
  allowed: boolean;
  reasons: string[];
};
export type EligibilityInput = {
  legalForm: LegalForm;
  contactKind: ContactKind;
  channel: ContactChannel;
  hasDocumentedConsent: boolean;
  hasVerifiedSource: boolean;
  privacyNoticeReady: boolean;
  legitimateInterestsAssessmentApproved: boolean;
  suppressed: boolean;
  corporateSubscriberVerified: boolean;
  tpsCtpsChecked?: boolean;
  tpsCtpsBlocked?: boolean;
};

export function assessOutreachEligibility(input: EligibilityInput): OutreachEligibility {
  const reasons: string[] = [];
  if (!input.hasVerifiedSource) reasons.push('Missing verified source provenance');
  if (!input.privacyNoticeReady) reasons.push('Privacy notice process not approved');
  if (input.suppressed) reasons.push('Contact has opted out or is suppressed');
  if (input.contactKind === 'unknown') reasons.push('Contact classification unknown');
  if (input.legalForm === 'unknown') reasons.push('Legal entity classification unknown');

  if (input.channel === 'email') {
    const corporate = (input.legalForm === 'ltd' || input.legalForm === 'llp') &&
      input.corporateSubscriberVerified;
    if (!corporate && !input.hasDocumentedConsent) {
      reasons.push('Email requires documented consent or verified corporate-subscriber exception');
    }
    if (input.contactKind === 'named_person' &&
        !input.legitimateInterestsAssessmentApproved && !input.hasDocumentedConsent) {
      reasons.push('Named business contact requires approved personal-data lawful basis');
    }
  } else {
    if (!input.tpsCtpsChecked) reasons.push('TPS/CTPS screening not confirmed');
    if (input.tpsCtpsBlocked) reasons.push('TPS/CTPS registration blocks unsolicited live marketing calls without applicable permission');
    if (input.contactKind === 'named_person' &&
        !input.legitimateInterestsAssessmentApproved && !input.hasDocumentedConsent) {
      reasons.push('Named business contact requires approved personal-data lawful basis');
    }
  }
  return { allowed: reasons.length === 0, reasons };
}
