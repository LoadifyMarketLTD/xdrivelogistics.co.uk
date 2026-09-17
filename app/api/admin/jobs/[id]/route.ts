import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isCompanyAdminContext, requireCompanyAdmin } from '../../_lib/requireCompanyAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const respond = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

const schema = z.object({
  companyId: z.string().uuid(),
  expectedUpdatedAt: z.string().min(1),
  clientName: z.string().trim().min(1).max(300),
  clientEmail: z.string().trim().email().max(320).nullable().optional(),
  clientPhone: z.string().trim().max(100).nullable().optional(),
  specialRequirements: z.string().trim().max(4000).nullable().optional(),
  pickupLocation: z.string().trim().min(3).max(1000),
  pickupDateTime: z.string().trim().nullable().optional(),
  deliveryLocation: z.string().trim().min(3).max(1000),
  deliveryDateTime: z.string().trim().nullable().optional(),
  cargoType: z.string().trim().min(1).max(100),
  items: z.number().int().nonnegative(),
  distanceMiles: z.number().nonnegative().finite().nullable().optional(),
});
const nullable = (value: string | null | undefined) => {
  const normalized = value?.trim() ?? '';
  return normalized || null;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Job editing is temporarily unavailable.' });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return respond(400, { error: 'Job details are invalid.' });

  const admin = await requireCompanyAdmin(request, parsed.data.companyId);
  if (!isCompanyAdminContext(admin)) return admin;

  const { id } = await params;
  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, company_id, status, current_status, awarded_carrier_company_id, assigned_company_id, assigned_driver_id, vehicle_id, updated_at')
    .eq('id', id)
    .maybeSingle();
  if (jobError) return respond(500, { error: 'Job could not be loaded.' });
  if (!job) return respond(404, { error: 'Job not found.' });
  if (String(job.company_id) !== admin.companyId) {
    return respond(403, { error: 'Only the load-owning company can edit these job details.' });
  }

  const status = String(job.current_status ?? job.status ?? '').trim().toLowerCase();
  const hasAllocation = Boolean(
    job.awarded_carrier_company_id || job.assigned_company_id || job.assigned_driver_id || job.vehicle_id,
  );
  if (hasAllocation || !['draft', 'received', 'posted'].includes(status)) {
    return respond(409, {
      error: 'Commercial or route details cannot be changed after award, allocation or execution has started.',
    });
  }
  if (String(job.updated_at ?? '') !== parsed.data.expectedUpdatedAt) {
    return respond(409, { error: 'The job changed while you were editing it. Refresh before saving.' });
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await supabaseAdmin
    .from('jobs')
    .update({
      client_name: parsed.data.clientName,
      client_email: nullable(parsed.data.clientEmail),
      client_phone: nullable(parsed.data.clientPhone),
      special_requirements: nullable(parsed.data.specialRequirements),
      pickup_location: parsed.data.pickupLocation,
      pickup_datetime: nullable(parsed.data.pickupDateTime),
      delivery_location: parsed.data.deliveryLocation,
      delivery_datetime: nullable(parsed.data.deliveryDateTime),
      cargo_type: parsed.data.cargoType.toLowerCase(),
      items: parsed.data.items,
      job_distance_miles: parsed.data.distanceMiles ?? null,
      updated_at: now,
    })
    .eq('id', id)
    .eq('company_id', admin.companyId)
    .eq('updated_at', parsed.data.expectedUpdatedAt)
    .select('id, status, current_status, assigned_driver_id, updated_at')
    .maybeSingle();

  if (updateError) return respond(500, { error: 'Job could not be updated.' });
  if (!updated) {
    return respond(409, { error: 'The job changed while the edit was being saved. Refresh and retry.' });
  }

  return respond(200, { success: true, job: updated });
}
