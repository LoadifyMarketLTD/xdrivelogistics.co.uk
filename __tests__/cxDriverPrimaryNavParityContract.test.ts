import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('approved prototype Driver primary navigation', () => {
  const shell = read('app/components/workspace/TopWorkspaceShell.tsx');
  const roles = read('lib/workspaceRole.ts');
  const directory = read('app/driver/directory/page.tsx');
  const diary = read('app/driver/history/page.tsx');
  const messages = read('app/driver/messages/page.tsx');

  it('uses the canonical Owner Driver modules in the shared shell', () => {
    for (const label of ['Directory','Availability','Vehicle','Return Journeys','Loads','Quotes','Auto-match & Alerts','Diary','Freight Vision','Invoices','Drivers & Staff']) {
      expect(roles).toContain(`label: '${label}'`);
    }
    for (const primary of [
      "['owner-driver-dashboard-primary', 'Dashboard', '/driver']",
      "['owner-driver-directory-primary', 'Directory', '/driver/directory']",
      "['owner-driver-returns-primary', 'Return Journeys', '/driver/returns']",
      "['owner-driver-loads-primary', 'Loads', '/driver/loads']",
      "['owner-driver-quotes-primary', 'Quotes', '/driver/quotes']",
      "['owner-driver-diary-primary', 'Diary', '/driver/history']",
      "['owner-driver-event-log-primary', 'Event Log', '/driver/event-log']",
    ]) expect(shell).toContain(primary);
  });

  it('keeps Directory on the real shared member data source', () => {
    expect(directory).toContain('MemberDirectoryPage');
    expect(read('app/components/workspace/MemberDirectoryPage.tsx')).toContain("fetch(`/api/directory?");
  });

  it('keeps Diary linked to real Finance', () => {
    expect(diary).toContain("router.push('/driver/finance')");
    expect(diary).toContain('Payment Report');
  });

  it('keeps Messages participant-scoped', () => {
    expect(messages).toContain("fetch('/api/driver/messages'");
    expect(messages).toContain('canReply');
  });
});
