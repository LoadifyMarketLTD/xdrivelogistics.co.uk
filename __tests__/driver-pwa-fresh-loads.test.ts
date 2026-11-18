import { describe, expect, it } from 'vitest';
import { filterMarketplaceLoads, type LoadFilters, type MarketplaceLoad } from '../app/driver-pwa-fresh/jobs/loadFilters';

const now = Date.parse('2026-10-27T06:00:00Z');
const base: MarketplaceLoad = {
  id: 'a', status: 'posted', pickup_area: 'Blackburn', pickup_postcode_area: 'BB1',
  delivery_area: 'Erith', delivery_postcode_area: 'DA8',
  pickup_datetime: '2026-10-27T06:30:00Z', distance_to_pickup_miles: 8, distance_to_delivery_miles: 25,
  vehicle_type: 'Luton Van', requested_vehicle_label: 'Luton Box Van', requested_vehicle_type: 'luton',
};
const empty: LoadFilters = { from: '', to: '', vehicle: '', bodyType: '', collectWithin: '', pickupRadius: '' };
const run = (loads: MarketplaceLoad[], filters: Partial<LoadFilters> = {}) => filterMarketplaceLoads(loads, { ...empty, ...filters }, now);

describe('fresh LOADS marketplace filtering', () => {
  it('shows available posted and quoted loads', () => {
    expect(run([base, { ...base, id: 'b', status: 'quoted' }])).toHaveLength(2);
  });
  it.each(['allocated', 'accepted', 'completed', 'cancelled', 'sold', 'expired'])('hides %s loads', status => {
    expect(run([{ ...base, status }])).toHaveLength(0);
  });
  it('hides past pickups and invalid dates rather than showing expired jobs', () => {
    expect(run([{ ...base, pickup_datetime: '2026-10-27T05:59:00Z' }])).toHaveLength(0);
    expect(run([{ ...base, pickup_datetime: 'not-a-date' }])).toHaveLength(0);
  });
  it.each([15, 30, 45, 60, 90, 120])('applies collect within %i minutes', minutes => {
    expect(run([base], { collectWithin: String(minutes) })).toHaveLength(minutes >= 30 ? 1 : 0);
  });
  it('does not guess pickup distance when GPS location is missing', () => {
    expect(run([{ ...base, distance_to_pickup_miles: null }], { pickupRadius: '10' })).toHaveLength(0);
  });
  it('applies pickup radius and permits boundary distance', () => {
    expect(run([base], { pickupRadius: '5' })).toHaveLength(0);
    expect(run([base], { pickupRadius: '10' })).toHaveLength(1);
  });
  it('matches towns and outcodes case-insensitively', () => {
    expect(run([base], { from: ' bb1 ', to: 'da8' })).toHaveLength(1);
    expect(run([base], { from: 'London' })).toHaveLength(0);
  });
  it('matches vehicle and body type across available labels', () => {
    expect(run([base], { vehicle: 'luton', bodyType: 'box' })).toHaveLength(1);
    expect(run([base], { bodyType: 'curtain' })).toHaveLength(0);
  });
  it('filters destination radius using server-provided distance', () => {
    expect(run([base], { destinationRadius: '10' })).toHaveLength(0);
    expect(run([base], { destinationRadius: '25' })).toHaveLength(1);
  });
  it('does not invent destination distance when missing', () => {
    expect(run([{ ...base, distance_to_delivery_miles: null }], { destinationRadius: '50' })).toHaveLength(0);
  });
  it('requires a dated pickup when collect-within is selected', () => {
    expect(run([{ ...base, pickup_datetime: null }], { collectWithin: '60' })).toHaveLength(0);
  });
});
