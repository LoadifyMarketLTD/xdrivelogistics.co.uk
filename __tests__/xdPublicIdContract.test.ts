import fs from 'node:fs';
import path from 'node:path';

describe('XDrive public ID contract', () => {
  const migration = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/131_standardize_global_xd_public_ids.sql'),
    'utf8',
  );

  it('uses one global sequential XD namespace', () => {
    expect(migration).toContain('xd_public_id_seq');
    expect(migration).toContain("RETURN 'XD-' || lpad(v_num::text, 6, '0')");
    expect(migration).not.toContain('gen_random_uuid');
  });

  it('assigns IDs automatically to both profiles and companies', () => {
    expect(migration).toContain('trg_profiles_assign_xd_id');
    expect(migration).toContain('trg_companies_assign_xd_id');
    expect(migration).toContain('public.generate_xd_public_id()');
  });

  it('keeps assigned public IDs immutable', () => {
    expect(migration).toContain('XDrive public ID is immutable after assignment.');
  });
});
