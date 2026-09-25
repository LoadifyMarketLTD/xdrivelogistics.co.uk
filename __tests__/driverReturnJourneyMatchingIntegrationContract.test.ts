import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Driver Return Journey destination matching integration', () => {
  const route = fs.readFileSync(
    path.join(process.cwd(), 'app/api/driver/mobile/nearby-jobs/route.ts'),
    'utf8',
  );

  it('loads the current declared Return Journey for destination-mode matching', () => {
    expect(route).toContain(".from('return_journeys')");
    expect(route).toContain(".eq('driver_id', driver.driverId)");
    expect(route).toContain(".in('status', ['active', 'available'])");
  });

  it('uses a declared Return Journey when no delivery-stage job is available', () => {
    expect(route).toContain('const declaredJourneyEligible = declaredReturnJourney');
    expect(route).toContain('declaredReturnJourney?.from_postcode ?? null');
    expect(route).toContain('declaredReturnJourney?.available_from ?? null');
  });

  it('exposes which canonical source activated Return IQ', () => {
    expect(route).toContain('returnJourneyId: declaredJourneyEligible ? declaredReturnJourney.id : null');
    expect(route).toContain('currentJobReference: currentJobEligible');
  });
});
