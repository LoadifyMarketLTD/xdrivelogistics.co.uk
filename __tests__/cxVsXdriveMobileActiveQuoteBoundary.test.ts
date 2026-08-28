import fs from 'node:fs';
import path from 'node:path';

describe('CX vs XDrive mobile active quote boundary', () => {
  const route = fs.readFileSync(
    path.join(process.cwd(), 'app/api/driver/mobile/bids/route.ts'),
    'utf8',
  );
  const client = fs.readFileSync(
    path.join(process.cwd(), 'apps/driver-mobile/src/api/liveLoads.ts'),
    'utf8',
  );

  it('returns only active company job ids for duplicate-quote suppression', () => {
    expect(route).toContain("scope === 'active-company'");
    expect(route).toContain(".in('status', ['submitted', 'accepted'])");
    expect(route).toContain("await query.eq('company_id', driver.companyId)");
    expect(route).toContain('activeJobIds:');
  });

  it('keeps the detailed mobile bid history personal to the named driver', () => {
    expect(route).toContain('Driver mobile is the named driver\'s personal quote history');
    expect(route).toContain('bidder_user_id.eq.${driver.userId}');
    expect(route).toContain('bidder_driver_id.eq.${driver.driverId}');
  });

  it('does not query job_bids directly from the Expo live-load client', () => {
    expect(client).toContain('/api/driver/mobile/bids?scope=active-company');
    expect(client).not.toContain(".from('job_bids')");
    expect(client).not.toContain(".eq('bidder_user_id'");
  });
});
