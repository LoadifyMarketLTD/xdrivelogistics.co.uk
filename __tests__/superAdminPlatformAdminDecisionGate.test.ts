import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

describe('SA-11 Platform Administrator decision gate', () => {
  it('keeps the legacy Platform Admins route as a compatibility redirect to canonical Platform Owner authority', () => {
    const page = readRepoFile('app/super-admin/users/platform-admins/page.tsx');

    expect(page).toContain("redirect('/super-admin/users/roles/platform_owner')");
    expect(page).toContain('does not currently have a delegated Platform Administrator lifecycle');
    expect(page).not.toContain('Manage platform role assignments');
    expect(page).not.toContain('grant');
    expect(page).not.toContain('revoke');
  });

  it('does not present Roles & Permissions as a mutation surface without a canonical grant lifecycle', () => {
    const page = readRepoFile('app/super-admin/settings/roles-permissions/page.tsx');

    expect(page).toContain('Read-only canonical workspace definitions and real authority coverage.');
    expect(page).toContain('no generic assignment controls');
    expect(page).toContain('>Inspect</button>');
    expect(page).not.toContain('>Manage</button>');
  });

  it('sources real role counts from the canonical authority directory and preserves unavailable state', () => {
    const page = readRepoFile('app/super-admin/settings/roles-permissions/page.tsx');

    expect(page).toContain("fetch('/api/super-admin/users/canonical?limit=1'");
    expect(page).toContain('active / ${total ?? 0} total');
    expect(page).toContain('User counts remain unavailable rather than being replaced by zero.');
  });

  it('keeps Platform Owner authority isolated from company workspace grants', () => {
    const route = readRepoFile('app/api/super-admin/users/canonical/route.ts');

    expect(route).toContain("if (normalizedWorkspace === 'platform')");
    expect(route).toContain("Platform Owner authority is sourced only from profiles.role=owner.");
    expect(route).not.toContain("platform: 'platform_owner'");
  });
});
