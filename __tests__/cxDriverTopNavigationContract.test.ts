import fs from 'node:fs';
import path from 'node:path';

const shell = fs.readFileSync(path.join(process.cwd(), 'app/driver/_components/DriverTopWorkspaceShell.tsx'), 'utf8');
const css = fs.readFileSync(path.join(process.cwd(), 'app/driver/driver-top-shell-more.css'), 'utf8');

describe('CX-close Driver top navigation', () => {
  it('keeps the CX-style primary modules visible and moves secondary tools under More', () => {
    for (const label of ['Dashboard', 'Directory', 'Return Journeys', 'Loads', 'Quotes', 'Diary', 'Event Log']) {
      expect(shell).toContain(`label: '${label}'`);
    }
    expect(shell).toContain('DRIVER_MORE_NAV');
    for (const label of ['Jobs', 'Availability', 'Messages', 'Vehicle', 'Documents', 'Invoices', 'Notifications', 'Account']) {
      expect(shell).toContain(`label: '${label}'`);
    }
    expect(shell).toContain(`label: "Who's Nearby?"`);
    expect(shell).toContain('More <span');
  });

  it('keeps each promoted More item on an existing Driver route', () => {
    for (const href of ['/driver/jobs', '/driver/availability', '/driver/nearby', '/driver/messages', '/driver/vehicles', '/driver/documents', '/driver/finance', '/driver/notifications', '/driver/account']) {
      expect(shell).toContain(`href: '${href}'`);
    }
  });

  it('counts unread recipient inbox rows rather than notification delivery failures', () => {
    expect(shell).toContain(".from('notifications')");
    expect(shell).toContain(".eq('user_id', user.id)");
    expect(shell).toContain(".is('read_at', null)");
    expect(shell).not.toContain(".from('notification_events')");
  });

  it('keeps the More menu dense and consistent with the workspace shell', () => {
    expect(css).toContain('min-height: 32px');
    expect(css).toContain('border-radius: 4px');
    expect(css).toContain('font-size: 12px');
  });

  it('does not introduce Super Admin coupling', () => {
    expect(shell).not.toContain('/super-admin');
  });
});
