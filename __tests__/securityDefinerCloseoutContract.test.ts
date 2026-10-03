import fs from 'node:fs';
import path from 'node:path';

const migrationDir = path.join(process.cwd(), 'supabase', 'migrations');
const closeoutMigrations = fs
  .readdirSync(migrationDir)
  .filter((name) => /^20260927(122500|124500|131500|142000|143500|145000|150500|152500|154500|160500|162500|165500|171500|173500|175500)_/.test(name))
  .sort()
  .map((name) => fs.readFileSync(path.join(migrationDir, name), 'utf8').replace(/\r\n/g, '\n'))
  .join('\n');

const auditedSecurityDefinerFunctions = [
  'accept_driver_invite',
  'active_company_membership_role',
  'auth_company_id',
  'bootstrap_company_membership',
  'can_admin_manage_job',
  'can_authenticated_driver_quote',
  'can_driver_access_job',
  'can_driver_update_job',
  'can_manage_company_members',
  'can_non_driver_access_job',
  'can_operator_access_job',
  'can_read_invoice_storage_object',
  'can_read_marketplace_execution_job',
  'can_review_onboarding_storage_object',
  'company_compliance_issues',
  'driver_go_online',
  'driver_update_job_status_atomic',
  'get_my_role_status',
  'get_or_create_company_for_user',
  'has_capability',
  'is_company_admin',
  'is_company_creator',
  'is_company_member',
  'is_company_members_admin',
  'is_company_non_driver',
  'is_company_operator',
  'next_invoice_number',
  'set_vehicle_advertising_state',
] as const;

describe('SECURITY DEFINER closeout contract', () => {
  it('covers every authenticated SECURITY DEFINER function found in the 2026-09-27 production audit', () => {
    for (const fn of auditedSecurityDefinerFunctions) {
      expect(closeoutMigrations).toContain(fn);
    }
    expect(auditedSecurityDefinerFunctions).toHaveLength(28);
  });

  it('removes direct authenticated execution from the two unused legacy helpers', () => {
    expect(closeoutMigrations).toMatch(/REVOKE ALL ON FUNCTION public\.get_my_role_status\(\)\s+FROM PUBLIC, anon, authenticated/);
    expect(closeoutMigrations).toMatch(/REVOKE ALL ON FUNCTION public\.is_company_members_admin\(uuid\)\s+FROM PUBLIC, anon, authenticated/);
  });

  it('closes anonymous execution on active authenticated helpers', () => {
    const signatures = [
      'public.auth_company_id()',
      'public.can_manage_company_members(uuid)',
      'public.can_driver_access_job(uuid)',
      'public.can_driver_update_job(uuid)',
      'public.can_read_marketplace_execution_job(uuid)',
      'public.can_review_onboarding_storage_object(text, text)',
      'public.company_compliance_issues(uuid, text)',
      'public.driver_go_online()',
      'public.get_or_create_company_for_user()',
      'public.has_capability(uuid, text)',
      'public.next_invoice_number(uuid)',
    ];

    for (const signature of signatures) {
      expect(closeoutMigrations).toContain(`REVOKE ALL ON FUNCTION ${signature}`);
    }
  });

  it('uses hardened search paths in rewritten SECURITY DEFINER helpers', () => {
    expect(closeoutMigrations).toContain('SET search_path = pg_catalog, public');
    expect(closeoutMigrations).not.toContain('SET search_path = public AS');
  });

  it('contains no deprecated auth.role() calls in the closeout migrations', () => {
    expect(closeoutMigrations).not.toContain('auth.role()');
  });
});
