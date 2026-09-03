export type MembershipLifecycleStatus =
  | 'pending'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'unpaid'
  | 'paused'
  | 'cancelled'
  | 'incomplete'
  | 'incomplete_expired';

export type MembershipEntitlement = {
  workspaceAllowed: boolean;
  billingAllowed: true;
  paymentSettingsAllowed: true;
  mode: 'full' | 'billing_only';
  reason: string;
};

export function resolveMembershipEntitlement(input: {
  status: MembershipLifecycleStatus | null | undefined;
  trialEndsAt?: string | null;
  now?: Date;
}): MembershipEntitlement {
  const now = input.now ?? new Date();
  const status = input.status ?? null;

  if (status === 'active') {
    return { workspaceAllowed: true, billingAllowed: true, paymentSettingsAllowed: true, mode: 'full', reason: 'active_subscription' };
  }

  if (status === 'trialing') {
    const trialEnd = input.trialEndsAt ? new Date(input.trialEndsAt) : null;
    if (trialEnd && Number.isFinite(trialEnd.getTime()) && trialEnd.getTime() > now.getTime()) {
      return { workspaceAllowed: true, billingAllowed: true, paymentSettingsAllowed: true, mode: 'full', reason: 'active_trial' };
    }
    return { workspaceAllowed: false, billingAllowed: true, paymentSettingsAllowed: true, mode: 'billing_only', reason: 'trial_expired' };
  }

  // Fail closed for all other lifecycle states. Billing/payment settings remain
  // reachable so the account holder can repair payment or activate membership.
  return {
    workspaceAllowed: false,
    billingAllowed: true,
    paymentSettingsAllowed: true,
    mode: 'billing_only',
    reason: status ? `membership_${status}` : 'membership_missing',
  };
}
