import fs from 'node:fs';
import path from 'node:path';

describe('is_owner fresh-schema parity', () => {
  const migration = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260830184529_bootstrap_is_owner_helper.sql'),
    'utf8',
  );

  it('bootstraps the hosted Platform Owner helper before reviewer RLS uses it', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.is_owner(uid uuid)');
    expect(migration).toContain("p.role = 'owner'");
    expect(migration).toContain("p.status::text = 'active'");
    expect(migration).toContain('SET search_path = public, pg_temp');
  });
});
