import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const createRoute = readFileSync('app/api/jobs/create/route.ts', 'utf8');
const marketplaceRoute = readFileSync('app/api/driver/marketplace/loads/route.ts', 'utf8');

describe('Job locality persistence and marketplace display', () => {
  it('resolves and persists pickup/delivery post towns when a job is created', () => {
    expect(createRoute).toContain('async function resolvePostTown(postcode: string)');
    expect(createRoute).toContain('IDEAL_POSTCODES_API_KEY');
    expect(createRoute).toContain('GETADDRESS_API_KEY');
    expect(createRoute).toContain('https://api.postcodes.io/postcodes/');
    expect(createRoute).toContain('pickup_city: pickupCity');
    expect(createRoute).toContain('delivery_city: deliveryCity');
  });

  it('renders locality plus public outcode while keeping full postcodes private', () => {
    expect(marketplaceRoute).toContain('publicTownArea(job.pickup_city');
    expect(marketplaceRoute).toContain('publicTownArea(job.delivery_city');
    expect(marketplaceRoute).toContain('pickup_postcode_full: null');
    expect(marketplaceRoute).toContain('delivery_postcode_full: null');
  });
});