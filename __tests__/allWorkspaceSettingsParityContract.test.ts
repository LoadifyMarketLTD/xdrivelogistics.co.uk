import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('all workspace settings parity', () => {
  const settings = read('app/components/workspace/RoleSettingsWorkspace.tsx');

  it('uses one shared sidebar for every workspace role', () => {
    expect(settings).toContain('<div className="role-settings-layout">');
    expect(settings).toContain('<aside className="role-settings-nav">');
    expect(settings).not.toContain("role !== 'owner' && role !== 'driver'");
    expect(settings).not.toContain('role-settings-layout--topnav');
  });

  it('shows Company Settings in every workspace without widening edit permissions', () => {
    expect(settings).toContain('const companyProfileVisible = true;');
    expect(settings).toContain("{ label: 'Company Settings', action: () => setSection('company'), active: section === 'company' }");
    expect(settings).toContain("const canEditCompany = membershipRole === 'owner' || membershipRole === 'admin';");
    expect(settings).toContain('disabled={!canEditCompany}');
  });

  it('keeps all settings entry pages on the same RoleSettingsWorkspace implementation', () => {
    for (const page of [
      'app/admin/settings/page.tsx',
      'app/driver/settings/page.tsx',
      'app/customer/settings/page.tsx',
      'app/broker/settings/page.tsx',
    ]) {
      expect(read(page)).toContain('RoleSettingsWorkspace');
    }
  });
});
