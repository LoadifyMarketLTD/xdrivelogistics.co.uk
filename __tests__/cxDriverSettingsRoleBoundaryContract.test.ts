import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const page = fs.readFileSync(path.join(process.cwd(), 'app/driver/settings/page.tsx'), 'utf8');
const settings = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/RoleSettingsWorkspace.tsx'), 'utf8');

describe('CX-informed Driver vs Owner Driver settings boundary', () => {
  it('does not present every signed-in driver as an Owner Driver', () => {
    expect(page).toContain("const workspaceRole = resolveWorkspaceRole(user);");
    expect(page).toContain("workspaceRole === 'owner_driver' ? 'owner' as const : 'driver' as const");
    expect(page).toContain('<RoleSettingsWorkspace role={settingsRole} />');
  });

  it('keeps personal driver settings separate from company ownership and billing controls', () => {
    expect(settings).toContain("driver: 'Driver'");
    expect(settings).toContain("role === 'driver' ? []");
    expect(settings).toContain("role !== 'driver' && <ActionButton");
    expect(settings).toContain("role === 'driver' && <ActionButton tone=\"secondary\" onClick={() => setSection('profile')}>My Profile</ActionButton>");
  });

  it('keeps Driver and Owner Driver inside the same top-level Settings visual composition', () => {
    expect(settings).toContain("role === 'owner' || role === 'driver'");
    expect(settings).toContain("role !== 'owner' && role !== 'driver'");
  });
});
