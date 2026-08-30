import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('CX-close Event Log parity across operational workspaces', () => {
  const shell = read('app/components/workspace/TopWorkspaceShell.tsx');
  const shared = read('app/components/workspace/WorkspaceEventLogPage.tsx');
  const admin = read('app/admin/event-log/page.tsx');
  const broker = read('app/broker/event-log/page.tsx');
  const customer = read('app/customer/event-log/page.tsx');

  it('keeps Event Log user-scoped and exportable', () => {
    expect(shared).toContain(".eq('recipient_user_id', userId)");
    expect(shared).toContain('Search Event Log');
    expect(shared).toContain('Download CSV');
    expect(shared).toContain('Print / Save PDF');
    expect(shared).toContain("className=\"workspace-filter-rail\"");
  });

  it('uses the same shared Event Log surface for Admin, Broker and Customer', () => {
    for (const page of [admin, broker, customer]) expect(page).toContain('WorkspaceEventLogPage');
  });

  it('surfaces role-scoped Event Log routes without adding a platform-owner route', () => {
    expect(shell).toContain("company_owner: '/admin/event-log'");
    expect(shell).toContain("broker: '/broker/event-log'");
    expect(shell).toContain("customer: '/customer/event-log'");
    expect(shell).not.toContain("platform_owner: '/super-admin/event-log'");
    expect(shell).not.toContain('/super-admin/event-log');
  });

  it('surfaces the existing Carrier Directory without creating a duplicate data source', () => {
    expect(shell).toContain("const directoryHref = '/admin/marketplace/directory'");
    expect(shell).toContain("label: 'Directory'");
  });
});
