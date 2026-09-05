import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { verifyPlatformOwner } from '../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

const parsePage = (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '50') || 50));
  return { page, limit, offset: (page - 1) * limit };
};

const pagination = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
  hasNextPage: page * limit < total,
  hasPrevPage: page > 1,
});

const loadCompanyMap = async (ids: Array<string | null | undefined>) => {
  if (!supabaseAdmin) return { map: new Map<string, { name: string; status: string | null }>(), error: null as string | null };
  const unique = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
  if (unique.length === 0) return { map: new Map<string, { name: string; status: string | null }>(), error: null as string | null };
  const { data, error } = await supabaseAdmin.from('companies').select('id, name, status').in('id', unique);
  if (error) return { map: new Map<string, { name: string; status: string | null }>(), error: error.message };
  return {
    map: new Map((data ?? []).map((row) => [String(row.id), { name: String(row.name ?? 'Unknown company'), status: row.status as string | null }])),
    error: null as string | null,
  };
};

const loadProfileMap = async (ids: Array<string | null | undefined>) => {
  if (!supabaseAdmin) return { map: new Map<string, { name: string | null; role: string | null; status: string | null }>(), error: null as string | null };
  const unique = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
  if (unique.length === 0) return { map: new Map<string, { name: string | null; role: string | null; status: string | null }>(), error: null as string | null };
  const { data, error } = await supabaseAdmin.from('profiles').select('user_id, full_name, role, status').in('user_id', unique);
  if (error) return { map: new Map<string, { name: string | null; role: string | null; status: string | null }>(), error: error.message };
  return {
    map: new Map((data ?? []).map((row) => [String(row.user_id), { name: row.full_name as string | null, role: row.role as string | null, status: row.status as string | null }])),
    error: null as string | null,
  };
};

const loadAuthEmailMap = async (ids: Array<string | null | undefined>) => {
  const map = new Map<string, string | null>();
  if (!supabaseAdmin) return map;
  const unique = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
  const rows = await Promise.all(unique.map(async (id) => {
    const { data, error } = await supabaseAdmin!.auth.admin.getUserById(id);
    return [id, error ? null : data.user?.email ?? null] as const;
  }));
  for (const [id, email] of rows) map.set(id, email);
  return map;
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const { searchParams } = new URL(request.url);
  const section = (searchParams.get('section') ?? '').trim().toLowerCase();
  const { page, limit, offset } = parsePage(request);

  if (section === 'vehicles') {
    const { data, error, count } = await supabaseAdmin
      .from('vehicles')
      .select('id, company_id, assigned_driver_id, reg, registration, reg_plate, type, vehicle_type, make, model, status, current_status, is_available, is_tracked, last_tracked_at, international_work_approved, has_tail_lift, pallets_capacity, payload_kg, capacity_kg, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) return respond(500, { error: error.message });
    const rows = data ?? [];
    const companyResult = await loadCompanyMap(rows.map((row) => row.company_id as string | null));
    if (companyResult.error) return respond(500, { error: companyResult.error });
    const driverIds = Array.from(new Set(rows.map((row) => row.assigned_driver_id as string | null).filter((id): id is string => Boolean(id))));
    const { data: drivers, error: driversError } = driverIds.length
      ? await supabaseAdmin.from('drivers').select('id, display_name, full_name, name, email, status').in('id', driverIds)
      : { data: [], error: null };
    if (driversError) return respond(500, { error: driversError.message });
    const driverMap = new Map((drivers ?? []).map((row) => [String(row.id), row]));
    const total = count ?? 0;
    return respond(200, {
      section,
      rows: rows.map((row) => {
        const driver = row.assigned_driver_id ? driverMap.get(String(row.assigned_driver_id)) : null;
        const company = row.company_id ? companyResult.map.get(String(row.company_id)) : null;
        return {
          ...row,
          registration_label: row.registration ?? row.reg_plate ?? row.reg ?? '—',
          vehicle_label: [row.make, row.model].filter(Boolean).join(' ') || row.vehicle_type || row.type || 'Vehicle',
          company_name: company?.name ?? '—',
          assigned_driver_name: driver ? (driver.display_name ?? driver.full_name ?? driver.name ?? driver.email ?? 'Driver') : '—',
          assigned_driver_status: driver?.status ?? null,
        };
      }),
      pagination: pagination(page, limit, total),
    });
  }

  if (section === 'return-journeys') {
    const { data, error, count } = await supabaseAdmin
      .from('return_journeys')
      .select('id, company_id, driver_id, from_location, to_location, from_postcode, to_postcode, vehicle_type, available_date, available_from, available_to, notes, status, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) return respond(500, { error: error.message });
    const rows = data ?? [];
    const companyResult = await loadCompanyMap(rows.map((row) => row.company_id as string | null));
    if (companyResult.error) return respond(500, { error: companyResult.error });
    const driverIds = Array.from(new Set(rows.map((row) => row.driver_id as string | null).filter((id): id is string => Boolean(id))));
    const { data: drivers, error: driversError } = driverIds.length
      ? await supabaseAdmin.from('drivers').select('id, display_name, full_name, name, email, phone, status').in('id', driverIds)
      : { data: [], error: null };
    if (driversError) return respond(500, { error: driversError.message });
    const driverMap = new Map((drivers ?? []).map((row) => [String(row.id), row]));
    const total = count ?? 0;
    return respond(200, {
      section,
      rows: rows.map((row) => {
        const driver = row.driver_id ? driverMap.get(String(row.driver_id)) : null;
        return {
          ...row,
          company_name: row.company_id ? companyResult.map.get(String(row.company_id))?.name ?? '—' : '—',
          driver_name: driver ? (driver.display_name ?? driver.full_name ?? driver.name ?? driver.email ?? 'Driver') : '—',
          driver_phone: driver?.phone ?? null,
          driver_status: driver?.status ?? null,
        };
      }),
      pagination: pagination(page, limit, total),
    });
  }

  if (section === 'memberships') {
    const { data, error, count } = await supabaseAdmin
      .from('company_memberships')
      .select('id, company_id, user_id, invited_email, role_in_company, status, created_at, updated_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) return respond(500, { error: error.message });
    const rows = data ?? [];
    const companyResult = await loadCompanyMap(rows.map((row) => row.company_id as string | null));
    if (companyResult.error) return respond(500, { error: companyResult.error });
    const profileResult = await loadProfileMap(rows.map((row) => row.user_id as string | null));
    if (profileResult.error) return respond(500, { error: profileResult.error });
    const authEmails = await loadAuthEmailMap(rows.filter((row) => !row.invited_email).map((row) => row.user_id as string | null));
    const total = count ?? 0;
    return respond(200, {
      section,
      rows: rows.map((row) => {
        const userId = row.user_id ? String(row.user_id) : null;
        const profile = userId ? profileResult.map.get(userId) : null;
        return {
          ...row,
          company_name: row.company_id ? companyResult.map.get(String(row.company_id))?.name ?? '—' : '—',
          user_name: profile?.name ?? '—',
          user_email: row.invited_email ?? (userId ? authEmails.get(userId) : null) ?? '—',
          profile_role: profile?.role ?? null,
          profile_status: profile?.status ?? null,
        };
      }),
      pagination: pagination(page, limit, total),
    });
  }

  if (section === 'subscriptions') {
    const { data, error, count } = await supabaseAdmin
      .from('platform_membership_subscriptions')
      .select('id, user_id, company_id, plan_id, status, trial_started_at, trial_ends_at, cancel_at_period_end, current_period_end, contract_terms_version, contract_accepted_at, stripe_customer_id, stripe_subscription_id, created_at, updated_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) return respond(500, { error: error.message });
    const rows = data ?? [];
    const companyResult = await loadCompanyMap(rows.map((row) => row.company_id as string | null));
    if (companyResult.error) return respond(500, { error: companyResult.error });
    const profileResult = await loadProfileMap(rows.map((row) => row.user_id as string | null));
    if (profileResult.error) return respond(500, { error: profileResult.error });
    const authEmails = await loadAuthEmailMap(rows.map((row) => row.user_id as string | null));
    const total = count ?? 0;
    return respond(200, {
      section,
      rows: rows.map((row) => {
        const userId = row.user_id ? String(row.user_id) : null;
        return {
          ...row,
          company_name: row.company_id ? companyResult.map.get(String(row.company_id))?.name ?? '—' : '—',
          user_name: userId ? profileResult.map.get(userId)?.name ?? '—' : '—',
          user_email: userId ? authEmails.get(userId) ?? '—' : '—',
          stripe_customer_id: row.stripe_customer_id ? 'configured' : null,
          stripe_subscription_id: row.stripe_subscription_id ? 'configured' : null,
        };
      }),
      pagination: pagination(page, limit, total),
    });
  }

  if (section === 'stripe-webhooks') {
    const { data, error, count } = await supabaseAdmin
      .from('stripe_webhook_events')
      .select('stripe_event_id, event_type, connected_account_id, livemode, processing_status, error_message, received_at, processed_at', { count: 'exact' })
      .order('received_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) return respond(500, { error: error.message });
    const total = count ?? 0;
    return respond(200, {
      section,
      rows: (data ?? []).map((row) => ({
        id: row.stripe_event_id,
        stripe_event_id: row.stripe_event_id,
        event_type: row.event_type,
        livemode: row.livemode,
        processing_status: row.processing_status,
        error_message: row.error_message,
        received_at: row.received_at,
        processed_at: row.processed_at,
        connected_account: row.connected_account_id ? 'connected account' : 'platform',
      })),
      pagination: pagination(page, limit, total),
    });
  }

  if (section === 'legal-agreements') {
    const { data, error, count } = await supabaseAdmin
      .from('registration_legal_acceptances')
      .select('id, user_id, company_id, registration_role, legal_version, privacy_version, agreements, accepted_at, source, evidence_hash, created_at', { count: 'exact' })
      .order('accepted_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') {
        return respond(503, { error: 'Legal agreement evidence storage is not available in this environment.' });
      }
      return respond(500, { error: error.message });
    }
    const rows = data ?? [];
    const companyResult = await loadCompanyMap(rows.map((row) => row.company_id as string | null));
    if (companyResult.error) return respond(500, { error: companyResult.error });
    const profileResult = await loadProfileMap(rows.map((row) => row.user_id as string | null));
    if (profileResult.error) return respond(500, { error: profileResult.error });
    const authEmails = await loadAuthEmailMap(rows.map((row) => row.user_id as string | null));
    const total = count ?? 0;
    return respond(200, {
      section,
      rows: rows.map((row) => {
        const userId = row.user_id ? String(row.user_id) : null;
        const agreements = Array.isArray(row.agreements)
          ? row.agreements.flatMap((entry) => entry && typeof entry === 'object' && 'code' in entry ? [String((entry as { code?: unknown }).code ?? '')] : []).filter(Boolean)
          : [];
        return {
          id: row.id,
          user_id: row.user_id,
          company_id: row.company_id,
          registration_role: row.registration_role,
          legal_version: row.legal_version,
          privacy_version: row.privacy_version,
          agreement_codes: agreements,
          accepted_at: row.accepted_at,
          source: row.source,
          evidence_hash: row.evidence_hash,
          created_at: row.created_at,
          company_name: row.company_id ? companyResult.map.get(String(row.company_id))?.name ?? '—' : '—',
          user_name: userId ? profileResult.map.get(userId)?.name ?? '—' : '—',
          user_email: userId ? authEmails.get(userId) ?? '—' : '—',
        };
      }),
      pagination: pagination(page, limit, total),
    });
  }

  return respond(400, {
    error: 'Invalid section. Use vehicles, return-journeys, memberships, subscriptions, stripe-webhooks, or legal-agreements.',
  });
}
