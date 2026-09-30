import fs from 'node:fs';
import path from 'node:path';

describe('XD public ID fresh-schema bootstrap', () => {
  const before = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260909110800_bootstrap_xd_public_id_columns.sql'),
    'utf8',
  );
  const standardize = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260909110900_standardize_global_xd_public_ids.sql'),
    'utf8',
  );
  const after = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260909111000_enforce_profile_xd_public_id_not_null.sql'),
    'utf8',
  );

  it('creates both xd_id columns before the standardisation migration reads them', () => {
    expect('20260909110800' < '20260909110900').toBe(true);
    expect(before).toContain('ALTER TABLE public.profiles');
    expect(before).toContain('ADD COLUMN IF NOT EXISTS xd_id text');
    expect(before).toContain('ALTER TABLE public.companies');
    expect(standardize).toContain("FROM public.profiles");
    expect(standardize).toContain('SET xd_id =');
  });

  it('restores hosted profile nullability after the generator exists', () => {
    expect('20260909111000' > '20260909110900').toBe(true);
    expect(after).toContain('public.generate_xd_public_id()');
    expect(after).toContain('WHERE xd_id IS NULL');
    expect(after).toContain('ALTER COLUMN xd_id SET NOT NULL');
  });
});