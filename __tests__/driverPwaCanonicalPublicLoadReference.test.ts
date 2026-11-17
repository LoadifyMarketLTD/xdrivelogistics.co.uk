/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  platformJobReference, mapMarketplace, mapAssigned, applyPersonalBids, applyBookingOffers,
} from '../driver-pwa-reserve/src/liveApi';

const id = 'c0e098f3-a5f2-4b64-bf52-e129b3192947';
const official = 'XDL-C0E098F3';
const load = { id, member: { name: 'XDRIVE LOGISTICS LTD' },
  payment_terms: '14 days', pickup_area: 'TRAFFORD, M17', delivery_area: 'OLDHAM, OL4',
  public_reference: official,
};

describe('XDrive official public load reference, no UUID leakage into Quotes', () => {
  it('uses the exact official reference sent by the marketplace API', () => {
    expect(mapMarketplace(load).yourRef).toBe(official);
  });
  it('uses canonical XDL reference for legacy marketplace data without a public_reference', () => {
    expect(mapMarketplace({ ...load, public_reference: null }).yourRef).toBe(official);
  });
  it('preserves the same XDL reference for submitted personal bid history even without a marketplace row', () => {
    const result = applyPersonalBids([], { bids: [{ jobId: id, id: 'bid-test', status: 'submitted', amount: 180, message: 'E2E TEST only' }] });
    expect(result).toHaveLength(1);
    expect(result[0].yourRef).toBe(official);
    expect(result[0].id).toBe(id); // API operations continue to use the immutable UUID.
    expect(result[0].quote).toBe(180);
  });
  it('preserves the same reference for active marketplace load plus personal quote', () => {
    const result = applyPersonalBids([mapMarketplace(load)], { bids: [{jobId:id,id:'bid-test',status:'submitted',amount:180}] });
    expect(result[0].yourRef).toBe(official);
    expect(result[0].quote).toBe(180);
  });
  it('keeps the canonical reference for an awarded job', () => {
    const job = mapAssigned({ id, reference: official, customerReference:'XD-0741', currentStatus:'delivered', podGenerated: false });
    expect(job.yourRef).toBe(official);
    expect(job.customerRef).toBe('XD-0741');
  });
  it('recovers canonical XDL reference on older assigned rows that omit a reference', () => {
    expect(mapAssigned({id,status:'allocated'}).yourRef).toBe(official);
  });
  it('uses the same reference for booking offers, without replacing the internal job ID', () => {
    const result = applyBookingOffers([], { offers: [{id:'offer-1', job_id:id, status:'pending', public_reference:official, job:{pickup_location:'Collection', delivery_location:'Delivery'}}] });
    expect(result).toHaveLength(1);
    expect(result[0].yourRef).toBe(official);
    expect(result[0].id).toBe(id);
  });
  it('does not display arbitrary raw UUIDs or customer-supplied strings as a platform reference', () => {
    expect(platformJobReference(id, id)).toBe(official);
    expect(platformJobReference(id, 'XD-0741')).toBe(official);
    expect(platformJobReference('invalid-internal-id')).toBe('');
    expect(platformJobReference('')).toBe('');
  });
  it('normalises a verified public reference to uppercase', () => {
    expect(platformJobReference(id, 'xdl-c0e098f3')).toBe(official);
  });
  it('the quote details field never falls back to UUID or private customer ref', () => {
    const source = readFileSync('driver-pwa-reserve/src/ReserveApp.tsx','utf8');
    expect(source).toContain('<Fact name="Load reference" value={platformJobReference(job.id,job.yourRef)||\'Not provided\'}/>');
    expect(source).not.toContain('job.yourRef||job.customerRef||job.id');
    expect(source).not.toContain('job.yourRef||job.id');
  });
  it('the marketplace and personal-bids APIs both return the XDrive public number', () => {
    const marketplace = readFileSync('app/api/driver/marketplace/loads/route.ts','utf8');
    const bids = readFileSync('app/api/driver/mobile/bids/route.ts','utf8');
    expect(marketplace).toContain('public_reference: `XDL-${String(job.id).slice(0, 8).toUpperCase()}`');
    expect(bids).toContain('publicReference: `XDL-${String(bid.job_id).slice(0, 8).toUpperCase()}`');
  });
});
