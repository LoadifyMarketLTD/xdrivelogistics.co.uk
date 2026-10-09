import { describe, expect, it } from 'vitest';
import {
  canLeaveCompanyFeedback,
  canonicalFeedbackState,
  resolveFeedbackCounterpartyCompanyId,
} from '../lib/feedback/canonicalFeedback';

const base = {
  company_id: 'poster-company',
  awarded_carrier_company_id: 'carrier-company',
  assigned_company_id: 'carrier-company',
  current_status: 'completed',
  status: 'completed',
};

describe('canonical company feedback', () => {
  it('resolves feedback bidirectionally between booking owner and executing carrier', () => {
    expect(resolveFeedbackCounterpartyCompanyId(base, 'poster-company')).toBe('carrier-company');
    expect(resolveFeedbackCounterpartyCompanyId(base, 'carrier-company')).toBe('poster-company');
  });

  it('does not create feedback eligibility for unrelated or internal same-company execution', () => {
    expect(resolveFeedbackCounterpartyCompanyId(base, 'other-company')).toBeNull();
    expect(canLeaveCompanyFeedback({ ...base, awarded_carrier_company_id: 'poster-company', assigned_company_id: 'poster-company' }, 'poster-company')).toBe(false);
  });

  it('requires a terminal booking lifecycle', () => {
    expect(canLeaveCompanyFeedback({ ...base, current_status: 'in_transit' }, 'poster-company')).toBe(false);
    expect(canLeaveCompanyFeedback({ ...base, current_status: 'delivered' }, 'poster-company')).toBe(true);
    expect(canLeaveCompanyFeedback({ ...base, current_status: 'cancelled' }, 'carrier-company')).toBe(true);
  });

  it('derives awaiting versus feedback-left from the reviewer company record', () => {
    expect(canonicalFeedbackState(base, 'poster-company', false)).toBe('awaiting_feedback');
    expect(canonicalFeedbackState(base, 'poster-company', true)).toBe('feedback_left');
    expect(canonicalFeedbackState(base, 'other-company', false)).toBe('unavailable');
  });
});
