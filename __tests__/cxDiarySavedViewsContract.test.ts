import fs from 'node:fs';
import path from 'node:path';

const diary = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/OperationsDiaryPage.tsx'), 'utf8');
const migration = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260925031500_diary_saved_views.sql'), 'utf8');

describe('CX Diary named Saved Views parity', () => {
  it('persists views per authenticated user and company instead of browser-only storage', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.diary_saved_views');
    expect(migration).toContain('user_id uuid NOT NULL REFERENCES auth.users(id)');
    expect(migration).toContain('UNIQUE (company_id, user_id, name)');
    expect(migration).toContain('user_id = auth.uid() AND public.is_company_member(company_id)');
  });

  it('loads, saves, applies and deletes named Diary views', () => {
    expect(diary).toContain(".from('diary_saved_views')");
    expect(diary).toContain('SAVED VIEWS');
    expect(diary).toContain('SAVE CURRENT VIEW');
    expect(diary).toContain('Save View');
    expect(diary).toContain('deleteSavedView');
    expect(diary).toContain('applySavedView');
  });

  it('stores only filter state and never job/commercial records in saved views', () => {
    expect(diary).toContain('filters: search');
    expect(migration).toContain("filters jsonb NOT NULL DEFAULT '{}'::jsonb");
    expect(migration).not.toContain('job_id');
    expect(migration).not.toContain('agreed_rate');
  });
});
