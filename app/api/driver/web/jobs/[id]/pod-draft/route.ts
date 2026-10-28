import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { isWebDriverContext, requireActiveWebDriver } from '../../../../_lib/webDriverContext';

const respond = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const MAX_DRAFT_BYTES = 2_800_000;
const DRAFT_FIELDS = [
  'recipientName', 'leftAt', 'deliveryStatus', 'itemCount', 'weight',
  'deliveredOn', 'notes', 'signatureData', 'photoUris', 'documentUris', 'hardCopyAcknowledged',
] as const;

async function authorisedDriverJob(request: NextRequest, jobId: string) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return { response: respond(503, { error: 'POD draft service is unavailable.' }) };
  }
  const driver = await requireActiveWebDriver(request);
  if (!isWebDriverContext(driver)) return { response: driver };
  const { data, error } = await supabaseAdmin.from('jobs')
    .select('id,assigned_driver_id,pod_generated')
    .eq('id', jobId)
    .eq('assigned_driver_id', driver.driverId)
    .maybeSingle();
  if (error) return { response: respond(503, { error: 'Booking access could not be verified.' }) };
  if (!data) return { response: respond(404, { error: 'Assigned booking not found.' }) };
  return { driver, job: data };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await authorisedDriverJob(request, id);
  if ('response' in access) return access.response;
  if (access.job.pod_generated) return respond(200, { draft: null, completed: true });
  const { data, error } = await supabaseAdmin!.from('driver_pod_drafts')
    .select('form_data,updated_at')
    .eq('job_id', id)
    .eq('driver_id', access.driver.driverId)
    .maybeSingle();
  if (error) return respond(503, { error: 'POD draft could not be loaded. Check database migration.' });
  return respond(200, { draft: data?.form_data ?? null, updatedAt: data?.updated_at ?? null });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await authorisedDriverJob(request, id);
  if ('response' in access) return access.response;
  if (access.job.pod_generated) return respond(409, { error: 'This POD has already been finalised.' });
  const raw = await request.text();
  if (raw.length > MAX_DRAFT_BYTES) return respond(413, { error: 'POD draft exceeds the maximum size.' });
  let source: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error('Invalid draft');
    source = parsed as Record<string, unknown>;
  } catch { return respond(400, { error: 'Invalid POD draft.' }); }
  const draft: Record<string, unknown> = {};
  for (const key of DRAFT_FIELDS) {
    const value = source[key];
    if (value == null) continue;
    if (key === 'photoUris' || key === 'documentUris') {
      if (!Array.isArray(value) || value.length > 10 ||
        !value.every(path => typeof path === 'string' &&
          path.startsWith(`${access.driver.companyId}/${id}/`) && path.length <= 500)) {
        return respond(400, { error: 'POD attachment reference is invalid.' });
      }
      draft[key] = value;
    } else if (key === 'hardCopyAcknowledged' && typeof value === 'boolean') {
      draft[key] = value;
    } else if (typeof value === 'string') {
      const maxLength = key === 'signatureData' ? 2_500_000 : key === 'notes' ? 5000 : 500;
      if (value.length > maxLength) return respond(413, { error: 'POD field is too large.' });
      if (key === 'signatureData' && value && !/^data:image\/(png|jpeg);base64,/i.test(value)) {
        return respond(400, { error: 'POD signature format is invalid.' });
      }
      draft[key] = value;
    } else {
      return respond(400, { error: 'POD draft contains an invalid field.' });
    }
  }
  const { error } = await supabaseAdmin!.from('driver_pod_drafts').upsert({
    job_id: id, driver_id: access.driver.driverId, form_data: draft,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'job_id' });
  if (error) return respond(503, { error: 'POD draft could not be saved. Check database migration.' });
  return respond(200, { ok: true });
}
