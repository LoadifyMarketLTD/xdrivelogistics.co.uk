import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.join(process.cwd(), 'app/api/jobs/create/route.ts'),
  'utf8',
);

describe('jobs create broker posting authorization', () => {
  it('keeps owner admin and dispatcher company posting access', () => {
    expect(source).toContain("['owner', 'admin', 'dispatcher'].includes(membershipRole)");
  });

  it('allows member posting only for an active broker profile in the same company', () => {
    expect(source).toContain("input.mode === 'broker' && membershipRole === 'member'");
    expect(source).toContain("String(brokerProfile?.role ?? '').trim().toLowerCase() === 'broker'");
    expect(source).toContain("String(brokerProfile?.status ?? '').trim().toLowerCase() === 'active'");
    expect(source).toContain("String(brokerProfile?.company_id ?? '') === input.companyId");
  });

  it('does not globally whitelist member memberships', () => {
    expect(source).not.toContain(".in('role_in_company', ['owner', 'admin', 'dispatcher', 'member'])");
  });
});
