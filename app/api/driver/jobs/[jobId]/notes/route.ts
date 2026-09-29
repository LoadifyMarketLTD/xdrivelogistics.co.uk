import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../_lib/supabaseAdmin';
import { isWebDriverContext, requireActiveWebDriver } from '../../../_lib/webDriverContext';

type Params = { params: Promise<{ jobId: string }> };

type NoteBody = {
  note?: unknown;
  visibility?: unknown;
};

export async function POST(request: NextRequest, { params }: Params) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return NextResponse.json({ error: 'Server auth is not configured.' }, { status: 503 });
  }

  const driver = await requireActiveWebDriver(request);
  if (!isWebDriverContext(driver)) return driver;

  const { jobId } = await params;
  if (!jobId) return NextResponse.json({ error: 'Missing job id.' }, { status: 400 });

  const body = (await request.json().catch(() => null)) as NoteBody | null;
  const note = typeof body?.note === 'string' ? body.note.trim() : '';
  const visibility = body?.visibility === 'important' ? 'important' : 'internal';
  if (!note) return NextResponse.json({ error: 'Write a short note first.' }, { status: 400 });
  if (note.length > 2000) return NextResponse.json({ error: 'Note is too long.' }, { status: 400 });

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, company_id, assigned_driver_id')
    .eq('id', jobId)
    .eq('assigned_driver_id', driver.driverId)
    .maybeSingle();

  if (jobError) return NextResponse.json({ error: 'Job access could not be verified.' }, { status: 500 });
  if (!job?.company_id) {
    return NextResponse.json({ error: 'This job is not assigned to your driver account.' }, { status: 404 });
  }

  const { error: insertError } = await supabaseAdmin.from('job_notes').insert({
    company_id: job.company_id,
    job_id: job.id,
    load_id: job.id,
    author_user_id: driver.userId,
    created_by: driver.userId,
    note,
    visibility,
    status: 'active',
  });

  if (insertError) return NextResponse.json({ error: 'The note could not be saved.' }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
