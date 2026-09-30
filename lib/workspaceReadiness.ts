import type { WorkspaceRole } from './workspaceRole';

export type ReadinessOperation = 'post_load' | 'quote' | 'commercial';
export type WorkspaceBlocker = {
  code: string; title: string; message: string; operation: ReadinessOperation;
  actionType: 'link' | 'stripe_setup' | 'retry'; actionLabel: string;
  actionHref?: string; companyId?: string; missingDocuments?: string[];
};
export type ReadinessContext = {
  role: WorkspaceRole; root: '/admin' | '/customer' | '/broker' | '/driver';
  companyId: string | null; canManageCompany: boolean; onboardingHref: string;
};
const normal = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase() : '';

/** Inputs must come from verified database rows, never query-string role claims. */
export function resolveReadinessContext(input: {
  profileRole?: string | null; membershipRole?: string | null; companyType?: string | null;
  driverType?: string | null; accountType?: string | null; companyId: string | null;
}): ReadinessContext {
  const member = normal(input.membershipRole);
  const profile = normal(input.profileRole);
  const account = normal(input.accountType);
  const company = normal(input.companyType);
  const driver = normal(input.driverType);
  let role: WorkspaceRole;
  if (driver === 'company_driver' || member === 'driver') role = 'driver';
  else if (driver === 'owner_driver' || account === 'owner_driver' || profile === 'owner_driver') role = 'owner_driver';
  else if (['driver', 'company_driver'].includes(profile) || ['individual_driver', 'company_driver'].includes(account)) role = 'driver';
  else if ([profile, account, company].some((s) => ['customer', 'customer_shipper', 'shipper'].includes(s))) role = 'customer';
  else if ([profile, account, company].some((s) => ['broker', 'broker_shipper'].includes(s))) role = 'broker';
  else if (member === 'owner') role = 'company_owner';
  else if (member === 'admin') role = 'company_admin';
  else if (['dispatcher', 'fleet_manager', 'finance', 'compliance'].includes(member)) role = member as WorkspaceRole;
  else role = 'carrier_admin';
  const root = role === 'driver' || role === 'owner_driver' ? '/driver'
    : role === 'customer' ? '/customer' : role === 'broker' ? '/broker' : '/admin';
  const segment = role === 'owner_driver' ? 'owner-driver' : role === 'driver' ? 'individual-driver'
    : role === 'customer' ? 'customer' : role === 'broker' ? 'broker' : 'fleet';
  return { role, root, companyId: input.companyId, canManageCompany: ['owner', 'admin'].includes(member), onboardingHref: '/onboarding/' + segment + '/resume' };
}

export function isSafeRecoveryHref(value: unknown): value is string {
  return typeof value === 'string' && /^\/(admin|customer|broker|driver|onboarding|pending-approval|login)(?:[/?#]|$)/.test(value)
    && !/[\\\r\n]/.test(value);
}
export function documentRecoveryHref(onboardingHref: string, documentType: string): string {
  return onboardingHref + '?document=' + encodeURIComponent(documentType) + '#onboarding-document-' + encodeURIComponent(documentType);
}
export function companyRecoveryAction(context: ReadinessContext, kind: 'stripe' | 'legal'): Pick<WorkspaceBlocker, 'actionType' | 'actionLabel' | 'actionHref' | 'companyId'> {
  if (!context.canManageCompany || !context.companyId) return {
    actionType: 'link', actionLabel: 'Get company setup help',
    actionHref: context.root + '/support?reason=' + kind + '-company-setup',
  };
  if (kind === 'stripe') return { actionType: 'stripe_setup', actionLabel: 'Complete Stripe setup', companyId: context.companyId };
  return { actionType: 'link', actionLabel: 'Review & accept agreements',
    actionHref: context.root + (context.root === '/admin' ? '/settings/legal-agreements' : '/account/legal-agreements') };
}
export function unavailableReadinessBlocker(check: string, operation: ReadinessOperation): WorkspaceBlocker {
  return { code: 'READINESS_UNAVAILABLE_' + check.toUpperCase(), title: check + ' could not be verified',
    message: 'The check is temporarily unavailable. This does not mean your account is cleared. Retry the check; existing restrictions remain in force.',
    operation, actionType: 'retry', actionLabel: 'Retry check' };
}
export function driverReadinessBlocker(code: string, context: ReadinessContext): WorkspaceBlocker {
  const base: WorkspaceBlocker = { code: 'DRIVER_' + code.toUpperCase(), title: 'Driver readiness requires attention',
    message: code.replace(/_/g, ' '), operation: 'quote', actionType: 'link',
    actionLabel: 'Get company setup help', actionHref: context.root + '/support?reason=' + encodeURIComponent(code) };
  if (code === 'driver_onboarding_not_approved' || code === 'driver_personal_compliance_not_current' || code === 'verified_driver_identity_missing') {
    return { ...base, title: 'Driver verification is incomplete', message: 'Review your onboarding and required identity evidence. Uploaded evidence may still need approval.',
      actionLabel: 'Review driver verification', actionHref: context.onboardingHref };
  }
  if (code.startsWith('vehicle_document_missing_or_invalid:')) {
    return { ...base, title: 'Vehicle document requires attention', message: 'Your assigned vehicle needs current, approved ' + code.split(':')[1] + ' evidence. Ask the company administrator to update this vehicle document.' };
  }
  if (code.startsWith('canonical_vehicle_')) return { ...base, title: 'Vehicle assignment requires attention', message: 'Quoting requires exactly one active, correctly assigned vehicle. Ask your company administrator to correct the assignment.' };
  return base;
}

export const WORKSPACE_READINESS_CHANGED = 'xdrive:workspace-readiness-changed';
