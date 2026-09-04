import { describe, expect, it } from 'vitest';

import {
  COMMERCIAL_PAYMENT_MODEL,
  XDRIVE_STANDARD_PLANS,
  XDRIVE_TRIAL_MONTHS,
  isStandardMembershipPlan,
} from '../lib/commercialBilling';

describe('XDrive commercial billing contract', () => {
  it('keeps the agreed standard monthly prices in pence', () => {
    expect(XDRIVE_STANDARD_PLANS['owner-driver'].monthlyAmountPence).toBe(2999);
    expect(XDRIVE_STANDARD_PLANS['customer-shipper'].monthlyAmountPence).toBe(2999);
    expect(XDRIVE_STANDARD_PLANS['small-carrier'].monthlyAmountPence).toBe(5999);
    expect(XDRIVE_STANDARD_PLANS.broker.monthlyAmountPence).toBe(7999);
    expect(XDRIVE_STANDARD_PLANS['growing-carrier'].monthlyAmountPence).toBe(12999);
    expect(XDRIVE_STANDARD_PLANS.fleet.monthlyAmountPence).toBe(24999);
  });

  it('defines a three-calendar-month promotional trial', () => {
    expect(XDRIVE_TRIAL_MONTHS).toBe(3);
  });

  it('keeps transport money outside XDrive custody and applies no job fee', () => {
    expect(COMMERCIAL_PAYMENT_MODEL.transportChargeModel).toBe('stripe_connect_direct_charge');
    expect(COMMERCIAL_PAYMENT_MODEL.platformCustodiesTransportFunds).toBe(false);
    expect(COMMERCIAL_PAYMENT_MODEL.xdriveJobCommissionPence).toBe(0);
    expect(COMMERCIAL_PAYMENT_MODEL.xdriveBookingFeePence).toBe(0);
  });

  it('rejects enterprise/custom as a standard self-service subscription', () => {
    expect(isStandardMembershipPlan('enterprise')).toBe(false);
    expect(isStandardMembershipPlan('fleet')).toBe(true);
  });
});
