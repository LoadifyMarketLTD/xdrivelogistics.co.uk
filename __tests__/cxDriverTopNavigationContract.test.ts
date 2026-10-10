import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const shell = read('app/components/workspace/TopWorkspaceShell.tsx');
const roles = read('lib/workspaceRole.ts');
const notificationsApi = read('app/api/workspace/notifications/route.ts');

describe('Driver top navigation role split', () => {
  it('keeps employed Driver navigation execution-first in the shared shell', () => {
    for (const primary of [
      "['driver-dashboard-primary', 'Dashboard', '/driver']",
      "['driver-jobs-primary', 'My Jobs', '/driver/jobs']",
      "['driver-diary-primary', 'Diary', '/driver/history']",
      "['driver-availability-primary', 'Availability', '/driver/availability']",
      "['driver-vehicle-primary', 'Vehicle', '/driver/vehicles']",
      "['driver-documents-primary', 'Documents', '/driver/documents']",
    ]) expect(shell).toContain(primary);
  });

  it('keeps commercial tools on Owner Driver while preserving role-aware Book Direct', () => {
    for (const href of ['/driver/directory','/driver/nearby','/driver/returns','/driver/loads','/driver/quotes']) {
      expect(roles).toContain("href: '" + href + "'");
    }
    expect(shell).toContain("role === 'owner_driver'");
    expect(shell).toContain('BOOK DIRECT');
    expect(shell).toContain('showOwnerDriverPostLoadAction');
  });

  it('keeps Owner Driver business controls sole-trader scoped', () => {
    for (const label of ['Finance / Invoices','Membership & Billing']) expect(roles).toContain("label: '" + label + "'");
    for (const forbidden of ['Drivers & Staff','Manage Drivers']) expect(roles).not.toContain("label: '" + forbidden + "'");
    expect(shell).toContain("['owner-driver-finance-primary', 'Finance', '/driver/finance']");
    expect(shell).toContain("['/driver/vehicles', 'My Vehicle']");
  });

  it('keeps notification counting server-authoritative for every workspace role', () => {
    expect(shell).toContain("fetch('/api/workspace/notifications?mode=count'");
    expect(notificationsApi).toContain(".eq('user_id', auth.user.id)");
  });
});
