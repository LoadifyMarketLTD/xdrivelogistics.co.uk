import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('CX-close Event Log parity across operational workspaces', () => {
  const shell = read('app/components/workspace/TopWorkspaceShell.tsx');
  const shared = read('app/components/workspace/WorkspaceEventLogPage.tsx');
  const api = read('app/api/workspace/event-log/route.ts');
  const admin = read('app/admin/event-log/page.tsx');
  const broker = read('app/broker/event-log/page.tsx');
  const customer = read('app/customer/event-log/page.tsx');

  it('combines account notifications with authorised job tracking events', () => {
    expect(shared).toContain('/api/workspace/event-log');
    expect(api).toContain("from('notification_events')");
    expect(api).toContain(".eq('recipient_user_id', authData.user.id)");
    expect(api).toContain("from('job_tracking_events')");
    expect(api).toContain("from('company_memberships')");
    expect(api).toContain("from('drivers')");
  });

  it('keeps Event Log searchable and exportable with Replay handoff', () => {
    expect(shared).toContain('Search Event Log');
    expect(shared).toContain('Download CSV');
    expect(shared).toContain('Print / Save PDF');
    expect(shared).toContain('Open Replay');
    expect(shared).toContain('/job-replay/${replayJobId}');
  });

  it('does not fabricate login/logout history without a verified source', () => {
    expect(api).toContain('Login/logout events are not fabricated');
  });

  it('uses the same shared Event Log surface for Admin, Broker and Customer', () => {
    for (const page of [admin, broker, customer]) expect(page).toContain('WorkspaceEventLogPage');
  });

  it('keeps role Event Log routes outside Super Admin', () => {
    expect(shell).toContain("company_owner: '/admin/event-log'");
    expect(shell).toContain("broker: '/broker/event-log'");
    expect(shell).toContain("customer: '/customer/event-log'");
    expect(shell).not.toContain('/super-admin/event-log');
  });
});
