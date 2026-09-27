import fs from 'node:fs';
import path from 'node:path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

describe('Customer/Broker mutation authority contract', () => {
  it('keeps Customer quote rejection on owner/admin/dispatcher authority', () => {
    const source = read('app/api/customer/bids/[id]/reject/route.ts');
    expect(source).toContain(".in('role_in_company', ['owner', 'admin', 'dispatcher'])");
    expect(source).not.toContain('const isCreator = job.created_by === user.id');
  });

  it('allows Customer dispute reads to active members but restricts dispute creation', () => {
    const source = read('app/api/customer/disputes/route.ts');
    expect(source).toContain("membershipRole: String(membership.role_in_company ?? '').toLowerCase()");
    expect(source).toContain("!['owner', 'admin', 'dispatcher'].includes(context.membershipRole)");
  });

  it('restricts Broker dispute mutation to owner/admin', () => {
    const listRoute = read('app/api/broker/disputes/route.ts');
    const itemRoute = read('app/api/broker/disputes/[id]/route.ts');
    expect(listRoute).toContain(".in('role_in_company', ['owner', 'admin'])");
    expect(itemRoute).toContain("const managerRoles = ['owner', 'admin'");
  });

  it('restricts Broker POD review mutation to owner/admin/dispatcher', () => {
    const listRoute = read('app/api/broker/pod-review/route.ts');
    const itemRoute = read('app/api/broker/pod-review/[jobId]/route.ts');
    expect(listRoute).toContain(".in('role_in_company', ['owner', 'admin', 'dispatcher'])");
    expect(itemRoute).toContain(".in('role_in_company', ['owner', 'admin', 'dispatcher'])");
  });
});
