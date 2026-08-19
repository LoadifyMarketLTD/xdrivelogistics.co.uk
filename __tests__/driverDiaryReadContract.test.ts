import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const reviewReads = read('supabase/migrations/20260819153500_reconcile_driver_diary_review_reads.sql');
const documentReads = read('supabase/migrations/20260819142500_enable_assigned_driver_job_document_reads.sql');

describe('Driver Diary read contract', () => {
  it('collapses broad/duplicate review reads to one participant-or-operator policy', () => {
    expect(reviewReads).toContain('DROP POLICY IF EXISTS reviews_select_member ON public.reviews');
    expect(reviewReads).toContain('DROP POLICY IF EXISTS reviews_select_participant_or_non_driver ON public.reviews');
    expect(reviewReads).toContain('CREATE POLICY reviews_select_participant_or_company_operator');
    expect(reviewReads).toContain('reviewer_user_id = auth.uid()');
    expect(reviewReads).toContain('reviewed_user_id = auth.uid()');
    expect(reviewReads).toContain('public.is_company_non_driver(company_id)');
    expect(reviewReads).toContain('GRANT SELECT ON TABLE public.reviews TO authenticated');
  });

  it('does not expand review mutation permissions', () => {
    expect(reviewReads).not.toContain('FOR INSERT');
    expect(reviewReads).not.toContain('FOR UPDATE');
    expect(reviewReads).not.toContain('FOR DELETE');
  });

  it('keeps job document reads assigned-driver scoped through existing RLS', () => {
    expect(documentReads).toContain('GRANT SELECT ON TABLE public.job_documents TO authenticated');
    expect(documentReads).toContain('job_documents_select_assigned_driver');
    expect(reviewReads).toContain('DROP POLICY IF EXISTS owner_select_all_job_documents ON public.job_documents');
    expect(reviewReads).not.toContain('CREATE POLICY');
  });
});
