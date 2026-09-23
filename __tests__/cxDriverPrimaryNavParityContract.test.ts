import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('approved prototype Driver primary navigation', () => {
  const shell = read('app/driver/_components/DriverTopWorkspaceShell.tsx');
  const directory = read('app/driver/directory/page.tsx');
  const diary = read('app/driver/history/page.tsx');
  const messages = read('app/driver/messages/page.tsx');

  it('uses the complete prototype first-class module order', () => {
    for (const label of ['Directory','Live Availability','My Fleet','Return Journeys','Loads','Quotes','Diary','Freight Vision','Finance','Drivers & Vehicles']) {
      expect(shell).toContain(`label: '${label}'`);
    }
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
