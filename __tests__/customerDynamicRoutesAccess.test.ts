import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const access = readFileSync(join(process.cwd(), 'lib/roleCapabilities.ts'), 'utf8');

describe('customer dynamic workspace routes', () => {
  it('authorises Messages without inventing a broader commercial capability', () => {
    expect(access).toContain("{ prefix: '/customer/messages', workspace: 'shipper' }");
  });
  it('authorises Event Log as customer-visible job history', () => {
    expect(access).toContain("{ prefix: '/customer/event-log', workspace: 'shipper', anyOf: ['jobs.view'] }");
  });
});
