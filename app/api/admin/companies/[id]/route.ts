import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isCompanyAdminContext, requireCompanyAdmin } from '../../_lib/requireCompanyAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const bodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  vat_number: z.string().trim().max(80).nullable().optional(),
  email: z.string().trim().email().max(320).nullable().optional().or(z.literal('')),
  phone: z.string().trim().max(80).nullable().optional(),
  address_line1: z.string().trim().max(300).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  postcode: z.string().trim().max(30).nullable().optional(),
});

const respond = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

const nullable = (value: string | null | undefined) => {
  const normalized = value?.trim() ?? '';
  return normalized || null;
};
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!supabaseAdmin) return respond(503, { error: 'Company management is temporarily unavailable.' });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return respond(400, { error: 'Company details are invalid.' });

  const admin = await requireCompanyAdmin(request, id);
  if (!isCompanyAdminContext(admin)) return admin;

  const { data: current, error: currentError } = await supabaseAdmin
    .from('companies')
    .select('id, company_number')
    .eq('id', admin.companyId)
    .maybeSingle();
  if (currentError) return respond(500, { error: 'The company could not be loaded.' });
  if (!current) return respond(404, { error: 'Company not found.' });

  const updatePayload = {
    name: parsed.data.name,
    vat_number: nullable(parsed.data.vat_number),
    email: nullable(parsed.data.email),
    phone: nullable(parsed.data.phone),
    address_line1: nullable(parsed.data.address_line1),
    city: nullable(parsed.data.city),
    postcode: nullable(parsed.data.postcode)?.toUpperCase() ?? null,
  };
  const { data: updated, error: updateError } = await supabaseAdmin
    .from('companies')
    .update(updatePayload)
    .eq('id', admin.companyId)
    .select('id, name, company_number, vat_number, email, phone, address_line1, city, postcode, created_at')
    .maybeSingle();

  if (updateError) return respond(500, { error: updateError.message });
  if (!updated) return respond(409, { error: 'The company changed while the update was being saved.' });

  return respond(200, {
    success: true,
    company: updated,
    identity: {
      company_number: current.company_number,
      immutable: true,
    },
  });
}
