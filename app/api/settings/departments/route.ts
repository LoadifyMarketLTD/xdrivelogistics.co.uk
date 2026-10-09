import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { supabaseAdmin } from '../../_lib/supabaseAdmin';
import { isCompanyCapabilityContext, requireCompanyCapability } from '../../admin/_lib/requireCompanyCapability';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

const createSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional().nullable(),
});

const updateSchema = z.object({
  companyId: z.string().uuid(),
  departmentId: z.string().uuid(),
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(500).optional().nullable(),
});

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get('companyId')?.trim() ?? '';
  const auth = await requireCompanyCapability(request, companyId, 'company.members.manage');
  if (!isCompanyCapabilityContext(auth)) return auth;
  const { data, error } = await supabaseAdmin!
    .from('company_departments')
    .select('id,name,description,created_at,updated_at')
    .eq('company_id', companyId)
    .order('name', { ascending: true });
  if (error) return json(500, { error: 'Departments could not be loaded.' });
  return json(200, { departments: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return json(400, { error: 'Invalid department payload.' });
  const auth = await requireCompanyCapability(request, parsed.data.companyId, 'company.members.manage');
  if (!isCompanyCapabilityContext(auth)) return auth;
  const { data, error } = await supabaseAdmin!
    .rpc('manage_company_department', {
      p_company_id: parsed.data.companyId,
      p_actor_user_id: auth.userId,
      p_action: 'create',
      p_department_id: null,
      p_name: parsed.data.name,
      p_description: parsed.data.description?.trim() || null,
    })
    .single();
  if (error) return json(error.code === '23505' ? 409 : 500, { error: error.code === '23505' ? 'A department with this name already exists.' : 'Department could not be created.' });
  return json(201, { department: data });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return json(400, { error: 'Invalid department update.' });
  const auth = await requireCompanyCapability(request, parsed.data.companyId, 'company.members.manage');
  if (!isCompanyCapabilityContext(auth)) return auth;
  const { data, error } = await supabaseAdmin!
    .rpc('manage_company_department', {
      p_company_id: parsed.data.companyId,
      p_actor_user_id: auth.userId,
      p_action: 'update',
      p_department_id: parsed.data.departmentId,
      p_name: parsed.data.name ?? null,
      p_description: parsed.data.description ?? null,
    })
    .maybeSingle();
  if (error) return json(error.code === '23505' ? 409 : 500, { error: error.code === '23505' ? 'A department with this name already exists.' : 'Department could not be updated.' });
  if (!data) return json(404, { error: 'Department not found.' });
  return json(200, { department: data });
}

export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = z.object({ companyId: z.string().uuid(), departmentId: z.string().uuid() }).safeParse(body);
  if (!parsed.success) return json(400, { error: 'Invalid department delete request.' });
  const auth = await requireCompanyCapability(request, parsed.data.companyId, 'company.members.manage');
  if (!isCompanyCapabilityContext(auth)) return auth;
  const { error } = await supabaseAdmin!
    .rpc('manage_company_department', {
      p_company_id: parsed.data.companyId,
      p_actor_user_id: auth.userId,
      p_action: 'delete',
      p_department_id: parsed.data.departmentId,
      p_name: null,
      p_description: null,
    });
  if (error) {
    if (error.code === '23514') return json(409, { error: 'Move members out of this department before deleting it.' });
    if (error.code === 'P0002') return json(404, { error: 'Department not found.' });
    return json(500, { error: 'Department could not be deleted.' });
  }
  return json(200, { deleted: true });
}
