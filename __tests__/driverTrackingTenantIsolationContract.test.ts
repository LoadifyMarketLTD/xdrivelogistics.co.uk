import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..');
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('driver tracking tenant isolation contract', () => {
  it('uses awarded carrier first and assigned company as the fleet/legacy tenant fallback', () => {
    const trackingState = read('app/api/driver/tracking-state/route.ts');
    const location = read('app/api/driver/location/route.ts');

    expect(trackingState).toContain(
      'const carrierCompanyId = job.awarded_carrier_company_id ?? job.assigned_company_id;',
    );
    expect(trackingState).toContain(
      'if (carrierCompanyId && carrierCompanyId !== driver.companyId) return false;',
    );

    expect(location).toContain(
      "assigned_company_id: string | null; awarded_carrier_company_id: string | null;",
    );
    expect(location).toContain(
      'job.awarded_carrier_company_id ?? job.assigned_company_id',
    );
    expect(location).toContain(
      'if (carrierCompanyId && carrierCompanyId !== driverRow.company_id)',
    );
    expect(location).toContain(
      'assigned_driver_id, assigned_company_id, awarded_carrier_company_id',
    );
  });

  it('keeps individual-driver jobs valid only when no carrier company is bound', () => {
    const trackingState = read('app/api/driver/tracking-state/route.ts');
    const location = read('app/api/driver/location/route.ts');

    expect(trackingState).toContain('if (carrierCompanyId && carrierCompanyId !== driver.companyId)');
    expect(location).toContain('if (carrierCompanyId && carrierCompanyId !== driverRow.company_id)');
    expect(trackingState).not.toContain('if (!carrierCompanyId) return false');
    expect(location).not.toContain('if (!carrierCompanyId)');
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
