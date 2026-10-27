import { NextRequest } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { getFeatureFlag } from '../../../../../_lib/platformFlags';
import { respond } from '../../../../mobile/_lib';
import { isWebDriverContext, requireActiveWebDriver } from '../../../../_lib/webDriverContext';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  if (!(await getFeatureFlag(supabaseAdmin, 'pod_capture'))) return respond(503, { error: 'POD capture is currently disabled.' });

  const driver = await requireActiveWebDriver(request);
  if (!isWebDriverContext(driver)) return driver;
  if (!driver.companyId) return respond(403, { error: 'Driver company is required for POD confirmation.' });

  // Typed-name attestations cannot replace a handwritten recipient signature.
  // Use the authenticated atomic POD submission endpoint with verified delivery evidence.
  await params;
  return respond(409, { error: 'Capture a handwritten recipient signature in the POD form.' });
}
