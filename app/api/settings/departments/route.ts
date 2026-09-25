import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });
const adminRoles = new Set(['owner', 'admin']);

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

async function requireDepartmentAdmin(request: NextRequest, companyId: string) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return { error: json(503, { error: 'Departments service is unavailable.' }) };
  const token = getBearerToken(request);
  if (!token) return { error: json(401, { error: 'Your session has expired. Sign in again.' }) };
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return { error: json(401, { error: 'Your session has expired. Sign in again.' }) };
  const { data: membership, error } = await supabaseAdmin
    .from('company_memberships')
    .select('role_in_company,status')
    .eq('company_id', companyId)
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (error) return { error: json(500, { error: 'We could not verify company access.' }) };
  if (!membership || !adminRoles.has(String(membership.role_in_company ?? '').toLowerCase())) {
    return { error: json(403, { error: 'Company owner or admin access is required to manage departments.' }) };
  }
  return { userId: authData.user.id, companyId };
}

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get('companyId')?.trim() ?? '';
  const auth = await requireDepartmentAdmin(request, companyId);
  if ('error' in auth) return auth.error;
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
  const auth = await requireDepartmentAdmin(request, parsed.data.companyId);
  if ('error' in auth) return auth.error;
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
  const auth = await requireDepartmentAdmin(request, parsed.data.companyId);
  if ('error' in auth) return auth.error;
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
  const auth = await requireDepartmentAdmin(request, parsed.data.companyId);
  if ('error' in auth) return auth.error;
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
