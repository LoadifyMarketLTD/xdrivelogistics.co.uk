import fs from 'node:fs';
import path from 'node:path';

describe('job_documents fresh-schema alias bootstrap', () => {
  const bootstrap = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260917175500_bootstrap_job_documents_legacy_alias_columns.sql'),
    'utf8',
  );
  const align = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260917175510_align_job_documents_canonical_contract_20260917.sql'),
    'utf8',
  );

  it('creates legacy alias columns before the canonical alignment reads them', () => {
    expect('20260917175500' < '20260917175510').toBe(true);
    expect(bootstrap).toContain('ADD COLUMN IF NOT EXISTS file_type text');
    expect(bootstrap).toContain('ADD COLUMN IF NOT EXISTS file_url text');
    expect(align).toContain("NULLIF(file_type, '')");
    expect(align).toContain("NULLIF(file_url, '')");
  });
});