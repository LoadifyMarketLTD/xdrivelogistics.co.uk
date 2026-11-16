import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const route=readFileSync('app/api/booking-offers/route.ts','utf8');

describe('Driver booking-offer API consistency',()=>{
  it('fails closed if linked job, buyer or quotation lookup fails',()=>{
    expect(route).toContain('error: jobsError');
    expect(route).toContain('error: buyersError');
    expect(route).toContain('error: bidsError');
    expect(route).toContain('if (jobsError || buyersError || bidsError) return json(503');
    expect(route).toContain('Some booking quotations could not be resolved.');
  });
  it('never presents an orphaned booking offer as an empty legitimate job',()=>{
    expect(route).toContain('jobIds.some((id) => !jobById.has(id))');
    expect(route).toContain('Some booking jobs could not be resolved.');
  });
  it('retains explicit pre-acceptance privacy projection',()=>{
    expect(route).toContain('bookingOfferVisibleJob(job, String(offer.status))');
    expect(route).toContain('publicQuoteNotes(job?.load_details)');
  });
});
