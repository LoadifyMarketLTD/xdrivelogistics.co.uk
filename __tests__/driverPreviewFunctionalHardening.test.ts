import fs from 'node:fs';
import path from 'node:path';

describe('driver preview functional hardening', () => {
  const nearby = fs.readFileSync(path.join(process.cwd(), 'app/api/driver/mobile/nearby-jobs/route.ts'), 'utf8');
  const eligibility = fs.readFileSync(path.join(process.cwd(), 'app/api/driver/_lib/bidEligibility.ts'), 'utf8');
  const resources = fs.readFileSync(path.join(process.cwd(), 'app/api/driver/mobile/resources/route.ts'), 'utf8');

  it('does not advertise expired marketplace work', () => {
    expect(nearby).toContain("'exchange_expires_at'");
    expect(nearby).toContain('isMarketplaceJobCurrent');
    expect(nearby).toContain('.filter((row) => isMarketplaceJobCurrent(row))');
    expect(nearby).toContain('expiresAt: row.exchange_expires_at');
  });

  it('fails quote eligibility when collection or exchange expiry is already past', () => {
    expect(eligibility).toContain('pickup_datetime: string | null');
    expect(eligibility).toContain('exchangeExpired(job.exchange_expires_at) || exchangeExpired(job.pickup_datetime)');
  });

  it('exposes authoritative quote readiness from operational and compliance guards', () => {
    expect(resources).toContain('resolveDriverOperationalEligibility');
    expect(resources).toContain('company_compliance_issues');
    expect(resources).toContain('quoteReadiness,');
  });
});
