import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isDriverContext, requireDriver, respond } from '../_lib';

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const { data, error } = await supabaseAdmin
    .from('driver_documents')
    .select('id, doc_type, status, expiry_date, created_at, rejection_reason')
    .eq('driver_id', driver.driverId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return respond(500, { error: error.message });

  return respond(200, { documents: data ?? [] });
}
