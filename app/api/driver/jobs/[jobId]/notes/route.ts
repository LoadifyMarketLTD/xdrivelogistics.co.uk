import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../../../_lib/supabaseAdmin';

type Params = { params: Promise<{ jobId: string }> };

type NoteBody = {
  note?: unknown;
  visibility?: unknown;
};

async function resolveCompanyAccess(userId: string, companyId: string) {
  const { data: membership } = await supabaseAdmin!
    .from('company_memberships')
    .select('id')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .eq('status', 'active')
    .maybeSingle();

  if (membership) return true;

  const { data: driverRow } = await supabaseAdmin!
    .from('drivers')
    .select('id')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .maybeSingle();

  return Boolean(driverRow);
}

export async function POST(request: NextRequest, { params }: Params) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return NextResponse.json({ error: 'Server auth is not configured.' }, { status: 503 });
  }

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { jobId } = await params;
  if (!jobId) {
    return NextResponse.json({ error: 'Missing job id.' }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as NoteBody | null;
  const note = typeof body?.note === 'string' ? body.note.trim() : '';
  const visibility = body?.visibility === 'important' ? 'important' : 'internal';

  if (!note) {
    return NextResponse.json({ error: 'Write a short note first.' }, { status: 400 });
  }

  if (note.length > 2000) {
    return NextResponse.json({ error: 'Note is too long.' }, { status: 400 });
  }

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, company_id')
    .eq('id', jobId)
    .maybeSingle();

  if (jobError) {
    return NextResponse.json({ error: jobError.message }, { status: 500 });
  }

  if (!job?.company_id) {
    return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
  }

  const hasAccess = await resolveCompanyAccess(authData.user.id, job.company_id);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const { error: insertError } = await supabaseAdmin.from('job_notes').insert({
    company_id: job.company_id,
    job_id: job.id,
    load_id: job.id,
    author_user_id: authData.user.id,
    created_by: authData.user.id,
    note,
    visibility,
    status: 'active',
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}