import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const settingsPage = readFileSync(new URL('../app/admin/settings/page.tsx', import.meta.url), 'utf8');
const workspace = readFileSync(new URL('../app/components/workspace/RoleSettingsWorkspace.tsx', import.meta.url), 'utf8');

describe('verified company identity settings contract', () => {
  it('keeps the verified company number visible but outside editable company fields', () => {
    expect(settingsPage).toContain('resolveWorkspaceRole(user)');
    expect(settingsPage).toContain('<RoleSettingsWorkspace role={settingsRole} roleLabel={roleLabel} />');
    expect(workspace).toContain('Registered company number');
    expect(workspace).toContain("company.company_number || 'Not recorded'");
    expect(workspace).not.toContain('company_number: textOrNull');
    expect(workspace).not.toContain('company_number: companyForm');
    expect(workspace).not.toContain('companyNumber: e.target.value');
  });
});
