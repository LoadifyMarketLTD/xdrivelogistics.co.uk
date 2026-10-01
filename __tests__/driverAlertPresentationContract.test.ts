import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('Driver alert presentation API contract', () => {
  const nearby = read('app/api/driver/mobile/nearby-jobs/route.ts');
  const loads = read('app/api/driver/marketplace/loads/route.ts');

  it('exposes full postcodes and alert timing context to the native Alerts client', () => {
    expect(nearby).toContain('fullPostcode: fullDisplayPostcode(row.pickup_postcode)');
    expect(nearby).toContain('fullPostcode: fullDisplayPostcode(row.delivery_postcode)');
    expect(nearby).toContain('collectionTo: row.collection_window_end || null');
    expect(nearby).toContain('postedAt: row.exchange_posted_at || null');
    expect(nearby).toContain('directDeliveryRequired: row.direct_delivery_required === true');
  });

  it('keeps full postcode and collection window fields in verified load detail', () => {
    expect(loads).toContain('pickup_postcode_full: marketplaceText(job.pickup_postcode)');
    expect(loads).toContain('delivery_postcode_full: marketplaceText(job.delivery_postcode)');
    expect(loads).toContain('collection_window_end: marketplaceText(job.collection_window_end)');
    expect(loads).toContain('direct_delivery_required: job.direct_delivery_required === true');
  });

  it('uses fresh driver or availability GPS for driver-to-pickup metrics instead of company-home fallback', () => {
    expect(nearby).toContain(".from('driver_availability_presence')");
    expect(loads).toContain(".from('driver_availability_presence')");
    expect(loads).toContain('const driverPosition = jobLocationFresh');
    expect(loads).not.toContain('homeCompany?.postcode');
  });
});
