import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('CX-close Driver primary navigation parity', () => {
  const shell = read('app/driver/_components/DriverTopWorkspaceShell.tsx');
  const directory = read('app/driver/directory/page.tsx');
  const diary = read('app/driver/history/page.tsx');
  const eventLog = read('app/driver/event-log/page.tsx');
  const messages = read('app/driver/messages/page.tsx');
  const sharedEventLog = read('app/components/workspace/WorkspaceEventLogPage.tsx');

  it('surfaces Directory, Messages and Event Log as first-class Driver navigation without hiding them under Account', () => {
    expect(shell).toContain("label: 'Directory', href: '/driver/directory'");
    expect(shell).toContain("label: 'Messages', href: '/driver/messages'");
    expect(shell).toContain("label: 'Event Log', href: '/driver/event-log'");
    expect(shell).not.toMatch(/ACCOUNT_PREFIXES[\s\S]*?'\/driver\/messages'/);
    expect(shell).not.toMatch(/ACCOUNT_PREFIXES[\s\S]*?'\/driver\/event-log'/);
  });

  it('keeps the canonical Directory on the privacy-scoped shared member directory contract', () => {
    expect(directory).toContain('MemberDirectoryPage');
    expect(directory).toContain('Search the authenticated XDrive member network');
  });

  it('keeps Diary linked to the existing Payment Report instead of duplicating finance logic', () => {
    expect(diary).toContain("router.push('/driver/finance')");
    expect(diary).toContain('Payment Report');
  });

  it('keeps Driver Messages participant-scoped rather than fabricating arbitrary contacts', () => {
    expect(messages).toContain("fetch('/api/driver/messages'");
    expect(messages).toContain('Existing participant conversations');
    expect(messages).toContain('canReply');
  });

  it('keeps Driver Event Log on the shared searchable and exportable operational register', () => {
    expect(eventLog).toContain('WorkspaceEventLogPage');
    expect(sharedEventLog).toContain('Search Event Log');
    expect(sharedEventLog).toContain('Download CSV');
    expect(sharedEventLog).toContain('Print / Save PDF');
    expect(sharedEventLog).toContain(".eq('recipient_user_id', userId)");
  });
});
