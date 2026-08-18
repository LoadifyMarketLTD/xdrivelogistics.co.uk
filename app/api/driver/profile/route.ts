import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { isWebDriverContext, requireActiveWebDriver } from '../_lib/webDriverContext';

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

export async function PUT(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Driver profile updates are temporarily unavailable.' });
  }

  const driver = await requireActiveWebDriver(request);
  if (!isWebDriverContext(driver)) return driver;

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  if (displayName.length > 160) return json(400, { error: 'Display name must be 160 characters or fewer.' });
  if (phone.length > 40) return json(400, { error: 'Phone number must be 40 characters or fewer.' });

  // Service role is deliberately restricted to the two self-service profile
  // fields exposed by Driver Profile. General drivers-table UPDATE remains
  // governed by the existing operator/admin RLS contract.
  const { data, error } = await supabaseAdmin
    .from('drivers')
    .update({
      display_name: displayName || null,
      phone: phone || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', driver.driverId)
    .eq('user_id', driver.userId)
    .eq('app_access', true)
    .eq('status', 'active')
    .select('id, company_id, display_name, phone, email, availability_status, status')
    .maybeSingle();

  if (error) return json(500, { error: 'Your profile changes could not be saved.' });
  if (!data) return json(409, { error: 'Your active Driver workspace record could not be updated.' });

  return json(200, { driver: data });
}
