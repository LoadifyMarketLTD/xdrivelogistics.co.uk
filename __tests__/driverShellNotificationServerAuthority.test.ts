import fs from 'node:fs';
import path from 'node:path';

describe('Driver shell notification badge server authority', () => {
  const shell = fs.readFileSync(path.join(process.cwd(), 'app/driver/_components/DriverTopWorkspaceShell.tsx'), 'utf8');

  it('loads unread state through the authorised Driver notifications API', () => {
    expect(shell).toContain("fetch('/api/driver/notifications'");
    expect(shell).toContain('supabase.auth.getSession()');
    expect(shell).not.toContain(".from('notifications')");
    expect(shell).toContain('filter((notification) => !notification.read_at).length');
  });
});
