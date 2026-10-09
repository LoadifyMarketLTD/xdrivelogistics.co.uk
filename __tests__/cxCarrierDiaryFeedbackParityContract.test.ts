import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('CX carrier Diary feedback parity contract', () => {
  const diary = read('app/components/workspace/OperationsDiaryPage.tsx');
  const reviewRls = read('supabase/migrations/20260819153500_reconcile_driver_diary_review_reads.sql');
  const canonicalDiary = read('lib/diary/canonicalDiary.ts');

  it('uses real company-scoped review reads for Feedback views', () => {
    expect(diary).toContain(".from('reviews')");
    expect(diary).toContain(".eq('reviewer_company_id', companyId)");
    expect(diary).toContain('isCompanyFeedbackEligible(job, companyId)');
    expect(canonicalDiary).toContain("{ id: 'awaiting_feedback', label: 'Awaiting Feedback' }");
    expect(canonicalDiary).toContain("{ id: 'recent_feedback', label: 'Recent Feedback' }");
  });

  it('derives awaiting feedback only from completed jobs with no real review', () => {
    expect(diary).toContain("matchesCanonicalDiaryBucket(job, 'awaiting_feedback'");
    expect(diary).toContain('feedbackEligible: isCompanyFeedbackEligible(job, companyId)');
    expect(canonicalDiary).toContain("stage === 'completed' && feedbackEligible && !hasFeedback");
    expect(diary).not.toContain('feedbackCount: 0');
  });

  it('keeps feedback read-only and covered by company-operator RLS', () => {
    expect(diary).not.toContain(".from('reviews').insert");
    expect(diary).not.toContain(".from('reviews').update");
    expect(reviewRls).toContain('reviews_select_participant_or_company_operator');
    expect(reviewRls).toContain('public.is_company_non_driver(company_id)');
  });
});
