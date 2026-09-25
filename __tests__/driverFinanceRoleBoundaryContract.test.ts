import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('driver finance role boundary', () => {
  const workspaceRole = fs.readFileSync(path.join(process.cwd(), 'lib/workspaceRole.ts'), 'utf8');
  const route = fs.readFileSync(path.join(process.cwd(), 'app/api/driver/finance/invoices/route.ts'), 'utf8');

  it('keeps invoice capability off fleet drivers and on owner drivers', () => {
    const driverBlock = workspaceRole.slice(
      workspaceRole.indexOf('export const DRIVER_WORKSPACE_CAPABILITIES'),
      workspaceRole.indexOf('const SHARED_DRIVER_NAV'),
    );
    expect(driverBlock).not.toContain("'invoices.carrier.manage'");
    expect(workspaceRole).toContain("owner_driver: new Set<WorkspaceCapability>([...DRIVER_WORKSPACE_CAPABILITIES, 'invoices.carrier.manage', 'billing.manage'])");
    expect(workspaceRole).toContain("capability: 'invoices.carrier.manage'");
  });

  it('denies invoice register access to a driver without owner/admin finance authority', () => {
    expect(route).toContain("Owner-driver or company admin access is required to view invoices.");
    expect(route).not.toContain("query = query.eq('created_by', driver.userId)");
  });
});
