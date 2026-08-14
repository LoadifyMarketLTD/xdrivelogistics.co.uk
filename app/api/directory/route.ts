import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../_lib/supabaseAdmin';
import { operationalError } from '../_lib/operationalError';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function memberType(value: unknown) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return 'Member';
  if (raw.includes('broker')) return 'Broker';
  if (raw.includes('owner_driver') || raw.includes('owner driver')) return 'Owner Driver';
  if (raw.includes('carrier') || raw.includes('fleet') || raw.includes('courier')) return 'Carrier / Fleet';
  if (raw.includes('customer') || raw.includes('shipper')) return 'Customer / Shipper';
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return operationalError({
      status: 503,
      message: 'Member Directory is temporarily unavailable.',
      context: 'directory.config',
      retryable: true,
    });
  }

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Unauthorized.' });
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return respond(401, { error: 'Unauthorized.' });

  const [membershipResult, driverResult] = await Promise.all([
    supabaseAdmin
      .from('company_memberships')
      .select('company_id, status')
      .eq('user_id', authData.user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('drivers')
      .select('id, status, is_active, app_access')
      .eq('user_id', authData.user.id)
      .maybeSingle(),
  ]);

  if (membershipResult.error || driverResult.error) {
    return operationalError({
      status: 500,
      message: 'Your Directory access could not be verified.',
      context: `directory.viewer:${authData.user.id}`,
      cause: membershipResult.error ?? driverResult.error,
      retryable: true,
    });
  }

  const driverStatus = String(driverResult.data?.status ?? '').trim().toLowerCase();
  const activeDriver = Boolean(driverResult.data)
    && driverStatus === 'active'
    && driverResult.data?.is_active !== false
    && driverResult.data?.app_access === true;
  if (!membershipResult.data && !activeDriver) {
    return respond(403, { error: 'An active XDrive member account is required to use Directory.' });
  }

  const [companiesResult, driversResult, vehiclesResult] = await Promise.all([
    supabaseAdmin
      .from('companies')
      .select('id, name, company_number, phone, company_type, status, created_at, city, postcode, country')
      .eq('status', 'active')
      .order('name', { ascending: true })
      .limit(500),
    supabaseAdmin
      .from('drivers')
      .select('id, company_id, display_name, status, availability_status')
      .eq('status', 'active')
      .order('display_name', { ascending: true })
      .limit(500),
    supabaseAdmin
      .from('vehicles')
      .select('id, assigned_driver_id, type')
      .not('assigned_driver_id', 'is', null)
      .limit(1000),
  ]);

  if (companiesResult.error) {
    return operationalError({
      status: 500,
      message: 'Directory companies could not be loaded.',
      context: 'directory.companies',
      cause: companiesResult.error,
      retryable: true,
    });
  }

  const companies = (companiesResult.data ?? []).map((company) => ({
    companyId: company.id,
    name: company.name,
    memberId: company.company_number ?? null,
    businessPhone: company.phone ?? null,
    memberType: memberType(company.company_type),
    memberSince: company.created_at ?? null,
    city: company.city ?? null,
    postcode: company.postcode ?? null,
    country: company.country ?? null,
  }));
  const companyById = new Map(companies.map((company) => [company.companyId, company]));
  const vehicleByDriver = new Map<string, { id: string; type: string | null }>();
  if (!vehiclesResult.error) {
    for (const vehicle of vehiclesResult.data ?? []) {
      if (vehicle.assigned_driver_id && !vehicleByDriver.has(vehicle.assigned_driver_id)) {
        vehicleByDriver.set(vehicle.assigned_driver_id, { id: vehicle.id, type: vehicle.type ?? null });
      }
    }
  }

  const drivers = driversResult.error ? [] : (driversResult.data ?? [])
    .map((driver) => {
      const company = driver.company_id ? companyById.get(driver.company_id) ?? null : null;
      if (driver.company_id && !company) return null;
      const vehicle = vehicleByDriver.get(driver.id) ?? null;
      return {
        driverId: driver.id,
        displayName: text(driver.display_name) ?? 'Driver',
        companyId: driver.company_id ?? null,
        companyName: company?.name ?? 'Independent driver',
        memberId: company?.memberId ?? null,
        memberType: company?.memberType ?? 'Owner Driver',
        businessPhone: company?.businessPhone ?? null,
        city: company?.city ?? null,
        postcode: company?.postcode ?? null,
        country: company?.country ?? null,
        availability: driver.availability_status ?? null,
        vehicleType: vehicle?.type ?? null,
      };
    })
    .filter(Boolean);

  return respond(200, {
    companies,
    drivers,
    partial: Boolean(driversResult.error || vehiclesResult.error),
    generatedAt: new Date().toISOString(),
    privacy: 'Business-facing member identity only. No home address, personal email, private phone, exact live location or compliance document URL is exposed.',
  });
}
