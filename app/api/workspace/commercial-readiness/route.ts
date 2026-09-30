import { NextRequest, NextResponse } from 'next/server';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';
import { getCommercialLegalReadiness } from '../../_lib/commercialLegalReadiness';
import { getStripeCommercialReadiness } from '../../_lib/stripeCommercialReadiness';
import { getTransportBuyerRiskSnapshot } from '../../_lib/transportBuyerRisk';
import { resolveDriverOperationalEligibility } from '../../driver/_lib/operationalEligibility';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ActionKind = 'post_load' | 'quote';
type WorkspaceRole =
  | 'company_owner'
  | 'company_admin'
  | 'carrier_admin'
  | 'broker'
  | 'customer'
  | 'owner_driver'
  | 'driver'
  | 'fleet_manager'
  | 'dispatcher'
  | 'finance'
  | 'compliance'
  | 'viewer';

type Remediation = {
  code: string;
  title: string;
  message: string;
  actionLabel: string;
  actionUrl: string;
  actionKind: ActionKind;
};

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

const legalUrl = (role: WorkspaceRole) => {
  if (role === 'broker') return '/broker/account/legal-agreements';
  if (role === 'customer') return '/customer/account/legal-agreements';
  if (role === 'driver' || role === 'owner_driver') return '/driver/account/legal-agreements';
  return '/admin/settings/legal-agreements';
};

const supportUrl = (role: WorkspaceRole) => {
  if (role === 'company_owner' || role === 'company_admin' || role === 'carrier_admin') return '/admin/support';
  return '/help';
};

const driverBlockerRemediation = (blocker: string): Omit<Remediation, 'actionKind'> => {
  if (blocker === 'driver_onboarding_not_approved') {
    return {
      code: blocker,
      title: 'Driver onboarding is incomplete',
      message: 'Complete the outstanding onboarding steps before submitting transport quotes.',
      actionLabel: 'Complete onboarding',
      actionUrl: '/onboarding/resume',
    };
  }
  if (blocker === 'driver_personal_compliance_not_current') {
    return {
      code: blocker,
      title: 'Driver documents need attention',
      message: 'One or more required driver compliance documents are missing, expired or not approved.',
      actionLabel: 'Upload driver documents',
      actionUrl: '/driver/documents',
    };
  }
  if (blocker.startsWith('vehicle_document_missing_or_invalid:')) {
    const documentType = blocker.split(':')[1]?.toUpperCase() ?? 'vehicle document';
    return {
      code: blocker,
      title: `${documentType} needs attention`,
      message: `The assigned vehicle needs a current approved ${documentType} document before quoting.`,
      actionLabel: 'Open vehicle documents',
      actionUrl: '/driver/documents',
    };
  }
  if (blocker === 'canonical_vehicle_missing' || blocker === 'canonical_vehicle_ambiguous') {
    return {
      code: blocker,
      title: 'Vehicle assignment needs attention',
      message: blocker === 'canonical_vehicle_missing'
        ? 'Assign one active vehicle to this driver before quoting.'
        : 'More than one active vehicle is assigned. Keep exactly one active execution vehicle.',
      actionLabel: 'Manage vehicle',
      actionUrl: '/driver/drivers-vehicles',
    };
  }
  if (blocker === 'verified_driver_identity_missing') {
    return {
      code: blocker,
      title: 'Driver identity verification is incomplete',
      message: 'Complete or recover the verified driver identity before quoting.',
      actionLabel: 'Complete onboarding',
      actionUrl: '/onboarding/resume',
    };
  }
  if (blocker === 'driver_company_membership_not_active' || blocker === 'driver_company_not_active') {
    return {
      code: blocker,
      title: 'Company access needs attention',
      message: 'The driver-company relationship is not active, so commercial quoting is blocked.',
      actionLabel: 'Open account support',
      actionUrl: '/help',
    };
  }
  if (blocker === 'commercial_bid_disabled') {
    return {
      code: blocker,
      title: 'Commercial quoting is disabled',
      message: 'This driver is not currently permitted to submit commercial quotes.',
      actionLabel: 'Open account settings',
      actionUrl: '/driver/settings?section=overview',
    };
  }
  return {
    code: blocker,
    title: 'Commercial eligibility needs attention',
    message: 'A required operational condition is preventing this action.',
    actionLabel: 'Open support',
    actionUrl: '/help',
  };
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin || !supabaseValidator) {
    return json(503, { error: 'Commercial readiness service is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Unauthorized.' });

  const { data: authData, error: authError } = await supabaseValidator.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: 'Unauthorized.' });

  const roleParam = (request.nextUrl.searchParams.get('role') ?? '').trim() as WorkspaceRole;
  const actionParam = (request.nextUrl.searchParams.get('action') ?? 'post_load').trim() as ActionKind;
  const actionKind: ActionKind = actionParam === 'quote' ? 'quote' : 'post_load';

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('company_id,status')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (profileError) return json(500, { error: 'Unable to resolve the active company.' });
  const companyId = typeof profile?.company_id === 'string' ? profile.company_id : null;
  if (!companyId) {
    return json(200, {
      ready: false,
      action: actionKind,
      blockers: [{
        code: 'company_context_missing',
        title: 'Company setup is incomplete',
        message: 'Complete onboarding so this account is linked to an active company.',
        actionLabel: 'Complete onboarding',
        actionUrl: '/onboarding/resume',
        actionKind,
      } satisfies Remediation],
    });
  }

  const blockers: Remediation[] = [];

  const [legal, stripe] = await Promise.all([
    getCommercialLegalReadiness(supabaseAdmin, companyId),
    getStripeCommercialReadiness(supabaseAdmin, companyId),
  ]);

  if (legal.infrastructureAvailable && !legal.ready) {
    blockers.push({
      code: 'COMMERCIAL_LEGAL_REACCEPTANCE_REQUIRED',
      title: 'Legal agreements need acceptance',
      message: 'Review and accept the current XDrive commercial agreements to continue.',
      actionLabel: 'Review legal agreements',
      actionUrl: legalUrl(roleParam),
      actionKind,
    });
  }

  if (stripe.infrastructureAvailable && !stripe.ready) {
    blockers.push({
      code: 'STRIPE_COMMERCIAL_READINESS_REQUIRED',
      title: 'Stripe setup is incomplete',
      message: 'Complete and activate the company Stripe account to use commercial actions.',
      actionLabel: 'Complete Stripe setup',
      actionUrl: '/settings/payments',
      actionKind,
    });
  }

  if (actionKind === 'post_load') {
    const risk = await getTransportBuyerRiskSnapshot(supabaseAdmin, companyId, 0);
    if (risk.infrastructureAvailable && risk.snapshot && !risk.snapshot.allowed) {
      blockers.push({
        code: 'TRANSPORT_BUYER_RISK_LIMIT',
        title: 'Transport buyer account is restricted',
        message: risk.snapshot.reason ?? 'A buyer-risk control is preventing new transport commitments.',
        actionLabel: 'Resolve account restriction',
        actionUrl: supportUrl(roleParam),
        actionKind,
      });
    }
  }

  if (actionKind === 'quote' && (roleParam === 'driver' || roleParam === 'owner_driver')) {
    const { data: driver } = await supabaseAdmin
      .from('drivers')
      .select('id')
      .eq('user_id', authData.user.id)
      .eq('company_id', companyId)
      .maybeSingle();

    if (!driver?.id) {
      blockers.push({
        code: 'driver_profile_missing',
        title: 'Driver profile is incomplete',
        message: 'Complete driver onboarding before submitting transport quotes.',
        actionLabel: 'Complete onboarding',
        actionUrl: '/onboarding/resume',
        actionKind,
      });
    } else {
      const eligibility = await resolveDriverOperationalEligibility(supabaseAdmin, String(driver.id));
      for (const blocker of eligibility.blockers) {
        const remediation = driverBlockerRemediation(blocker);
        blockers.push({ ...remediation, actionKind });
      }
    }
  }

  const unique = Array.from(new Map(blockers.map((item) => [item.code, item])).values());
  return json(200, {
    ready: unique.length === 0,
    action: actionKind,
    companyId,
    blockers: unique,
  });
}
