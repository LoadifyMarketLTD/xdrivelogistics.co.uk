import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../../../_lib/supabaseAdmin';

type Params = { params: Promise<{ id: string }> };
const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

const payloadSchema = z.object({
  companyId: z.string().uuid(),
  targetCompanyId: z.string().uuid(),
});

const EDIT_ROLES = new Set(['owner', 'admin', 'dispatcher', 'fleet_manager']);

async function context(request: NextRequest, companyId: string, groupId: string) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return { error: respond(503, { error: 'Network Groups are temporarily unavailable.' }) };
  const token = getBearerToken(request);
  if (!token) return { error: respond(401, { error: 'Missing bearer token.' }) };
  const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !auth.user) return { error: respond(401, { error: 'Invalid session.' }) };

  const [{ data: membership, error: membershipError }, { data: group, error: groupError }] = await Promise.all([
    supabaseAdmin.from('company_memberships').select('role_in_company').eq('company_id', companyId).eq('user_id', auth.user.id).eq('status', 'active').maybeSingle(),
    supabaseAdmin.from('network_groups').select('id,owner_company_id').eq('id', groupId).eq('owner_company_id', companyId).maybeSingle(),
  ]);
  if (membershipError || groupError) return { error: respond(503, { error: 'Private Group authority could not be verified.' }) };
  if (!membership || !group) return { error: respond(404, { error: 'Private Group not found in this company.' }) };
  const role = String(membership.role_in_company ?? '').trim().toLowerCase();
  if (!EDIT_ROLES.has(role)) return { error: respond(403, { error: 'This role cannot manage Private Group members.' }) };
  return { userId: auth.user.id, companyId };
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !id) return respond(400, { error: 'Valid companyId, targetCompanyId and group id are required.' });
  const ctx = await context(request, parsed.data.companyId, id);
  if ('error' in ctx) return ctx.error;
  if (parsed.data.targetCompanyId === ctx.companyId) return respond(400, { error: 'A company cannot add itself to its own Private Group.' });

  const { data: target, error: targetError } = await supabaseAdmin!
    .from('companies')
    .select('id,status')
    .eq('id', parsed.data.targetCompanyId)
    .maybeSingle();
  if (targetError) return respond(503, { error: 'Member company could not be verified.' });
  if (!target || String(target.status ?? '').toLowerCase() !== 'active') return respond(404, { error: 'Active member company not found.' });

  const { error } = await supabaseAdmin!
    .from('network_group_members')
    .upsert({
      group_id: id,
      company_id: parsed.data.targetCompanyId,
      added_by: ctx.userId,
    }, { onConflict: 'group_id,company_id' });
  if (error) return respond(500, { error: 'Member could not be added to the Private Group.' });
  return respond(200, { success: true });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const parsed = payloadSchema.safeParse({
    companyId: request.nextUrl.searchParams.get('companyId'),
    targetCompanyId: request.nextUrl.searchParams.get('targetCompanyId'),
  });
  if (!parsed.success || !id) return respond(400, { error: 'Valid companyId, targetCompanyId and group id are required.' });
  const ctx = await context(request, parsed.data.companyId, id);
  if ('error' in ctx) return ctx.error;

  const { error } = await supabaseAdmin!
    .from('network_group_members')
    .delete()
    .eq('group_id', id)
    .eq('company_id', parsed.data.targetCompanyId);
  if (error) return respond(500, { error: 'Member could not be removed from the Private Group.' });
  return respond(200, { success: true });
}
