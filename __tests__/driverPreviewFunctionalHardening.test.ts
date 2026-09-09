import fs from 'node:fs';
import path from 'node:path';

describe('driver preview functional hardening', () => {
  const nearby = fs.readFileSync(path.join(process.cwd(), 'app/api/driver/mobile/nearby-jobs/route.ts'), 'utf8');
  const eligibility = fs.readFileSync(path.join(process.cwd(), 'app/api/driver/_lib/bidEligibility.ts'), 'utf8');
  const resources = fs.readFileSync(path.join(process.cwd(), 'app/api/driver/mobile/resources/route.ts'), 'utf8');
  const mobileLib = fs.readFileSync(path.join(process.cwd(), 'app/api/driver/mobile/_lib.ts'), 'utf8');
  const deviceGate = fs.readFileSync(path.join(process.cwd(), 'app/api/driver/mobile/_deviceSessionGate.ts'), 'utf8');
  const deviceSession = fs.readFileSync(path.join(process.cwd(), 'app/api/driver/mobile/device-session/route.ts'), 'utf8');

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

  it('exposes vehicle-specific quote readiness without a company-wide CPC gate', () => {
    expect(resources).toContain('resolveDriverOperationalEligibility');
    expect(resources).not.toContain('company_compliance_issues');
    expect(resources).toContain('quoteReadiness,');
  });

  it('only accepts canonical compliance document uploads', () => {
    expect(resources).toContain("new Set(['drivinglicence', 'cpccard', 'insurance'])");
    expect(resources).toContain('Unsupported driver compliance document type.');
    expect(resources).toContain("storage.from('driver-docs').upload");
    expect(resources).toContain("status: 'pending'");
  });

  it('allows explicit RC aliases only through the staging preview device policy', () => {
    for (const source of [mobileLib, deviceGate, deviceSession]) {
      expect(source).toContain('driver-rc\\d+');
      expect(source).toContain("process.env.APP_ENV !== 'staging'");
    }
    expect(mobileLib).toContain("process.env.XDRIVE_HOSTED_PREVIEW_DEVICE_BYPASS !== 'true'");
    expect(deviceSession).toContain("process.env.XDRIVE_HOSTED_PREVIEW_DEVICE_BYPASS === 'true'");
    expect(mobileLib).toContain('process.env.CONTEXT');
    expect(deviceGate).toContain('process.env.CONTEXT');
    expect(deviceSession).toContain('process.env.CONTEXT');
  });
  it('uses canonical current status before revealing quote job private details', () => {
    expect(resources).toContain("row.current_status ?? row.status ?? ''");
    expect(resources).toContain("includes(canonicalStatus)");
    expect(resources).toContain("can_update_lifecycle: privateDetailsRevealed");
  });
});
