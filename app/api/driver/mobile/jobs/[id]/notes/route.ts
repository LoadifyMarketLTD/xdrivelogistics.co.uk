import { NextRequest, NextResponse } from 'next/server';

import { isDriverContext, requireDriver } from '../../../_lib';
import { supabaseAdmin } from '../../../../../_lib/supabaseAdmin';

type Params = { params: Promise<{ id: string }> };
type NoteBody = { note?: unknown; visibility?: unknown };

export async function POST(request: NextRequest, { params }: Params) {
  const context = await requireDriver(request);
  if (!isDriverContext(context)) return context;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing job id.' }, { status: 400 });

  const body = await request.json().catch(() => null) as NoteBody | null;
  const note = typeof body?.note === 'string' ? body.note.trim() : '';
  const visibility = body?.visibility === 'important' ? 'important' : 'internal';
  if (!note) return NextResponse.json({ error: 'Write a short note first.' }, { status: 400 });
  if (note.length > 2000) return NextResponse.json({ error: 'Note is too long.' }, { status: 400 });

  const { data: job, error: jobError } = await supabaseAdmin!
    .from('jobs')
    .select('id, company_id, assigned_driver_id')
    .eq('id', id)
    .eq('assigned_driver_id', context.driverId)
    .maybeSingle();
  if (jobError) return NextResponse.json({ error: 'Assigned job could not be resolved.' }, { status: 500 });
  if (!job?.company_id) return NextResponse.json({ error: 'This job is not assigned to the current driver.' }, { status: 403 });

  const { error: insertError } = await supabaseAdmin!.from('job_notes').insert({
    company_id: job.company_id,
    job_id: job.id,
    load_id: job.id,
    author_user_id: context.userId,
    created_by: context.userId,
    note,
    visibility,
    status: 'active',
  });
  if (insertError) return NextResponse.json({ error: 'Driver note could not be saved.' }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 201 });
}
