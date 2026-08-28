import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..');
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('driver tracking tenant isolation contract', () => {
  it('fails closed when an awarded job is not bound to the driver company', () => {
    const trackingState = read('app/api/driver/tracking-state/route.ts');
    const location = read('app/api/driver/location/route.ts');

    expect(trackingState).toContain(
      'job.awarded_carrier_company_id && job.awarded_carrier_company_id !== driver.companyId',
    );
    expect(location).toContain(
      'jobRow.awarded_carrier_company_id && jobRow.awarded_carrier_company_id !== driverRow.company_id',
    );

    expect(trackingState).not.toContain(
      'job.awarded_carrier_company_id && driver.companyId && job.awarded_carrier_company_id !== driver.companyId',
    );
    expect(location).not.toContain(
      'jobRow.awarded_carrier_company_id && driverRow.company_id && jobRow.awarded_carrier_company_id !== driverRow.company_id',
    );
  });

  it('stops operational tracking before clearing account-scoped data on session loss', () => {
    const sessionLoss = read('apps/driver-mobile/src/auth/sessionLoss.ts');
    const stopTrackingIndex = sessionLoss.indexOf('stopOperationalTracking');
    const clearQueueIndex = sessionLoss.indexOf('clearQueue(previousUserId)');

    expect(stopTrackingIndex).toBeGreaterThan(-1);
    expect(clearQueueIndex).toBeGreaterThan(stopTrackingIndex);
    expect(sessionLoss).toContain('if (!previousUserId) return;');
  });
});
