import { describe, expect, it } from 'vitest';
import { bookingOfferVisibleJob } from '../app/api/_lib/bookingOfferPublicProjection';

const example = {
  id: 'j1',
  pickup_location: 'Unit 15, Secret Park, Manchester',
  pickup_city: 'Manchester',
  pickup_postcode: 'M17 1WH',
  delivery_location: 'Private loading bay 5',
  delivery_city: 'Oldham',
  delivery_postcode: 'OL4 3DZ',
  pickup_datetime: '2026-11-10T08:00:00Z',
  delivery_datetime: '2026-11-10T09:00:00Z',
  pickup_lat: 53.1,
  pickup_lng: -2.2,
  delivery_lat: 53.2,
  delivery_lng: -2.0,
  payment_terms: '14 days',
  load_id: 'XDL-TEST',
  load_ref: 'private-load-ref',
  load_reference: 'private-ref',
  customer_reference: 'internal-ref',
  booking_reference: 'confidential-booking',
  load_details: 'Call private phone 07123456789',
  telephone: '07123456789',
  vehicle_type: 'luton_tail_lift',
  requested_vehicle_label: 'Luton Tail Lift',
  job_distance_miles: 12.2,
  job_distance_minutes: 26,
};

describe('real booking offer recipient privacy projection', () => {
  it.each(['pending','declined','expired','cancelled'])('never leaks private details at %s', (state) => {
    const job = bookingOfferVisibleJob(example, state)!;
    const serialized = JSON.stringify(job);
    expect(job.pickup_postcode).toBe('M17');
    expect(job.delivery_postcode).toBe('OL4');
    expect(job.pickup_location).toBe('Manchester');
    expect(job.delivery_location).toBe('Oldham');
    expect(job.pickup_lat).toBeNull();
    expect(job.delivery_lng).toBeNull();
    for (const secret of ['Secret Park','Private loading','M17 1WH','OL4 3DZ','07123456789','private-ref','confidential-booking','internal-ref']) {
      expect(serialized).not.toContain(secret);
    }
  });
  it('unlocks the full referenced job only once accepted', () => {
    expect(bookingOfferVisibleJob(example,'accepted')).toEqual(example);
  });
  it('preserves missing job as null', () => {
    expect(bookingOfferVisibleJob(null,'pending')).toBeNull();
  });
});
