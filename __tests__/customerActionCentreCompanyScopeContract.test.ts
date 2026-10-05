import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const route = readFileSync(
  new URL('../app/api/workspace/action-centre/route.ts', import.meta.url),
  'utf8',
);

describe('Customer Action Centre authoritative company scope contract', () => {
  it('resolves role and company from authoritative profile and active membership data', () => {
    expect(route).toContain(".from('profiles')");
    expect(route).toContain(".from('company_memberships')");
    expect(route).toContain(".eq('user_id', user.id)");
    expect(route).toContain(".eq('status', 'active')");
    expect(route).toContain('resolveAuthActiveCompanySelection');
    expect(route).toContain('resolveAuthContext');
    expect(route).not.toContain('user_metadata');
  });

  it('scopes company notifications and operational data to the selected company only', () => {
    expect(route).toContain(".eq('company_id', companyId)");
    expect(route).toContain("assigned_company_id.eq.${companyId}");
    expect(route).toContain("awarded_carrier_company_id.eq.${companyId}");
    expect(route).not.toContain(".in('company_id', companyIds)");
  });

  it('uses notification entity ids for contextual presentation when available', () => {
    expect(route).toContain("entity_type,entity_id,status,created_at");
    expect(route).toContain("typeof row.entity_id === 'string' ? row.entity_id");
  });

  it('merges live operational actions with notification events', () => {
    expect(route).toContain('deriveOperationalActionCentreItems');
    expect(route).toContain("source: 'notification'");
    expect(route).toContain('persistent: false');
  });
});
