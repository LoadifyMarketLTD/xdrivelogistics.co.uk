import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('CX carrier Diary feedback parity contract', () => {
  const diary = read('app/components/workspace/OperationsDiaryPage.tsx');
  const reviewRls = read('supabase/migrations/20260819153500_reconcile_driver_diary_review_reads.sql');

  it('uses real company-scoped review reads for Feedback views', () => {
    expect(diary).toContain(".from('reviews')");
    expect(diary).toContain(".eq('company_id', companyId)");
    expect(diary).toContain("type FeedbackMode = 'all' | 'awaiting' | 'recent'");
    expect(diary).toContain("label: 'Feedback'");
    expect(diary).toContain('Awaiting feedback');
    expect(diary).toContain('Recent feedback');
  });

  it('derives awaiting feedback only from completed jobs with no real review', () => {
    expect(diary).toContain("classifyWorkspaceJobStage(job) === 'completed'");
    expect(diary).toContain('!hasRecentFeedback(reviews)');
    expect(diary).not.toContain('feedbackCount: 0');
  });

  it('keeps feedback read-only and covered by company-operator RLS', () => {
    expect(diary).not.toContain(".from('reviews').insert");
    expect(diary).not.toContain(".from('reviews').update");
    expect(reviewRls).toContain('reviews_select_participant_or_company_operator');
    expect(reviewRls).toContain('public.is_company_non_driver(company_id)');
  });
});
