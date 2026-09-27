import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../_lib/supabaseAdmin';
import { isWebDriverContext, requireActiveWebDriver } from '../../../_lib/webDriverContext';

type Params = { params: Promise<{ jobId: string }> };
type Body = { photoPaths?: unknown };

export async function POST(request: NextRequest, { params }: Params) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return NextResponse.json({ error: 'Server auth is not configured.' }, { status: 503 });
  }

  const driver = await requireActiveWebDriver(request);
  if (!isWebDriverContext(driver)) return driver;
  if (!driver.companyId) return NextResponse.json({ error: 'Driver company is required for collection evidence.' }, { status: 403 });

  const { jobId } = await params;
  if (!jobId) return NextResponse.json({ error: 'Missing job id.' }, { status: 400 });

  const body = (await request.json().catch(() => null)) as Body | null;
  const photoPaths = Array.isArray(body?.photoPaths)
    ? body.photoPaths.filter((value): value is string => typeof value === 'string' && value.trim().length > 0).map((value) => value.trim())
    : [];
  if (photoPaths.length === 0) return NextResponse.json({ error: 'At least one collection photo is required.' }, { status: 400 });
  if (photoPaths.length > 20) return NextResponse.json({ error: 'A maximum of 20 collection photos can be linked at once.' }, { status: 400 });

  const expectedPrefix = `${driver.companyId}/${jobId}/collection-`;
  if (photoPaths.some((path) => !path.startsWith(expectedPrefix))) {
    return NextResponse.json({ error: 'Collection evidence path is outside this assigned job.' }, { status: 400 });
  }

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, assigned_driver_id, pickup_photos, collection_photo_url')
    .eq('id', jobId)
    .eq('assigned_driver_id', driver.driverId)
    .maybeSingle();
  if (jobError) return NextResponse.json({ error: 'Job access could not be verified.' }, { status: 500 });
  if (!job) return NextResponse.json({ error: 'This job is not assigned to your driver account.' }, { status: 404 });

  const existing = Array.isArray(job.pickup_photos)
    ? job.pickup_photos.filter((value): value is string => typeof value === 'string')
    : [];
  const merged = [...new Set([...existing, ...photoPaths])];
  const legacyPhoto = typeof job.collection_photo_url === 'string' && job.collection_photo_url.trim()
    ? job.collection_photo_url.trim()
    : merged[0] ?? null;

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('jobs')
    .update({ pickup_photos: merged, collection_photo_url: legacyPhoto, updated_at: new Date().toISOString() })
    .eq('id', jobId)
    .eq('assigned_driver_id', driver.driverId)
    .select('id')
    .maybeSingle();
  if (updateError) return NextResponse.json({ error: 'Collection evidence could not be linked.' }, { status: 500 });
  if (!updated) return NextResponse.json({ error: 'Collection evidence could not be linked to this assignment.' }, { status: 409 });

  return NextResponse.json({ ok: true, photoPaths: merged }, { status: 200 });
}
