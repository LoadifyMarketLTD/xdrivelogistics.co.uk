import fs from 'node:fs';
import path from 'node:path';

describe('CX vs XDrive driver load board contract', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'app/api/driver/marketplace/loads/route.ts'),
    'utf8',
  );

  it('does not treat missing visibility as public Exchange visibility', () => {
    expect(source).toContain("if (visibility === 'exchange') return true");
    expect(source).toContain("if (visibility !== 'direct') return false");
    expect(source).not.toContain("if (!visibility || visibility === 'exchange') return true");
  });

  it('filters expired exchange posts before returning list or detail', () => {
    expect(source).toContain('function exchangePostActive');
    expect(source).toContain('exchange_expires_at');
    expect(source).toContain('if (!exchangePostActive(job)) return false');
  });

  it('shows the active quote at carrier-company level when a company context exists', () => {
    expect(source).toContain("bidQuery.eq('company_id', driver.companyId)");
    expect(source).toContain("bidQuery.eq('bidder_user_id', driver.userId)");
  });

  it('keeps exact pickup and delivery coordinates out of the pre-award response', () => {
    expect(source).toContain("pickup_area: publicAreaLabel(job.pickup_postcode");
    expect(source).toContain("delivery_area: publicAreaLabel(job.delivery_postcode");
    expect(source).not.toContain('pickup_lat:');
    expect(source).not.toContain('pickup_lng:');
    expect(source).not.toContain('delivery_lat:');
    expect(source).not.toContain('delivery_lng:');
  });
});
