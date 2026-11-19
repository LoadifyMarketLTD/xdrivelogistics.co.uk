import { describe, expect, it } from 'vitest';
import { canonicalFeedbackState } from '../lib/feedback/canonicalFeedback';
import { readFileSync } from 'node:fs';
describe('Owner company Diary feedback parity',()=>{
 const booking={company_id:'poster',awarded_carrier_company_id:'carrier',current_status:'cancelled'};
 it('includes eligible cancelled bookings without feedback',()=>expect(canonicalFeedbackState(booking,'carrier',false)).toBe('awaiting_feedback'));
 it('excludes ineligible cancelled bookings',()=>expect(canonicalFeedbackState(booking,'unrelated',false)).toBe('unavailable'));
 it('excludes an already reviewed cancelled booking',()=>expect(canonicalFeedbackState(booking,'carrier',true)).toBe('feedback_left'));
 it('uses the existing authorized feedback state in owner Diary',()=>expect(readFileSync('app/driver/history/page.tsx','utf8')).toContain("if (filter === 'awaiting_feedback') return isAwaitingFeedback(job, reviews, reviewerCompanyId)"));
 it('preserves all persisted review values when opening edit feedback',()=>expect(readFileSync('app/api/driver/diary/company-snapshot/route.ts','utf8')).toContain('reviewer_company_id, rating, comment, would_use_again, delivered_promptly, courteous, created_at'));
});
