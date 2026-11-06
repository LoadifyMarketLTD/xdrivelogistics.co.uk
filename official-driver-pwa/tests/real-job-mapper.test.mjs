import test from 'node:test';
import assert from 'node:assert/strict';
import { mapMarketplaceJob, mapAssignedJob, mapDriverSnapshot } from '../src/realJobMapper.ts';
const market = (id) => ({ id, pickup_location: 'Brighton BN1', delivery_location: 'London SW1', pickup_datetime: null, delivery_datetime: null, requested_vehicle_label: 'Luton', vehicle_type: null, weight_kg: 100, load_details: 'Pallets', posterName: 'Real Carrier' });
test('marketplace cards use public area only, never fabricate full addresses', () => {
  const card = mapMarketplaceJob(market('job-a'));
  assert.equal(card.from, 'Brighton BN1');
  assert.equal(card.status, 'OPEN');
  assert.equal(card.quote, undefined);
});
test('test fixture IDs are rejected', () => {
  assert.throws(() => mapMarketplaceJob(market('TEST-1099')));
  assert.throws(() => mapAssignedJob({ id: 'TEST-1099' }));
});
test('assigned jobs override marketplace duplicate, preserving actual agreed rate', () => {
  const cards = mapDriverSnapshot({ marketplace: [market('job-a')], bids: [], bookings: [{ id: 'job-a', pickupLocation: 'Private pickup', deliveryLocation: 'Private delivery', canonicalStatus: 'in_progress', agreedRateAmount: 180, postingCompanyName: 'Customer' }] });
  assert.equal(cards.length, 1);
  assert.equal(cards[0].status, 'ALLOCATED');
  assert.equal(cards[0].quote, 180);
});
test('driver bid status maps to quote outcome', () => {
  const cards = mapDriverSnapshot({ marketplace: [market('job-b')], bookings: [], bids: [{ id: 'bid-a', jobId: 'job-b', amount: 75, status: 'rejected', message: '' }] });
  assert.equal(cards[0].quote, 75);
  assert.equal(cards[0].quoteOutcome, 'UNSUCCESSFUL');
});

test('completed lifecycle group maps to delivered booking', () => { const card = mapAssignedJob({ id: 'real-completed', canonicalStatus: 'pod_uploaded', lifecycleGroup: 'completed' }); assert.equal(card.status, 'DELIVERED'); });

test('withdrawn quote is cancelled, never displayed as active', () => { const cards = mapDriverSnapshot({ marketplace: [{ id: 'real-withdrawn', pickup_location: 'Leeds', delivery_location: 'York', posterName: 'Carrier' }], bids: [{ id: 'bid-1', jobId: 'real-withdrawn', amount: 90, status: 'withdrawn' }], bookings: [] }); assert.equal(cards[0].quoteOutcome, 'CANCELLED'); });

test('quote history remains visible when job is no longer on marketplace', () => { const cards = mapDriverSnapshot({ marketplace: [], bookings: [], bids: [{ id: 'bid-history', jobId: 'real-old-job', amount: 65, status: 'rejected', message: 'Collected' }] }); assert.equal(cards.length, 1); assert.equal(cards[0].id, 'real-old-job'); assert.equal(cards[0].quote, 65); assert.equal(cards[0].quoteOutcome, 'UNSUCCESSFUL'); assert.equal(cards[0].from, 'Area not provided'); });

test('canonical driver lifecycle status maps to the correct PWA step', () => {
  for (const [canonicalStatus, expected] of [['on_my_way','ON_WAY_TO_PICKUP'],['on_site_pickup','ON_SITE_PICKUP'],['loaded','LOADED'],['in_transit','ON_WAY_TO_DELIVERY'],['on_site_delivery','ON_SITE_DELIVERY'],['delivered','DELIVERED'],['invoiced','DELIVERED'],['paid','DELIVERED']]) {
    assert.equal(mapAssignedJob({ id: 'real-' + canonicalStatus, canonicalStatus }).status, expected, canonicalStatus);
  }
});
