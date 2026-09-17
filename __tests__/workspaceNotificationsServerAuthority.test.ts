import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');

describe('workspace notification server authority', () => {
  it('keeps Customer, Broker and Admin notification mutations out of the browser', () => {
    const inbox = read('app/components/workspace/WorkspaceNotificationInbox.tsx');
    const route = read('app/api/workspace/notifications/route.ts');
    const itemRoute = read('app/api/workspace/notifications/[id]/route.ts');

    expect(inbox).toContain('/api/workspace/notifications');
    expect(inbox).not.toContain(".from('notifications')");
    expect(route).toContain(".eq('user_id', user.id)");
    expect(itemRoute).toContain(".eq('user_id', user.id)");
    expect(itemRoute).toContain('.delete()');
  });
});
