import fs from 'node:fs';
import path from 'node:path';

const migration = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260925050000_company_departments.sql'), 'utf8');
const api = fs.readFileSync(path.join(process.cwd(), 'app/api/settings/departments/route.ts'), 'utf8');
const teamApi = fs.readFileSync(path.join(process.cwd(), 'app/api/customer/team/route.ts'), 'utf8');
const settings = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/RoleSettingsWorkspace.tsx'), 'utf8');
const customer = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/CustomerTeamPage.tsx'), 'utf8');
const broker = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/BrokerTeamPage.tsx'), 'utf8');

describe('company Departments model', () => {
  it('creates company-scoped departments and prevents cross-company membership assignment', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.company_departments');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS department_id');
    expect(migration).toContain('enforce_membership_department_company');
    expect(migration).toContain("RAISE EXCEPTION 'Department is outside this company workspace.'");
  });

  it('limits department management to company owner/admin', () => {
    expect(api).toContain("adminRoles = new Set(['owner', 'admin'])");
    expect(api).toContain('Company owner or admin access is required to manage departments.');
    expect(migration).toContain('public.is_company_admin(company_id)');
  });

  it('supports create, rename, description and safe delete', () => {
    expect(api).toContain('export async function POST');
    expect(api).toContain('export async function PATCH');
    expect(api).toContain('export async function DELETE');
    expect(api).toContain('Move members out of this department before deleting it.');
    expect(settings).toContain('<CompanyDepartmentsPanel companyId={company.id} />');
  });

  it('integrates department assignment into Customer and Broker team management', () => {
    expect(teamApi).toContain("action: z.enum(['role', 'department', 'suspend', 'reactivate', 'remove'])");
    expect(teamApi).toContain('departmentId: membership.department_id');
    expect(teamApi).toContain(".rpc('assign_company_membership_department'");
    expect(customer).toContain("action: 'department'");
    expect(broker).toContain("action: 'department'");
    expect(customer).toContain("'Department'");
    expect(broker).toContain("'Department'");
  });
});
