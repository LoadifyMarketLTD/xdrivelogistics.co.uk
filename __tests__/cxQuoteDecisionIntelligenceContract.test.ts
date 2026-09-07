import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('CX-inspired quote decision intelligence', () => {
  const helper = read('app/api/_lib/bidderDecisionIdentity.ts');
  const customerApi = read('app/api/workspace/bids/identities/route.ts');
  const brokerApi = read('app/api/admin/bids/identities/route.ts');
  const customer = read('app/customer/quotes/CustomerQuotesCxPage.tsx');
  const broker = read('app/broker/bids/page.tsx');

  it('uses one shared bidder enrichment contract for Customer and Broker', () => {
    expect(customerApi).toContain('enrichBidderDecisionIdentities');
    expect(brokerApi).toContain('enrichBidderDecisionIdentities');
    expect(helper).toContain("quoteLevel: 'driver' | 'company'");
    expect(helper).toContain('memberId: string | null');
    expect(helper).toContain('businessPhone: string | null');
  });

  it('enriches decisions from canonical driver, company and vehicle data', () => {
    expect(helper).toContain("from('drivers')");
    expect(helper).toContain("from('companies')");
    expect(helper).toContain("from('vehicles')");
    expect(helper).toContain('driverAvailability');
    expect(helper).toContain('driverVehicleTailLift');
    expect(helper).toContain('driverVehiclePallets');
    expect(helper).toContain('fleetVehicleTypes');
    expect(helper).toContain('specialistServices');
  });

  it('shows operational decision context before Customer award', () => {
    for (const label of ['Member ID', 'Business contact', 'Quote scope', 'Availability', 'Driver vehicle', 'Fleet capability', 'Specialist services']) {
      expect(customer).toContain(label);
    }
    expect(customer).toContain('Review & Award');
    expect(customer).toContain('/api/customer/bids/${id}/award');
  });

  it('shows the same carrier capability context on the Broker board', () => {
    for (const label of ['Member ID', 'Business contact', 'Quote scope', 'Driver availability', 'Driver vehicle', 'Fleet capability', 'Specialist services']) {
      expect(broker).toContain(label);
    }
    expect(broker).toContain('Compare all quotes');
    expect(broker).toContain('/api/customer/bids/${bidId}/award');
  });

  it('does not invent reputation or couple this layer to Super Admin', () => {
    expect(helper).not.toContain('deliveryScore');
    expect(helper).not.toContain('paymentScore');
    expect(customer).not.toContain('/super-admin');
    expect(broker).not.toContain('/super-admin');
  });
});
