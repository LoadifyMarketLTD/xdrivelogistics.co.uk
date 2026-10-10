import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('Driver top workspace role boundary', () => {
  const shell = read('app/components/workspace/TopWorkspaceShell.tsx');
  const roles = read('lib/workspaceRole.ts');

  it('keeps Owner Driver commercial tools without fleet/team administration', () => {
    expect(shell).toContain("if (role === 'owner_driver') return composeDriverPrimaryNav(base, true);");
    expect(shell).toContain("const showOwnerDriverPostLoadAction = role === 'owner_driver';");
    expect(roles).toContain("label: 'Finance / Invoices'");
    expect(roles).toContain("label: 'Membership & Billing'");
    expect(roles).not.toContain("label: 'Drivers & Staff'");
    expect(roles).not.toContain("label: 'Manage Drivers'");
  });

  it('shows Book Direct to Owner Driver and explicitly authorised Driver', () => {
    expect(shell).toContain("role === 'owner_driver' ||");
    expect(shell).toContain("(role === 'driver' && user?.canCommercialBid === true)");
    expect(shell).toContain('BOOK DIRECT');
  });

  it('keeps employed Driver personal vehicle, documents and account links', () => {
    for (const fragment of [
      "{ id: 'profile', label: 'Account', href: '/driver/profile'",
      "{ id: 'vehicle', label: 'Vehicle', href: '/driver/vehicles'",
      "{ id: 'documents', label: 'Documents', href: '/driver/documents'",
      "{ id: 'notifications', label: 'Notifications', href: '/driver/notifications'",
    ]) expect(roles).toContain(fragment);
  });
});
