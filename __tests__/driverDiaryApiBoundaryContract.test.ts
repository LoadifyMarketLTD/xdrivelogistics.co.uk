import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('driver Diary API authorization boundary contract', () => {
  const companyNames = read('app/api/driver/diary/company-names/route.ts');
  const cancellation = read('app/api/driver/jobs/[jobId]/cancellation/route.ts');
  const invoice = read('app/api/driver/finance/jobs/[jobId]/generate-invoice/route.ts');
  const sheet = read('app/api/driver/jobs/[jobId]/sheet/route.ts');

  it('uses the same Driver Web app-access boundary on all Diary service-role APIs', () => {
    for (const source of [companyNames, cancellation, invoice, sheet]) {
      expect(source).toContain('requireActiveWebDriver(request)');
      expect(source).toContain('isWebDriverContext');
    }
  });

  it('keeps Diary service-role reads scoped to the authenticated driver or company relationship', () => {
    expect(companyNames).toContain(".eq('assigned_driver_id', driver.driverId)");
    expect(sheet).toContain(".eq('assigned_driver_id', driver.driverId)");
    expect(cancellation).toContain('p_actor_user_id: driver.userId');
    expect(invoice).toContain(".eq('user_id', driver.userId)");
  });
});
