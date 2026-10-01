import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('Driver alert presentation API contract', () => {
  const nearby = read('app/api/driver/mobile/nearby-jobs/route.ts');
  const loads = read('app/api/driver/marketplace/loads/route.ts');
  const assignedSheet = read('app/api/driver/jobs/[jobId]/sheet/route.ts');

  it('withholds exact postcodes from pre-award native Alerts while preserving timing context', () => {
    expect(nearby).toContain('fullPostcode: null');
    expect(nearby).not.toContain('fullPostcode: fullDisplayPostcode(row.pickup_postcode)');
    expect(nearby).not.toContain('fullPostcode: fullDisplayPostcode(row.delivery_postcode)');
    expect(nearby).toContain('collectionTo: row.collection_window_end || null');
    expect(nearby).toContain('postedAt: row.exchange_posted_at || null');
    expect(nearby).toContain('directDeliveryRequired: row.direct_delivery_required === true');
  });

  it('withholds exact postcodes from pre-award quote/load detail', () => {
    expect(loads).toContain('pickup_postcode_full: null');
    expect(loads).toContain('delivery_postcode_full: null');
    expect(loads).toContain('collection_window_end: marketplaceText(job.collection_window_end)');
    expect(loads).toContain('direct_delivery_required: job.direct_delivery_required === true');
  });

  it('reveals operational address data only through the assigned-driver job sheet', () => {
    expect(assignedSheet).toContain(".eq('assigned_driver_id', driver.driverId)");
    expect(assignedSheet).toContain('address: text(job.pickup_location)');
    expect(assignedSheet).toContain('postcode: text(job.pickup_postcode)');
    expect(assignedSheet).toContain('address: text(job.delivery_location)');
    expect(assignedSheet).toContain('postcode: text(job.delivery_postcode)');
  });

  it('uses fresh driver or availability GPS for driver-to-pickup metrics instead of company-home fallback', () => {
    expect(nearby).toContain(".from('driver_availability_presence')");
    expect(loads).toContain(".from('driver_availability_presence')");
    expect(loads).toContain('const driverPosition = jobLocationFresh');
    expect(loads).not.toContain('homeCompany?.postcode');
  });
});
