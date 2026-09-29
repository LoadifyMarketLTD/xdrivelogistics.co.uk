import fs from 'node:fs';
import path from 'node:path';

describe('Driver shell notification badge server authority', () => {
  const shell = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/TopWorkspaceShell.tsx'), 'utf8');

  it('loads unread state through the authorised Driver notifications API', () => {
    expect(shell).toContain("fetch('/api/workspace/notifications?mode=count'");
    expect(shell).toContain('supabase.auth.getSession()');
    expect(shell).not.toContain(".from('notifications')");
    expect(shell).toContain('payload.unreadCount');
  });
});
