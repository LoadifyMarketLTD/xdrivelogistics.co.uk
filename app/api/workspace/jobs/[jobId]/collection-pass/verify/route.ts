import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../../../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

function signingSecret() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim() || '';
}

function passHash(jobId: string, code: string) {
  const secret = signingSecret();
  if (!secret) return '';
  return createHmac('sha256', secret).update(jobId + ':' + code).digest('hex');
}

function safeEqualHex(a: string, b: string) {
  if (!/^[0-9a-f]{64}$/i.test(a) || !/^[0-9a-f]{64}$/i.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  if (!signingSecret()) return respond(503, { error: 'Collection Pass verification is not configured.' });

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Unauthorized.' });
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return respond(401, { error: 'Unauthorized.' });

  const { jobId } = await params;
  const body = await request.json().catch(() => ({} as Record<string, unknown>)) as Record<string, unknown>;
  const code = String(body.code ?? '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(code)) return respond(400, { error: 'Enter the 6-digit Collection Pass code.' });

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id,company_id,collection_pass_required')
    .eq('id', jobId)
    .maybeSingle();
  if (jobError) return respond(500, { error: jobError.message });
  if (!job?.company_id) return respond(404, { error: 'Job not found.' });

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('role_in_company')
    .eq('company_id', job.company_id)
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .in('role_in_company', ['owner', 'admin', 'dispatcher'])
    .maybeSingle();
  if (membershipError) return respond(500, { error: membershipError.message });
  if (!membership) return respond(403, { error: 'Only the posting company can verify this Collection Pass.' });

  const { data: pass, error: passError } = await supabaseAdmin
    .from('driver_collection_passes')
    .select('id,status,token_hash,expires_at,verify_attempts,locked_until,driver_id,vehicle_id')
    .eq('job_id', jobId)
    .maybeSingle();
  if (passError) return respond(500, { error: passError.message });
  if (!pass) return respond(404, { error: 'No Collection Pass is active for this job.' });

  const now = new Date();
  if (pass.status === 'verified') return respond(200, { ok: true, status: 'verified', idempotent: true });
  if (pass.status !== 'active') return respond(409, { error: 'This Collection Pass is not active.' });
  if (Date.parse(pass.expires_at) <= now.getTime()) {
    await supabaseAdmin.from('driver_collection_passes').update({ status: 'expired', updated_at: now.toISOString() }).eq('id', pass.id);
    return respond(409, { error: 'This Collection Pass has expired. Ask the driver to generate a new one.' });
  }
  if (pass.locked_until && Date.parse(pass.locked_until) > now.getTime()) {
    return respond(429, { error: 'Too many incorrect attempts. Try again after the temporary lock expires.', lockedUntil: pass.locked_until });
  }

  const expected = passHash(jobId, code);
  const correct = safeEqualHex(expected, pass.token_hash);
  if (!correct) {
    const attempts = Number(pass.verify_attempts ?? 0) + 1;
    const lock = attempts >= 5 ? new Date(now.getTime() + 15 * 60 * 1000).toISOString() : null;
    await supabaseAdmin
      .from('driver_collection_passes')
      .update({
        verify_attempts: lock ? 0 : attempts,
        last_attempt_at: now.toISOString(),
        locked_until: lock,
        updated_at: now.toISOString(),
      })
      .eq('id', pass.id);
    return respond(lock ? 429 : 400, {
      error: lock ? 'Too many incorrect attempts. Verification is locked for 15 minutes.' : 'Collection Pass code is incorrect.',
      remainingAttempts: lock ? 0 : Math.max(0, 5 - attempts),
      lockedUntil: lock,
    });
  }

  const { error: verifyError } = await supabaseAdmin
    .from('driver_collection_passes')
    .update({
      status: 'verified',
      verified_at: now.toISOString(),
      verified_by_user_id: authData.user.id,
      verify_attempts: 0,
      last_attempt_at: now.toISOString(),
      locked_until: null,
      updated_at: now.toISOString(),
    })
    .eq('id', pass.id)
    .eq('status', 'active');
  if (verifyError) return respond(500, { error: verifyError.message });

  await supabaseAdmin.from('job_tracking_events').insert({
    job_id: jobId,
    event_type: 'note',
    user_id: authData.user.id,
    created_by: authData.user.id,
    message: 'Collection Pass verified by posting company.',
    event_time: now.toISOString(),
  });

  return respond(200, {
    ok: true,
    status: 'verified',
    verifiedAt: now.toISOString(),
    driverId: pass.driver_id,
    vehicleId: pass.vehicle_id,
  });
}
