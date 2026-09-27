import fs from 'node:fs';
import path from 'node:path';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260927011514_harden_active_membership_helpers.sql'),
  'utf8',
);

describe('active company membership RLS helper contract', () => {
  it('requires active membership in all canonical company helpers', () => {
    for (const fn of ['is_company_member','is_company_admin','is_company_operator','is_company_non_driver']) {
      expect(migration).toContain(`CREATE OR REPLACE FUNCTION public.${fn}`);
    }
    expect(migration.match(/cm\.status::text = 'active'/g)?.length).toBe(4);
    expect(migration).toContain("pg_get_functiondef(p.oid) ILIKE '%status <> ''suspended''%'");
  });

  it('keeps company lifecycle active as part of authorization', () => {
    expect(migration.match(/c\.status::text = 'active'/g)?.length).toBe(4);
  });

  it('keeps helper execution explicit for signed-in users and service role only', () => {
    for (const fn of ['is_company_member','is_company_admin','is_company_operator','is_company_non_driver']) {
      expect(migration).toContain(`REVOKE ALL ON FUNCTION public.${fn}(uuid) FROM PUBLIC, anon`);
      expect(migration).toContain(`GRANT EXECUTE ON FUNCTION public.${fn}(uuid) TO authenticated, service_role`);
    }
  });
});
