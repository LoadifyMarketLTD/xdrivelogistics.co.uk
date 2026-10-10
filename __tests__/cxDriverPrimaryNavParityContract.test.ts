import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('approved Owner Driver primary navigation', () => {
  const shell = read('app/components/workspace/TopWorkspaceShell.tsx');
  const roles = read('lib/workspaceRole.ts');
  const directory = read('app/driver/directory/page.tsx');
  const diary = read('app/driver/history/page.tsx');
  const messages = read('app/driver/messages/page.tsx');

  it('uses the canonical sole-trader modules in the shared shell', () => {
    for (const label of ['Directory','Availability','Vehicle','Return Journeys','Loads','Quotes','Load Alerts','Finance / Invoices']) {
      expect(roles).toContain("label: '" + label + "'");
    }
    for (const primary of [
      "['owner-driver-dashboard-primary', 'Dashboard', '/driver']",
      "['owner-driver-loads-primary', 'Loads', '/driver/loads']",
      "['owner-driver-quotes-primary', 'Quotes', '/driver/quotes']",
      "['owner-driver-jobs-primary', 'My Jobs', '/driver/jobs']",
      "['owner-driver-diary-primary', 'Diary', '/driver/history']",
      "['owner-driver-availability-primary', 'Availability', '/driver/availability']",
      "['owner-driver-returns-primary', 'Return Journeys', '/driver/returns']",
      "['owner-driver-directory-primary', 'Directory', '/driver/directory']",
      "['owner-driver-finance-primary', 'Finance', '/driver/finance']",
    ]) expect(shell).toContain(primary);
    expect(shell).not.toContain("['owner-driver-my-fleet-primary'");
    expect(shell).not.toContain("['owner-driver-drivers-vehicles-primary'");
  });

  it('keeps Directory on the real shared member data source', () => {
    expect(directory).toContain('MemberDirectoryPage');
    expect(read('app/components/workspace/MemberDirectoryPage.tsx')).toContain('fetch(`/api/directory?');
  });

  it('keeps Diary linked to real Finance', () => {
    expect(diary).toContain("router.push('/driver/finance')");
  });

  it('keeps Messages participant-scoped', () => {
    expect(messages).toContain("fetch('/api/driver/messages'");
    expect(messages).toContain('canReply');
  });
});
