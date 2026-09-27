import fs from 'node:fs';
import path from 'node:path';

const migration = fs
  .readFileSync(
    path.join(
      process.cwd(),
      'supabase/migrations/20260927175500_harden_rls_wrapper_search_paths.sql',
    ),
    'utf8',
  )
  .replace(/\r\n/g, '\n');

describe('RLS wrapper SECURITY DEFINER hardening', () => {
  it('locks all wrapper search paths', () => {
    expect(migration.match(/SET search_path = pg_catalog, public/g)?.length)
      .toBeGreaterThanOrEqual(4);
  });

  it('delegates job authority to hardened canonical membership helpers', () => {
    expect(migration).toContain('public.is_company_admin(j.company_id)');
    expect(migration).toContain('public.is_company_non_driver(j.company_id)');
    expect(migration).toContain('public.is_company_operator(j.company_id)');
  });

  it('keeps invoice storage reads company scoped', () => {
    expect(migration).toContain('d.file_url = p_object_name');
    expect(migration).toContain('public.is_company_member(d.company_id)');
  });

  it('closes anonymous execution on every wrapper', () => {
    for (const signature of [
      'public.can_admin_manage_job(uuid)',
      'public.can_non_driver_access_job(uuid)',
      'public.can_operator_access_job(uuid)',
      'public.can_read_invoice_storage_object(text)',
    ]) {
      expect(migration).toContain(`REVOKE ALL ON FUNCTION ${signature} FROM PUBLIC, anon`);
    }
  });
});
