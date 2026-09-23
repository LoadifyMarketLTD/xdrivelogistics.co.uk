import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';
import { operationalError } from '../../_lib/operationalError';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

function publicMemberType(value: unknown) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return 'Member';
  if (raw.includes('broker')) return 'Broker';
  if (raw.includes('owner_driver') || raw.includes('owner driver')) return 'Owner Driver';
  if (raw.includes('carrier') || raw.includes('fleet') || raw.includes('courier')) return 'Carrier / Fleet';
  if (raw.includes('customer') || raw.includes('shipper')) return 'Customer / Shipper';
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return operationalError({
      status: 503,
      message: 'Member profiles are temporarily unavailable.',
      context: 'member-profile.config',
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
      message: 'Your member access could not be verified.',
      context: `member-profile.viewer:${authData.user.id}`,
      cause: membershipResult.error ?? driverResult.error,
      retryable: true,
    });
  }

  // Driver-only viewers use the same fail-closed activation semantics as the
  // canonical driver workspace: missing status/app-access is not active.
  const driverStatus = String(driverResult.data?.status ?? '').trim().toLowerCase();
  const activeDriver = Boolean(driverResult.data)
    && driverStatus === 'active'
    && driverResult.data?.is_active !== false
    && driverResult.data?.app_access === true;
  if (!membershipResult.data && !activeDriver) {
    return respond(403, { error: 'An active XDrive workspace membership is required to view member profiles.' });
  }

  const { companyId } = await params;
  const { data: company, error: companyError } = await supabaseAdmin
    .from('companies')
    .select('id, name, xd_id, company_number, vat_number, email, phone, address_line1, address_line2, city, postcode, country, company_type, status, created_at')
    .eq('id', companyId)
    .maybeSingle();

  if (companyError) {
    return operationalError({
      status: 500,
      message: 'The member profile could not be loaded.',
      context: `member-profile.company:${companyId}`,
      cause: companyError,
      retryable: true,
    });
  }
  if (!company || String(company.status ?? '').toLowerCase() !== 'active') {
    return respond(404, { error: 'This trading member is not available.' });
  }

  const [settingsResult, vehiclesResult, licenceResult, mainContactMembershipResult] = await Promise.all([
    supabaseAdmin
      .from('company_settings')
      .select('default_payment_terms')
      .eq('company_id', companyId)
      .maybeSingle(),
    supabaseAdmin
      .from('vehicles')
      .select('type, has_tail_lift')
      .eq('company_id', companyId)
      .limit(100),
    supabaseAdmin
      .from('company_documents')
      .select('status, expiry_date')
      .eq('company_id', companyId)
      .eq('doc_type', 'operator_licence')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('company_memberships')
      .select('user_id, role_in_company')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .in('role_in_company', ['owner', 'admin'])
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  let mainContact: string | null = null;
  if (!mainContactMembershipResult.error && mainContactMembershipResult.data?.user_id) {
    const { data: contactProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('user_id', mainContactMembershipResult.data.user_id)
      .maybeSingle();
    mainContact = contactProfile?.full_name?.trim() || null;
  }

  const fleetDetails = [...new Set((vehiclesResult.data ?? []).map((vehicle) => {
    const label = String(vehicle.type ?? '').replace(/_/g, ' ');
    return vehicle.has_tail_lift ? `${label} · tail lift` : label;
  }).filter(Boolean))];

  const operatorLicence = licenceResult.error
    ? 'Unknown'
    : licenceResult.data
      ? `${String(licenceResult.data.status ?? 'unknown').replace(/_/g, ' ')}${licenceResult.data.expiry_date ? ` · expires ${licenceResult.data.expiry_date}` : ''}`
      : 'Not supplied';

  // Only business-facing member data crosses this contract. Private home
  // addresses, private user emails, driver identity/compliance evidence and
  // document URLs remain excluded.
  return respond(200, {
    member: {
      companyId: company.id,
      name: company.name,
      memberId: company.xd_id ?? null,
      businessPhone: company.phone ?? null,
      businessEmail: company.email ?? null,
      companyNumber: company.company_number ?? null,
      vatNumber: company.vat_number ?? null,
      addressLine1: company.address_line1 ?? null,
      addressLine2: company.address_line2 ?? null,
      city: company.city ?? null,
      postcode: company.postcode ?? null,
      country: company.country ?? null,
      paymentTerms: settingsResult.data?.default_payment_terms ?? null,
      fleetDetails,
      operatorLicence,
      mainContact,
      memberType: publicMemberType(company.company_type),
      memberSince: company.created_at ?? null,
      status: 'active',
    },
    sections: {
      feedback: {
        state: 'unavailable',
        message: 'Member-level feedback is not available for this company profile yet.',
      },
      users: {
        state: 'restricted',
        message: 'Internal company users are private and are not shown in Member Profile.',
      },
      specialistServices: {
        state: 'unavailable',
        message: 'Specialist services are not listed for this company profile.',
      },
      charges: {
        state: 'unavailable',
        message: 'Member-visible charge information is not available for this company profile.',
      },
      bookingFooter: {
        state: 'unavailable',
        message: 'Booking terms are not available for this company profile.',
      },
      businessDocuments: {
        state: 'restricted',
        message: 'Business document evidence is private and is not shown in Member Profile.',
      },
    },
  });
}
