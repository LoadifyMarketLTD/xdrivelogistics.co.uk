import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const route = source('app/api/workspace/notifications/route.ts');
const shell = source('app/components/workspace/TopWorkspaceShell.tsx');
const inbox = source('app/components/workspace/WorkspaceNotificationInbox.tsx');

describe('workspace notification server boundary', () => {
  it('authorises every inbox operation against the bearer user', () => {
    expect(route).toContain('getBearerToken(request)');
    expect(route).toContain('validator.auth.getUser(token)');
    expect(route).toContain(".from('notifications')");
    expect(route).toContain(".eq('user_id', auth.user.id)");
    expect(route).toContain('export async function GET');
    expect(route).toContain('export async function PATCH');
    expect(route).toContain('export async function DELETE');
  });

  it('keeps direct legacy inbox reads out of shared browser UI', () => {
    expect(shell).not.toContain(".from('notifications')");
    expect(inbox).not.toContain(".from('notifications')");
    expect(shell).toContain("/api/workspace/notifications?mode=count");
    expect(inbox).toContain("/api/workspace/notifications");
  });
});
