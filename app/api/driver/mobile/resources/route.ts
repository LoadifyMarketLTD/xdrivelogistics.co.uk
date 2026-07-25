import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import { supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isDriverContext, requireDriver } from '../_lib';

type AnyRow = Record<string, unknown>;

function publicArea(postcode: unknown) {
  const value = String(postcode ?? '').trim().toUpperCase();
  return value ? `Approx. area · ${value.split(/\s+/)[0]}` : 'Area disclosed after allocation';
}

function sanitizeQuoteJob(row: AnyRow, driverId: string, company?: AnyRow | null) {
  const privateDetailsRevealed = String(row.assigned_driver_id ?? '') === driverId
    && ['allocated', 'collected', 'in_transit', 'delivered'].includes(String(row.status ?? '').toLowerCase());
  const fixedPriceVisible = row.is_fixed_price === true && Number(row.budget_amount ?? 0) > 0;
  return {
    ...row,
    public_reference: `XDL-${String(row.id ?? '').slice(0, 8).toUpperCase()}`,
    posting_company_name: company?.name ?? row.booked_by_company_name ?? null,
    posting_company_member_code: company?.company_number ?? null,
    pickup_location: privateDetailsRevealed ? row.pickup_location : publicArea(row.pickup_postcode),
    delivery_location: privateDetailsRevealed ? row.delivery_location : publicArea(row.delivery_postcode),
    collection_contact_name: privateDetailsRevealed ? row.collection_contact_name : null,
    collection_contact_phone: privateDetailsRevealed ? row.collection_contact_phone : null,
    delivery_contact_name: privateDetailsRevealed ? row.delivery_contact_name : null,
    delivery_contact_phone: privateDetailsRevealed ? row.delivery_contact_phone : null,
    client_name: privateDetailsRevealed ? row.client_name : null,
    client_phone: privateDetailsRevealed ? row.client_phone : null,
    load_details: privateDetailsRevealed ? row.load_details : null,
    special_requirements: privateDetailsRevealed ? row.special_requirements : null,
    access_restrictions: privateDetailsRevealed ? row.access_restrictions : null,
    budget_amount: fixedPriceVisible ? row.budget_amount : null,
    private_details_revealed: privateDetailsRevealed,
    can_update_lifecycle: privateDetailsRevealed && String(row.status ?? '').toLowerCase() !== 'delivered',
  };
}

export async function GET(request: NextRequest) {
  const context = await requireDriver(request);
  if (!isDriverContext(context)) return context;

  const [driverResult, bidsResult, documentsResult, invoicesResult, alertsResult] = await Promise.all([
    supabaseAdmin!.from('drivers').select('*').eq('id', context.driverId).maybeSingle(),
    supabaseAdmin!.from('job_bids').select('*').or(`bidder_user_id.eq.${context.userId},bidder_driver_id.eq.${context.driverId}`).order('created_at', { ascending: false }).limit(100),
    supabaseAdmin!.from('driver_documents').select('*').eq('driver_id', context.driverId).order('created_at', { ascending: false }).limit(100),
    supabaseAdmin!.from('invoices').select('*').eq('created_by', context.userId).order('created_at', { ascending: false }).limit(100),
    supabaseAdmin!.from('notification_events').select('id,event_type,entity_type,entity_id,payload,status,created_at').eq('recipient_user_id', context.userId).order('created_at', { ascending: false }).limit(100),
  ]);

  const firstError = driverResult.error ?? bidsResult.error ?? documentsResult.error ?? invoicesResult.error ?? alertsResult.error;
  if (firstError) return NextResponse.json({ error: firstError.message }, { status: 500 });

  const driver = (driverResult.data ?? null) as AnyRow | null;
  const bids = (bidsResult.data ?? []) as AnyRow[];
  const jobIds = [...new Set(bids.map((bid) => String(bid.job_id ?? '')).filter(Boolean))];
  const jobsResult = jobIds.length > 0
    ? await supabaseAdmin!.from('jobs').select('*').in('id', jobIds)
    : { data: [], error: null };
  if (jobsResult.error) return NextResponse.json({ error: jobsResult.error.message }, { status: 500 });
  const jobs = (jobsResult.data ?? []) as AnyRow[];

  const companyIds = [...new Set([context.companyId, ...jobs.map((job) => String(job.company_id ?? '')).filter(Boolean)].filter(Boolean))];
  const companiesResult = await supabaseAdmin!.from('companies').select('id,name,company_number,company_type').in('id', companyIds);
  if (companiesResult.error) return NextResponse.json({ error: companiesResult.error.message }, { status: 500 });
  const companies = new Map(((companiesResult.data ?? []) as AnyRow[]).map((company) => [String(company.id), company]));
  const jobsById = new Map(jobs.map((job) => [String(job.id), sanitizeQuoteJob(job, context.driverId, companies.get(String(job.company_id)))]));

  const vehicleResult = context.companyId
    ? await supabaseAdmin!
        .from('vehicles')
        .select('*')
        .eq('assigned_driver_id', context.driverId)
        .eq('company_id', context.companyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null, error: null };
  if (vehicleResult.error) return NextResponse.json({ error: vehicleResult.error.message }, { status: 500 });

  const userResult = await supabaseAdmin!.auth.admin.getUserById(context.userId);
  const email = String(driver?.email ?? userResult.data.user?.email ?? '');
  return NextResponse.json({
    resources: {
      name: String(driver?.display_name ?? userResult.data.user?.user_metadata?.full_name ?? email),
      email,
      phone: String(driver?.phone ?? ''),
      driver,
      company: context.companyId ? (companies.get(context.companyId) ?? null) : null,
      vehicle: (vehicleResult.data ?? null) as AnyRow | null,
      quotes: bids.map((bid) => ({ ...bid, job: jobsById.get(String(bid.job_id)) ?? null })),
      documents: documentsResult.data ?? [],
      invoices: invoicesResult.data ?? [],
      alerts: alertsResult.data ?? [],
    },
  });
}

export async function POST(request: NextRequest) {
  const context = await requireDriver(request);
  if (!isDriverContext(context)) return context;
  if (!context.companyId) {
    return NextResponse.json({ error: 'Driver document uploads require an active company workspace.' }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as AnyRow | null;
  if (!body || String(body.action ?? '') !== 'upload_document') {
    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
  }

  const docType = String(body.docType ?? '').trim().slice(0, 100);
  const fileName = String(body.fileName ?? 'document').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 160);
  const mimeType = String(body.mimeType ?? 'application/octet-stream');
  const base64 = typeof body.base64 === 'string' ? body.base64 : '';
  if (!docType || !base64) return NextResponse.json({ error: 'Document type and file are required.' }, { status: 400 });
  if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
    return NextResponse.json({ error: 'Use a PDF, JPG, PNG or WEBP document.' }, { status: 400 });
  }
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length === 0 || bytes.length > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Document must be smaller than 10 MB.' }, { status: 400 });
  }

  const path = `${context.companyId}/${context.driverId}/${randomUUID()}-${fileName}`;
  const { error: storageError } = await supabaseAdmin!.storage.from('driver-docs').upload(path, bytes, { contentType: mimeType, upsert: false });
  if (storageError) return NextResponse.json({ error: storageError.message }, { status: 500 });
  const { error: documentError } = await supabaseAdmin!.from('driver_documents').insert({
    driver_id: context.driverId,
    doc_type: docType,
    file_path: path,
    status: 'pending',
  });
  if (documentError) {
    await supabaseAdmin!.storage.from('driver-docs').remove([path]);
    return NextResponse.json({ error: documentError.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
