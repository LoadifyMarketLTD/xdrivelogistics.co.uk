import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260821124443_fix_profile_sync_legacy_id.sql'),
  'utf8',
);

describe('clean replay profiles legacy id contract', () => {
  it('reconstructs the hosted profiles.id dependency before the auth trigger writes it', () => {
    expect(migration).toContain('ADD COLUMN id uuid');
    expect(migration).toContain('SET id = user_id');
    expect(migration).toContain('ALTER COLUMN id SET DEFAULT gen_random_uuid()');
    expect(migration).toContain('ALTER COLUMN id SET NOT NULL');
    expect(migration).toContain('ADD CONSTRAINT profiles_id_unique UNIQUE (id)');
    expect(migration).toContain('ADD CONSTRAINT profiles_id_fkey');
    expect(migration).toContain('REFERENCES auth.users(id)');
    expect(migration).toContain('ON DELETE CASCADE');
    expect(migration).toContain('INSERT INTO public.profiles (\n    id,\n    user_id,');
  });

  it('fails closed on conflicting pre-existing legacy identifiers', () => {
    expect(migration).toContain('id IS DISTINCT FROM user_id');
    expect(migration).toContain(
      'Existing public.profiles.id values conflict with canonical user_id identity.',
    );
  });

  it('does not recreate unrelated hosted profile drift', () => {
    expect(migration).not.toContain('ADD COLUMN xd_id');
    expect(migration).not.toContain('assign_xd_user_id');
  });
});
