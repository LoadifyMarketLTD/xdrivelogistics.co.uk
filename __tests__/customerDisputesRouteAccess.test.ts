import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const roles = readFileSync(join(process.cwd(), 'lib/workspaceRole.ts'), 'utf8');
const access = readFileSync(join(process.cwd(), 'lib/roleCapabilities.ts'), 'utf8');

describe('customer disputes route access', () => {
  it('keeps navigation and middleware authorization aligned', () => {
    expect(roles).toContain("href: '/customer/disputes'");
    expect(access).toContain("{ prefix: '/customer/disputes', workspace: 'shipper', anyOf: ['jobs.view'] }");
  });
});
