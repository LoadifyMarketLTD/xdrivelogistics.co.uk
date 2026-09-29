import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const route = readFileSync(
  new URL('../app/api/workspace/action-centre/route.ts', import.meta.url),
  'utf8',
);

describe('Customer Action Centre company scope contract', () => {
  it('includes active company memberships and company-level notification events', () => {
    expect(route).toContain(".from('company_memberships')");
    expect(route).toContain(".eq('user_id', authData.user.id)");
    expect(route).toContain(".eq('status', 'active')");
    expect(route).toContain(".in('company_id', companyIds)");
    expect(route).toContain(".is('recipient_user_id', null)");
  });

  it('uses the notification entity id for contextual presentation when available', () => {
    expect(route).toContain("entity_type,entity_id,status,created_at");
    expect(route).toContain("typeof row.entity_id === 'string' ? row.entity_id");
  });
});
