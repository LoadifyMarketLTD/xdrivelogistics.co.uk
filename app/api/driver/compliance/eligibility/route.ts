import { NextRequest, NextResponse } from 'next/server';

import { supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { resolveDriverOperationalEligibility } from '../../_lib/operationalEligibility';
import { isComplianceDriverContext, resolveComplianceDriver } from '../_lib';

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status });

export async function GET(request: NextRequest) {
  const resolved = await resolveComplianceDriver(request);
  if (!isComplianceDriverContext(resolved)) return resolved;

  try {
    const operational = await resolveDriverOperationalEligibility(supabaseAdmin!, resolved.driverId);
    return json(200, {
      eligible: operational.eligible,
      blockers: operational.blockers,
      canonicalVehicleId: operational.canonicalVehicleId,
      checks: operational.checks,
    });
  } catch {
    return json(503, {
      eligible: false,
      blockers: ['operational_eligibility_unavailable'],
      canonicalVehicleId: null,
      checks: null,
    });
  }
}
