import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { buildPlatformIntegrationReadiness, runPlatformHealthChecks } from '../_lib/platformHealth';
import { verifyPlatformOwner } from '../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });
const GOVERNANCE_HEALTH_SERVICES = new Set(['Membership Billing', 'Stripe Webhook Processing']);

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  try {
    const { checks, summary } = await runPlatformHealthChecks();
    const integrations = buildPlatformIntegrationReadiness();
    return respond(200, {
      checkedAt: new Date().toISOString(),
      checks: checks.filter((check) => !GOVERNANCE_HEALTH_SERVICES.has(check.service)),
      governanceChecks: checks.filter((check) => GOVERNANCE_HEALTH_SERVICES.has(check.service)),
      integrations,
      summary,
    });
  } catch (error) {
    return respond(503, {
      error: 'Platform health could not be determined safely.',
      detail: error instanceof Error ? error.message : 'Unknown platform health failure.',
    });
  }
}
