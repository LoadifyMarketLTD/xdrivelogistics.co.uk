export const XDRIVE_TRIAL_MONTHS = 3 as const;

export type StandardMembershipPlanId =
  | 'owner-driver'
  | 'customer-shipper'
  | 'small-carrier'
  | 'broker'
  | 'growing-carrier'
  | 'fleet';

export const XDRIVE_STANDARD_PLANS: Record<StandardMembershipPlanId, {
  label: string;
  monthlyAmountPence: number;
  stripePriceEnv: string;
}> = {
  'owner-driver': { label: 'Owner Driver', monthlyAmountPence: 2999, stripePriceEnv: 'STRIPE_PRICE_OWNER_DRIVER' },
  'customer-shipper': { label: 'Customer / Shipper', monthlyAmountPence: 2999, stripePriceEnv: 'STRIPE_PRICE_CUSTOMER_SHIPPER' },
  'small-carrier': { label: 'Small Carrier', monthlyAmountPence: 5999, stripePriceEnv: 'STRIPE_PRICE_SMALL_CARRIER' },
  broker: { label: 'Broker', monthlyAmountPence: 7999, stripePriceEnv: 'STRIPE_PRICE_BROKER' },
  'growing-carrier': { label: 'Growing Carrier', monthlyAmountPence: 12999, stripePriceEnv: 'STRIPE_PRICE_GROWING_CARRIER' },
  fleet: { label: 'Fleet', monthlyAmountPence: 24999, stripePriceEnv: 'STRIPE_PRICE_FLEET' },
};

export const isStandardMembershipPlan = (value: unknown): value is StandardMembershipPlanId =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(XDRIVE_STANDARD_PLANS, value);

export const getStripePriceId = (planId: StandardMembershipPlanId) => {
  const envName = XDRIVE_STANDARD_PLANS[planId].stripePriceEnv;
  const value = process.env[envName]?.trim();
  if (!value) throw new Error(`${envName} is not configured.`);
  return value;
};

export const COMMERCIAL_PAYMENT_MODEL = Object.freeze({
  membershipRevenueRecipient: 'xdrive',
  transportChargeModel: 'stripe_connect_direct_charge',
  xdriveJobCommissionPence: 0,
  xdriveBookingFeePence: 0,
  platformCustodiesTransportFunds: false,
});
