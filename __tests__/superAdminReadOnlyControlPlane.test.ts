import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('Super Admin read-only control-plane promotion', () => {
  test('promoted inspector surface has no mutation/action path', () => {
    const page = read('app/super-admin/inspect/[entityType]/[entityId]/page.tsx');
    expect(page).toContain('READ ONLY');
    expect(page).not.toContain('/actions');
    expect(page).not.toContain("method: 'POST'");
    expect(page).not.toContain('PlatformActionPanel');
    expect(page).not.toContain('CompanyGovernanceControls');
  });

  test('promoted APIs expose GET only', () => {
    for (const file of [
      'app/api/super-admin/search/route.ts',
      'app/api/super-admin/inspect/[entityType]/[entityId]/route.ts',
      'app/api/super-admin/inspect/company/[entityId]/360/route.ts',
    ]) {
      const source = read(file);
      expect(source).toContain('export async function GET');
      expect(source).not.toContain('export async function POST');
      expect(source).not.toContain('export async function PATCH');
      expect(source).not.toContain('export async function PUT');
      expect(source).not.toContain('export async function DELETE');
    }
  });

  test('case schema absence remains truthfully reported', () => {
    const search = read('app/api/super-admin/search/route.ts');
    const inspector = read('app/api/super-admin/inspect/[entityType]/[entityId]/route.ts');
    expect(search).toContain('Platform Case Centre schema is not applied in this environment.');
    expect(inspector).toContain('Platform Case Centre schema is not applied in this environment.');
  });

  test('workspace exposes Global Search without enabling Action Centre', () => {
    const workspace = read('app/super-admin/_components/SuperAdminWorkspaceShell.tsx');
    const shell = read('app/super-admin/_components/SuperAdminCardNavigationShell.tsx');
    expect(workspace).toContain("label: 'Global Search'");
    expect(workspace).toContain("href: '/super-admin/search'");
    expect(shell).toContain('actionCentreAvailable');
    expect(shell).toContain('disabled={!actionCentreAvailable}');
  });

  test('read-only inspect and copy links retain the approved light control styling', () => {
    const hardening = read('app/super-admin/super-admin-light-hardening.css');
    expect(hardening).toContain('.super-admin-light-root .sa-button');
    expect(hardening).toContain('border: 1px solid #D9E1EA');
    expect(hardening).toContain('color: #1D57D8');
  });
});
