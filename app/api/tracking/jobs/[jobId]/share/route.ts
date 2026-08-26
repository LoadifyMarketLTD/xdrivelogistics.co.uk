import { createHash, randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../../../_lib/supabaseAdmin';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIVE = new Set([
  'allocated', 'accepted', 'on_my_way', 'on_my_way_to_pickup', 'on_site_pickup', 'arrived_pickup',
  'loaded', 'collected', 'in_transit', 'on_my_way_to_delivery', 'on_route_delivery', 'on_site_delivery', 'arrived_delivery',
]);
const SHARE_TTL_MS = 48 * 60 * 60_000;

const statusOf = (job: { current_status?: string | null; status?: string | null }) =>
  String(job.current_status ?? job.status ?? '').trim().toLowerCase();

async function isCompanyMember(userId: string, companyId: string | null) {
  if (!companyId || !supabaseAdmin) return false;
  const { data, error } = await supabaseAdmin
    .from('company_memberships')
    .select('id')
    .eq('company_id', companyId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  return !error && Boolean(data);
}

export async function POST(request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return NextResponse.json({ error: 'Live tracking sharing is temporarily unavailable.' }, { status: 503 });
  }

  const token = getBearerToken(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { jobId } = await context.params;
  if (!UUID.test(jobId)) return NextResponse.json({ error: 'Invalid job id.' }, { status: 400 });

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, company_id, awarded_carrier_company_id, current_status, status')
    .eq('id', jobId)
    .maybeSingle();
  if (jobError) return NextResponse.json({ error: 'Job could not be loaded.' }, { status: 500 });
  if (!job) return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
  if (!ACTIVE.has(statusOf(job))) return NextResponse.json({ error: 'Tracking can only be shared while the job is active.' }, { status: 409 });

  const [posterAccess, carrierAccess] = await Promise.all([
    isCompanyMember(authData.user.id, job.company_id ?? null),
    isCompanyMember(authData.user.id, job.awarded_carrier_company_id ?? null),
  ]);
  if (!posterAccess && !carrierAccess) {
    return NextResponse.json({ error: 'Only the job poster or awarded carrier can share live tracking.' }, { status: 403 });
  }

  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + SHARE_TTL_MS).toISOString();

  const { error: insertError } = await supabaseAdmin.from('job_tracking_share_tokens').insert({
    job_id: job.id,
    token_hash: tokenHash,
    created_by: authData.user.id,
    expires_at: expiresAt,
  });
  if (insertError) return NextResponse.json({ error: 'Secure tracking link could not be created.' }, { status: 500 });

  const shareUrl = new URL(`/track/${rawToken}`, request.nextUrl.origin).toString();
  return NextResponse.json({ share_url: shareUrl, expires_at: expiresAt });
}
