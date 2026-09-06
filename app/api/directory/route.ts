import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../_lib/supabaseAdmin';
import { operationalError } from '../_lib/operationalError';
import { buildMemberReputation } from '../_lib/memberReputation';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });
const COMPANY_LIMIT = 500;
const DRIVER_LIMIT = 500;
const VEHICLE_LIMIT = 1000;
const REPUTATION_JOB_LIMIT = 5000;
const REPUTATION_INVOICE_LIMIT = 5000;

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

function vehicleServices(typeValue: unknown, hasTailLift: unknown) {
  const type = String(typeValue ?? '').trim().toLowerCase();
  const services = new Set<string>();
  if (type.includes('hiab')) services.add('Hiab');
  if (type.includes('moffett')) services.add('Moffett');
  if (type.includes('adr')) services.add('ADR');
  if (type.includes('refrigerated')) services.add('Refrigerated');
  if (type.includes('temperature')) services.add('Temperature controlled');
  if (type.includes('curtainside') || type.includes('curtainsider')) services.add('Curtainside');
  if (type.includes('flatbed')) services.add('Flatbed');
  if (hasTailLift === true || type.includes('tail_lift') || type.includes('tail lift')) services.add('Tail lift');
  return [...services];
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

  const [companiesResult, driversResult, vehiclesResult, reputationJobsResult, reputationInvoicesResult] = await Promise.all([
    supabaseAdmin
      .from('companies')
      .select('id, name, company_number, phone, company_type, status, created_at, city, postcode, country')
      .eq('status', 'active')
      .order('name', { ascending: true })
      .limit(COMPANY_LIMIT),
    supabaseAdmin
      .from('drivers')
      .select('id, company_id, display_name, status, availability_status')
      .eq('status', 'active')
      .order('display_name', { ascending: true })
      .limit(DRIVER_LIMIT),
    supabaseAdmin
      .from('vehicles')
      .select('id, company_id, assigned_driver_id, type, has_tail_lift, pallets_capacity')
      .limit(VEHICLE_LIMIT),
    supabaseAdmin
      .from('jobs')
      .select('awarded_carrier_company_id, status, delivery_datetime, delivered_at, completed_at')
      .not('awarded_carrier_company_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(REPUTATION_JOB_LIMIT),
    supabaseAdmin
      .from('invoices')
      .select('id, buyer_company_id, amount, due_date, status, payment_status')
      .not('buyer_company_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(REPUTATION_INVOICE_LIMIT),
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
    vehicleTypes: [] as string[],
    specialistServices: [] as string[],
    maxPallets: null as number | null,
    deliveryReliability: { score: null as number | null, evidenceCount: 0, completedJobs: 0 },
    paymentReliability: { score: null as number | null, evidenceCount: 0, onTimePaid: 0, latePaid: 0, overdueOpen: 0 },
  }));
  const companyById = new Map(companies.map((company) => [company.companyId, company]));
  const vehicleByDriver = new Map<string, { id: string; type: string | null; hasTailLift: boolean; palletsCapacity: number | null; specialistServices: string[] }>();
  const companyVehicleTypes = new Map<string, Set<string>>();
  const companyServices = new Map<string, Set<string>>();
  const companyMaxPallets = new Map<string, number>();
  if (!vehiclesResult.error) {
    for (const vehicle of vehiclesResult.data ?? []) {
      const services = vehicleServices(vehicle.type, vehicle.has_tail_lift);
      const capacity = typeof vehicle.pallets_capacity === 'number' && Number.isFinite(vehicle.pallets_capacity)
        ? vehicle.pallets_capacity
        : null;
      if (vehicle.assigned_driver_id && !vehicleByDriver.has(vehicle.assigned_driver_id)) {
        vehicleByDriver.set(vehicle.assigned_driver_id, {
          id: vehicle.id,
          type: vehicle.type ?? null,
          hasTailLift: vehicle.has_tail_lift === true,
          palletsCapacity: capacity,
          specialistServices: services,
        });
      }
      if (vehicle.company_id) {
        const types = companyVehicleTypes.get(vehicle.company_id) ?? new Set<string>();
        if (vehicle.type) types.add(String(vehicle.type));
        companyVehicleTypes.set(vehicle.company_id, types);
        const serviceSet = companyServices.get(vehicle.company_id) ?? new Set<string>();
        services.forEach((service) => serviceSet.add(service));
        companyServices.set(vehicle.company_id, serviceSet);
        if (capacity != null) companyMaxPallets.set(vehicle.company_id, Math.max(companyMaxPallets.get(vehicle.company_id) ?? 0, capacity));
      }
    }
    for (const company of companies) {
      company.vehicleTypes = [...(companyVehicleTypes.get(company.companyId) ?? new Set<string>())].sort();
      company.specialistServices = [...(companyServices.get(company.companyId) ?? new Set<string>())].sort();
      company.maxPallets = companyMaxPallets.get(company.companyId) ?? null;
    }
  }

  let reputationPartial = Boolean(reputationJobsResult.error || reputationInvoicesResult.error);
  if (!reputationJobsResult.error && !reputationInvoicesResult.error) {
    const invoiceIds = (reputationInvoicesResult.data ?? []).map((invoice) => String(invoice.id));
    const paymentRows: Array<{ invoice_id?: string | null; amount?: number | string | null; paid_at?: string | null; created_at?: string | null }> = [];
    for (let offset = 0; offset < invoiceIds.length; offset += 250) {
      const ids = invoiceIds.slice(offset, offset + 250);
      if (!ids.length) continue;
      const paymentResult = await supabaseAdmin
        .from('invoice_payment_history')
        .select('invoice_id, amount, paid_at, created_at')
        .in('invoice_id', ids)
        .limit(4000);
      if (paymentResult.error) { reputationPartial = true; break; }
      paymentRows.push(...(paymentResult.data ?? []));
    }
    if (!reputationPartial) {
      const reputationByCompany = buildMemberReputation(
        companies.map((company) => company.companyId),
        reputationJobsResult.data ?? [],
        reputationInvoicesResult.data ?? [],
        paymentRows,
      );
      for (const company of companies) {
        const reputation = reputationByCompany.get(company.companyId);
        if (!reputation) continue;
        company.deliveryReliability = reputation.delivery;
        company.paymentReliability = reputation.payment;
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
        hasTailLift: vehicle?.hasTailLift ?? false,
        palletsCapacity: vehicle?.palletsCapacity ?? null,
        specialistServices: vehicle?.specialistServices ?? [],
        deliveryReliability: company?.deliveryReliability ?? { score: null, evidenceCount: 0, completedJobs: 0 },
        paymentReliability: company?.paymentReliability ?? { score: null, evidenceCount: 0, onTimePaid: 0, latePaid: 0, overdueOpen: 0 },
      };
    })
    .filter(Boolean);

  const companiesMayBeTruncated = (companiesResult.data?.length ?? 0) >= COMPANY_LIMIT;
  const driversMayBeTruncated = (driversResult.data?.length ?? 0) >= DRIVER_LIMIT;
  const vehicleEnrichmentMayBeTruncated = (vehiclesResult.data?.length ?? 0) >= VEHICLE_LIMIT;
  const reputationJobsMayBeTruncated = (reputationJobsResult.data?.length ?? 0) >= REPUTATION_JOB_LIMIT;
  const reputationInvoicesMayBeTruncated = (reputationInvoicesResult.data?.length ?? 0) >= REPUTATION_INVOICE_LIMIT;
  reputationPartial = reputationPartial || reputationJobsMayBeTruncated || reputationInvoicesMayBeTruncated;

  return respond(200, {
    companies,
    drivers,
    partial: Boolean(
      driversResult.error
      || vehiclesResult.error
      || companiesMayBeTruncated
      || driversMayBeTruncated
      || vehicleEnrichmentMayBeTruncated
      || reputationPartial
    ),
    truncation: {
      companies: companiesMayBeTruncated,
      drivers: driversMayBeTruncated,
      vehicleEnrichment: vehicleEnrichmentMayBeTruncated,
      reputation: reputationPartial,
      limits: { companies: COMPANY_LIMIT, drivers: DRIVER_LIMIT, vehicles: VEHICLE_LIMIT, reputationJobs: REPUTATION_JOB_LIMIT, reputationInvoices: REPUTATION_INVOICE_LIMIT },
    },
    generatedAt: new Date().toISOString(),
    reputation: 'Delivery reliability uses actual delivered/completed timestamps versus planned delivery time. Payment reliability uses recorded settlement history and overdue unpaid invoices. Generic legacy reviews are not relabelled as Delivery or Payment feedback.',
    privacy: 'Business-facing member identity and declared fleet capability only. No home address, personal email, private phone, exact live location or compliance document URL is exposed.',
  });
}
