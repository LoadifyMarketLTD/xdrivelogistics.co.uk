import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isWebDriverContext, requireActiveWebDriver } from '../../_lib/webDriverContext';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

const JOB_SELECT =
  'id, company_id, status, current_status, assigned_driver_id, pickup_location, pickup_postcode, delivery_location, delivery_postcode, pickup_datetime, delivery_datetime, collection_window_start, delivery_window_start, deadline_at, vehicle_type, requested_vehicle_label, cargo_type, requested_cargo_label, weight_kg, pallets, length_cm, width_cm, height_cm, cargo_value_gbp, load_details, load_notes, collection_notes, delivery_notes, driver_notes, collection_contact_name, collection_contact_phone, delivery_contact_name, delivery_contact_phone, purchase_order_number, special_requirements, access_restrictions, document_checklist, hard_copy_pod, pod_required, pod_generated, pod_generated_at, pod_photos, delivery_photos, delivery_signature_data, client_signature_name, status_history, feedback_status, broker_pod_review_status, broker_pod_review_note, updated_at, created_at, customer_reference, booking_reference, assigned_company_id, awarded_carrier_company_id, companies:companies!jobs_company_id_fkey(name)';

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Driver workspace is temporarily unavailable.' });
  }

  const driver = await requireActiveWebDriver(request);
  if (!isWebDriverContext(driver)) return driver;
  if (!driver.companyId) return respond(403, { error: 'Company context required.' });

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('role_in_company')
    .eq('company_id', driver.companyId)
    .eq('user_id', driver.userId)
    .eq('status', 'active')
    .maybeSingle();

  if (membershipError) return respond(500, { error: 'Company access could not be verified.' });
  const role = String(membership?.role_in_company ?? '').trim().toLowerCase();
  if (!['owner', 'admin'].includes(role)) {
    return respond(403, { error: 'Company owner or admin access is required for Company Diary.' });
  }

  const { data: jobs, error: jobsError } = await supabaseAdmin
    .from('jobs')
    .select(JOB_SELECT)
    .or(`company_id.eq.${driver.companyId},assigned_company_id.eq.${driver.companyId},awarded_carrier_company_id.eq.${driver.companyId}`)
    .order('updated_at', { ascending: false })
    .limit(250);

  if (jobsError) return respond(500, { error: 'Company Diary jobs could not be loaded.' });

  const rows = jobs ?? [];
  const jobIds = rows.map((job) => String(job.id)).filter(Boolean);
  if (!jobIds.length) return respond(200, { jobs: [], reviews: [] });

  const { data: reviews, error: reviewsError } = await supabaseAdmin
    .from('reviews')
    .select('id, job_id, rating, comment, created_at')
    .in('job_id', jobIds)
    .order('created_at', { ascending: false });

  if (reviewsError) {
    return respond(200, {
      jobs: rows,
      reviews: [],
      warning: 'Feedback records are temporarily unavailable.',
    });
  }

  return respond(200, { jobs: rows, reviews: reviews ?? [] });
}
