import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/RoleSettingsWorkspace.tsx'), 'utf8');

describe('CX-informed Settings company administration boundary', () => {
  it('keeps canonical company identity owner-only', () => {
    expect(source).toContain("const canEditCompany = membershipRole === 'owner';");
  });

  it('limits company-management shortcuts to owner/admin memberships', () => {
    expect(source).toContain("const canManageCompanyOperations = membershipRole === 'owner' || membershipRole === 'admin';");
    expect(source).toContain('routes.team && canManageCompanyOperations');
    expect(source).toContain('routes.vehicles && canManageCompanyOperations');
    expect(source).toContain("role === 'fleet' && canManageCompanyOperations");
  });

  it('does not expose membership billing to ordinary company users or employee drivers', () => {
    expect(source).toContain('const canManageBilling = canManageCompanyOperations;');
    expect(source).toContain("role !== 'driver' && canManageBilling");
    expect(source).toContain("role === 'driver' ? 'Personal profile, security, documents and workspace preferences for the signed-in driver.'");
  });
});
