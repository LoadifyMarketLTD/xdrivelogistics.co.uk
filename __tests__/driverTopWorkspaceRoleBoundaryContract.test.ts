import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('Driver top workspace role boundary', () => {
  const shell = read('app/components/workspace/TopWorkspaceShell.tsx');
  const roles = read('lib/workspaceRole.ts');

  it('keeps owner-only business controls out of the employed Driver primary navigation', () => {
    expect(shell).toContain("if (role === 'owner_driver') return composeDriverPrimaryNav(base, true);");
    expect(shell).toContain("if (role === 'driver') return composeDriverPrimaryNav(base, false);");
    expect(shell).toContain("const showOwnerDriverPostLoadAction = role === 'owner_driver';");
    for (const label of ['Invoices','Company Profile','Drivers & Staff','Settings','Membership & Billing']) {
      expect(roles).toContain(`label: '${label}'`);
    }
  });

  it('shows Book Direct only to carrier roles, Owner Driver or explicitly authorised Driver', () => {
    expect(shell).toContain("role === 'owner_driver' ||");
    expect(shell).toContain("(role === 'driver' && user?.canCommercialBid === true)");
    expect(shell).toContain("'/driver/directory'");
    expect(shell).toContain('BOOK DIRECT');
  });

  it('gives an employed Driver profile, vehicle, documents, notifications, security and audit links', () => {
    for (const fragment of [
      "{ id: 'profile', label: 'Account', href: '/driver/profile'",
      "{ id: 'vehicle', label: 'Vehicle', href: '/driver/vehicles'",
      "{ id: 'documents', label: 'Documents', href: '/driver/documents'",
      "{ id: 'notifications', label: 'Notifications', href: '/driver/notifications'",
      "{ id: 'security', label: 'Security', href: '/driver/change-password'",
      "{ id: 'event-log', label: 'Event Log', href: '/driver/event-log'",
    ]) expect(roles).toContain(fragment);
  });
});
