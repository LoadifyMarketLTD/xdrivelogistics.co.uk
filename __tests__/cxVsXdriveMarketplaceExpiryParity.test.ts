import fs from 'node:fs';
import path from 'node:path';

describe('CX vs XDrive Marketplace expiry parity', () => {
  const files = {
    mobile: fs.readFileSync(path.join(process.cwd(), 'app/api/driver/mobile/nearby-jobs/route.ts'), 'utf8'),
    driverSearch: fs.readFileSync(path.join(process.cwd(), 'app/api/driver/search-loads/route.ts'), 'utf8'),
    driverBoard: fs.readFileSync(path.join(process.cwd(), 'app/api/driver/marketplace/loads/route.ts'), 'utf8'),
    company: fs.readFileSync(path.join(process.cwd(), 'app/api/marketplace/company/route.ts'), 'utf8'),
  };

  it('includes exchange expiry in every pre-award load surface', () => {
    for (const source of Object.values(files)) {
      expect(source).toContain('exchange_expires_at');
    }
  });

  it('filters expired postings before returning marketplace results', () => {
    expect(files.mobile).toContain('exchangePostActive(row)');
    expect(files.driverSearch).toContain('exchangePostActive(row)');
    expect(files.driverBoard).toContain('exchangePostActive(job)');
    expect(files.company).toContain('exchangePostActive(row.exchange_expires_at)');
  });

  it('refuses a new company quote after the posting has expired', () => {
    expect(files.company).toContain(".select('id, company_id, status, exchange_visibility, exchange_expires_at, direct_invite_company_id, awarded_carrier_company_id, currency')");
    expect(files.company).toContain('if (!exchangePostActive(job.exchange_expires_at))');
    expect(files.company).toContain('This load posting has expired and is no longer open for quotes.');
  });
});
