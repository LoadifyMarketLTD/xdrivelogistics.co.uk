import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source=readFileSync('app/customer/quotes/BookingConfirmationFullPage.tsx','utf8');

describe('Award review vehicle verification and stale state',()=>{
  it('clears previous bidder identity before loading a different bid',()=>{
    expect(source).toContain('setIdentity(null);');
    expect(source).toContain('resolvedIdentity?.bidId===details.bidId ? resolvedIdentity : null');
    expect(source).toContain('setDetailsAccepted(false);');
    expect(source).toContain('setPaymentAccepted(false);');
    expect(source).toContain("setIdentityState(details.bidId ? 'loading' : 'unavailable')");
    expect(source).toContain('},[details.bidId]);');
  });
  it('does not allow a named-driver offer without a linked quote vehicle, driver, and capacity',()=>{
    expect(source).toContain('!identity?.quotedVehicleId || !identity?.driverId || identity?.driverVehiclePallets==null');
    expect(source).toContain('quoteVehicleMismatch');
    expect(source).toContain('vehicleUnverified || quoteVehicleMismatch || tailLiftMismatch');
  });
  it('blocks capacity and tail lift mismatches with accessible warnings',()=>{
    expect(source).toContain('details.pallets>identity.driverVehiclePallets');
    expect(source).toContain('details.tailLift && namedDriverQuote && identity?.driverVehicleTailLift===false');
    expect(source).toContain('Tail-lift required by the load');
    expect(source).toContain('role="alert"');
  });
});
