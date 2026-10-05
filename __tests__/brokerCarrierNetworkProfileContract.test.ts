import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(process.cwd(), 'app/broker/carrier-network/BrokerCarrierNetworkPage.tsx'), 'utf8');

describe('Broker Carrier Network verified profile contract', () => {
  it('routes accepted carrier relationships to the real member profile data', () => {
    expect(source).toContain('Open profile / feedback');
    expect(source).toContain('Open verified member profile');
    expect(source).toContain('Open specialist services');
    expect(source).toContain('Open authorised business documents');
    expect(source).toContain('Open verified feedback');
    expect(source).toContain('MemberIdentityLink companyId={row.carrier_company_id}');
  });

  it('does not claim verified feedback is unavailable when Member Profile exposes it', () => {
    expect(source).not.toContain('Verified member-performance dataset not exposed here.');
    expect(source).not.toContain('Use Member Profile / Directory where verified');
  });
});
