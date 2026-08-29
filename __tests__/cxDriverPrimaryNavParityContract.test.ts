import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('CX-close Driver primary navigation parity', () => {
  const shell = read('app/driver/_components/DriverTopWorkspaceShell.tsx');
  const directory = read('app/driver/directory/page.tsx');
  const diary = read('app/driver/history/page.tsx');
  const eventLog = read('app/driver/event-log/page.tsx');

  it('surfaces Directory and Event Log as first-class Driver navigation without hiding them under Account', () => {
    expect(shell).toContain("label: 'Directory', href: '/driver/directory'");
    expect(shell).toContain("label: 'Event Log', href: '/driver/event-log'");
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

  it('keeps Event Log as a searchable and exportable operational register', () => {
    expect(eventLog).toContain('Search Event Log');
    expect(eventLog).toContain('Download CSV');
    expect(eventLog).toContain('Print / Save PDF');
  });
});
