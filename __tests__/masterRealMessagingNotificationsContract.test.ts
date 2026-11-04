import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const get = (name: string) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const master = get('app/try-xdrive-demo/components/OperationsDemo.tsx');

describe('authenticated Master Messages and Notifications', () => {
  it('routes Messages to authorised real message inboxes', () => {
    expect(master).toContain('if(authenticated && i===14)');
    expect(master).toContain("role==='Customer'?'/customer/messages':role==='Broker'?'/broker/messages':'/admin/messages'");
    for (const file of ['app/customer/messages/page.tsx','app/broker/messages/page.tsx','app/admin/messages/page.tsx']) {
      expect(get(file)).toContain('ParticipantMessagesPage');
    }
    expect(get('app/components/workspace/ParticipantMessagesPage.tsx')).toContain('/api/workspace/messages');
  });
  it('routes Notifications to real inboxes', () => {
    expect(master).toContain('if(authenticated && i===15)');
    expect(master).toContain("role==='Customer'?'/customer/notifications':role==='Broker'?'/broker/notifications':'/admin/notifications'");
    for (const file of ['app/customer/notifications/page.tsx','app/broker/notifications/page.tsx','app/admin/notifications/page.tsx']) {
      expect(get(file)).toContain('WorkspaceNotificationInbox');
    }
    expect(get('app/components/workspace/WorkspaceNotificationInbox.tsx')).toContain('/api/workspace/notifications');
  });
});
