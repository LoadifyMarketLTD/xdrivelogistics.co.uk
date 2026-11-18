import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../_lib/supabaseAdmin';
import { isDriverContext } from '../../../mobile/_lib';
import { requireWebDriver } from '../../../_lib/webDriver';
const json = (status: number, error: string) => NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return json(503, 'Document service is unavailable.');
  const driver = await requireWebDriver(request);
  if (!isDriverContext(driver)) return driver;
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return json(400, 'Invalid document.');
  const { data, error } = await supabaseAdmin.from('driver_documents').select('file_path').eq('id', id).eq('driver_id', driver.driverId).maybeSingle();
  if (error) return json(500, 'Document lookup failed.');
  if (!data?.file_path) return json(404, 'Document not found.');
  const prefix = `${driver.companyId ?? driver.driverId}/${driver.driverId}/`;
  if (!data.file_path.startsWith(prefix)) return json(403, 'Document access denied.');
  const { data: signed, error: signedError } = await supabaseAdmin.storage.from('driver-docs').createSignedUrl(data.file_path, 60);
  if (signedError || !signed?.signedUrl) return json(503, 'Document cannot be opened right now.');
  return NextResponse.json({ url: signed.signedUrl }, { headers: { 'Cache-Control': 'no-store' } });
}
