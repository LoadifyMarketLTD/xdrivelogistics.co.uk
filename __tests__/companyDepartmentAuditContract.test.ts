import fs from 'node:fs';
import path from 'node:path';

const migration = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260925052500_company_department_audit.sql'), 'utf8');
const departmentsApi = fs.readFileSync(path.join(process.cwd(), 'app/api/settings/departments/route.ts'), 'utf8');
const teamApi = fs.readFileSync(path.join(process.cwd(), 'app/api/customer/team/route.ts'), 'utf8');

describe('company Department audit contract', () => {
  it('keeps a company-scoped append-only audit history outside Platform Owner audit', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.company_department_audit');
    expect(migration).toContain('company_department_audit_select_member');
    expect(migration).not.toContain('owner_audit_log');
    for (const action of ['department_created', 'department_updated', 'department_deleted', 'member_department_changed']) expect(migration).toContain(action);
  });

  it('executes department lifecycle and audit writes atomically in a service-only RPC', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.manage_company_department');
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.manage_company_department(uuid,uuid,text,uuid,text,text) TO service_role");
    expect(departmentsApi).toContain(".rpc('manage_company_department'");
    expect(departmentsApi).not.toContain(".from('owner_audit_log')");
  });

  it('audits member department changes with the real authenticated actor', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.assign_company_membership_department');
    expect(migration).toContain("'member_department_changed'");
    expect(teamApi).toContain(".rpc('assign_company_membership_department'");
    expect(teamApi).toContain('p_actor_user_id: user.id');
  });
});
