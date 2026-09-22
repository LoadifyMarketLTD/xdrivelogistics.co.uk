import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('CX-style driver distance presentation contract', () => {
  const mobileLoads = read('app/api/driver/mobile/nearby-jobs/route.ts');
  const webLoads = read('app/api/driver/marketplace/loads/route.ts');
  const assignedJobs = read('app/api/driver/jobs/route.ts');
  const loadBoard = read('app/driver/loads/page.tsx');
  const loadDetail = read('app/driver/loads/[id]/page.tsx');
  const quotes = read('app/driver/quotes/page.tsx');
  const wonWork = read('app/driver/won-work/page.tsx');
  const dashboard = read('app/driver/page.tsx');

  it('keeps driver-to-collection distance and ETA dynamic', () => {
    expect(mobileLoads).toContain('distanceToPickupMiles: routed?.distanceMiles');
    expect(mobileLoads).toContain('pickupEtaMinutes: routed?.durationMinutes');
    expect(webLoads).toContain('distance_to_pickup_miles: distanceToPickupMiles');
    expect(webLoads).toContain('pickup_eta_minutes: pickupEtaMinutes');
    expect(assignedJobs).toContain('distanceToPickupMiles: pickupMetrics.get(row.id)?.distanceMiles');
    expect(assignedJobs).toContain('pickupEtaMinutes: pickupMetrics.get(row.id)?.durationMinutes');
  });

  it('keeps collection-to-delivery route metrics on the job', () => {
    expect(mobileLoads).toContain('journeyDistanceMiles: marketplaceNumber(row.job_distance_miles)');
    expect(mobileLoads).toContain('estimatedJourneyMinutes: marketplaceNumber(row.job_distance_minutes)');
    expect(webLoads).toContain('distance_miles: marketplaceNumber(job.job_distance_miles');
    expect(webLoads).toContain('distance_minutes: marketplaceNumber(job.job_distance_minutes)');
    expect(assignedJobs).toContain('jobDistanceMiles: Number(row.job_distance_miles');
    expect(assignedJobs).toContain('jobDistanceMinutes: Number(row.job_distance_minutes');
  });

  it('labels the two metrics separately throughout the driver UI', () => {
    for (const source of [loadBoard, loadDetail, quotes, wonWork, dashboard]) {
      expect(source).toContain('To Collection');
      expect(source).toContain('Job Distance');
    }
  });

  it('does not collapse the two concepts back into a generic Distance label on load detail', () => {
    expect(loadDetail).not.toContain('<span>Distance</span>');
  });
});
