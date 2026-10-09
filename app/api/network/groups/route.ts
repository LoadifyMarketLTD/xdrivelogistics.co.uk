import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

const companySchema = z.string().uuid();
const createSchema = z.object({
  companyId: companySchema,
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional().nullable(),
  allowLoadVisibility: z.boolean().default(true),
  allowAvailabilityVisibility: z.boolean().default(true),
});
const updateSchema = z.object({
  companyId: companySchema,
  groupId: z.string().uuid(),
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  allowLoadVisibility: z.boolean().optional(),
  allowAvailabilityVisibility: z.boolean().optional(),
});
const deleteSchema = z.object({ companyId: companySchema, groupId: z.string().uuid() });

const EDIT_ROLES = new Set(['owner', 'admin', 'dispatcher', 'fleet_manager']);

async function context(request: NextRequest, companyId: string, requireEdit = false) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return { error: respond(503, { error: 'Network Groups are temporarily unavailable.' }) };
  const token = getBearerToken(request);
  if (!token) return { error: respond(401, { error: 'Missing bearer token.' }) };
  const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !auth.user) return { error: respond(401, { error: 'Invalid session.' }) };
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('role_in_company')
    .eq('company_id', companyId)
    .eq('user_id', auth.user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (membershipError) return { error: respond(503, { error: 'Company access could not be verified.' }) };
  if (!membership) return { error: respond(403, { error: 'You do not have access to this company network.' }) };
  const role = String(membership.role_in_company ?? '').trim().toLowerCase();
  if (requireEdit && !EDIT_ROLES.has(role)) return { error: respond(403, { error: 'This role cannot manage Private Groups.' }) };
  return { userId: auth.user.id, companyId, role };
}

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get('companyId')?.trim() ?? '';
  if (!companySchema.safeParse(companyId).success) return respond(400, { error: 'Valid companyId is required.' });
  const ctx = await context(request, companyId);
  if ('error' in ctx) return ctx.error;

  const { data: groups, error: groupsError } = await supabaseAdmin!
    .from('network_groups')
    .select('id,owner_company_id,name,description,allow_load_visibility,allow_availability_visibility,created_at,updated_at')
    .eq('owner_company_id', companyId)
    .order('name', { ascending: true });
  if (groupsError) return respond(500, { error: 'Private Groups could not be loaded.' });

  const groupIds = (groups ?? []).map((group) => group.id);
  const { data: members, error: membersError } = groupIds.length
    ? await supabaseAdmin!.from('network_group_members').select('group_id,company_id,created_at').in('group_id', groupIds)
    : { data: [], error: null };
  if (membersError) return respond(500, { error: 'Private Group members could not be loaded.' });

  const companyIds = [...new Set((members ?? []).map((row) => row.company_id).filter(Boolean))];
  const { data: companies, error: companyError } = companyIds.length
    ? await supabaseAdmin!.from('companies').select('id,name,xd_id,company_type').in('id', companyIds)
    : { data: [], error: null };
  if (companyError) return respond(500, { error: 'Private Group member profiles could not be loaded.' });

  const companyById = new Map((companies ?? []).map((company) => [company.id, company]));
  const membersByGroup = new Map<string, Array<Record<string, unknown>>>();
  for (const row of members ?? []) {
    const company = companyById.get(row.company_id);
    const list = membersByGroup.get(row.group_id) ?? [];
    list.push({
      companyId: row.company_id,
      companyName: company?.name ?? 'Member',
      memberId: company?.xd_id ?? null,
      companyType: company?.company_type ?? null,
      createdAt: row.created_at,
    });
    membersByGroup.set(row.group_id, list);
  }

  return respond(200, {
    groups: (groups ?? []).map((group) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      allowLoadVisibility: group.allow_load_visibility,
      allowAvailabilityVisibility: group.allow_availability_visibility,
      createdAt: group.created_at,
      updatedAt: group.updated_at,
      members: membersByGroup.get(group.id) ?? [],
    })),
    canManage: EDIT_ROLES.has(ctx.role),
  });
}

export async function POST(request: NextRequest) {
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return respond(400, { error: 'Invalid Private Group payload.' });
  const ctx = await context(request, parsed.data.companyId, true);
  if ('error' in ctx) return ctx.error;

  const { data, error } = await supabaseAdmin!
    .from('network_groups')
    .insert({
      owner_company_id: ctx.companyId,
      name: parsed.data.name,
      description: parsed.data.description?.trim() || null,
      allow_load_visibility: parsed.data.allowLoadVisibility,
      allow_availability_visibility: parsed.data.allowAvailabilityVisibility,
      created_by: ctx.userId,
    })
    .select('id,name,description,allow_load_visibility,allow_availability_visibility,created_at,updated_at')
    .single();
  if (error) {
    if (String(error.code ?? '') === '23505') return respond(409, { error: 'A Private Group with this name already exists.' });
    return respond(500, { error: 'Private Group could not be created.' });
  }
  return respond(201, { group: data });
}

export async function PATCH(request: NextRequest) {
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return respond(400, { error: 'Invalid Private Group update.' });
  const ctx = await context(request, parsed.data.companyId, true);
  if ('error' in ctx) return ctx.error;

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.name !== undefined) update.name = parsed.data.name;
  if (parsed.data.description !== undefined) update.description = parsed.data.description?.trim() || null;
  if (parsed.data.allowLoadVisibility !== undefined) update.allow_load_visibility = parsed.data.allowLoadVisibility;
  if (parsed.data.allowAvailabilityVisibility !== undefined) update.allow_availability_visibility = parsed.data.allowAvailabilityVisibility;

  const { data, error } = await supabaseAdmin!
    .from('network_groups')
    .update(update)
    .eq('id', parsed.data.groupId)
    .eq('owner_company_id', ctx.companyId)
    .select('id,name,description,allow_load_visibility,allow_availability_visibility,created_at,updated_at')
    .maybeSingle();
  if (error) return respond(500, { error: 'Private Group could not be updated.' });
  if (!data) return respond(404, { error: 'Private Group not found.' });
  return respond(200, { group: data });
}

export async function DELETE(request: NextRequest) {
  const parsed = deleteSchema.safeParse({
    companyId: request.nextUrl.searchParams.get('companyId'),
    groupId: request.nextUrl.searchParams.get('groupId'),
  });
  if (!parsed.success) return respond(400, { error: 'Valid companyId and groupId are required.' });
  const ctx = await context(request, parsed.data.companyId, true);
  if ('error' in ctx) return ctx.error;

  const { error } = await supabaseAdmin!
    .from('network_groups')
    .delete()
    .eq('id', parsed.data.groupId)
    .eq('owner_company_id', ctx.companyId);
  if (error) return respond(500, { error: 'Private Group could not be deleted.' });
  return respond(200, { success: true });
}
