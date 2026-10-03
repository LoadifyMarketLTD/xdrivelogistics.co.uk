import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';
import { operationalError } from '../../_lib/operationalError';
import { areCompaniesBlocked } from '../../_lib/companyBlocks';

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
      .select('id, company_id, status, is_active, app_access')
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
  const viewerCompanyId = String(membershipResult.data?.company_id ?? driverResult.data?.company_id ?? '').trim() || null;
  const blockState = await areCompaniesBlocked(supabaseAdmin, viewerCompanyId, companyId);
  if (blockState.error) {
    return operationalError({
      status: 503,
      message: 'Member block status could not be verified.',
      context: `member-profile.block:${companyId}`,
      cause: { message: blockState.error },
      retryable: true,
    });
  }
  if (blockState.blocked) return respond(404, { error: 'This trading member is not available.' });

  const { data: company, error: companyError } = await supabaseAdmin
    .from('companies')
    .select('id, name, xd_id, phone, contact_name, email, website, address_line1, address_line2, city, postcode, company_type, status, created_at')
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

  const [settingsResult, specialistResult, reviewsResult, vehiclesResult] = await Promise.all([
    supabaseAdmin
      .from('company_settings')
      .select('booking_footer,waiting_time_terms,loading_time_terms,cancellation_terms,other_charges,operator_licence_number,finance_email,secondary_phone,email_visible_to_members,default_payment_terms')
      .eq('company_id', companyId)
      .maybeSingle(),
    supabaseAdmin
      .from('company_specialist_capabilities')
      .select('capability_code,verification_required,verification_status')
      .eq('company_id', companyId)
      .order('capability_code'),
    supabaseAdmin
      .from('reviews')
      .select('id,rating,comment,created_at,reviewer_company_id')
      .eq('company_id', companyId)
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(50),
    supabaseAdmin
      .from('vehicles')
      .select('type,vehicle_type')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .limit(200),
  ]);
  if (settingsResult.error || specialistResult.error || reviewsResult.error || vehiclesResult.error) {
    return operationalError({
      status: 503,
      message: 'Member commercial profile details could not be loaded.',
      context: `member-profile.commercial:${companyId}`,
      cause: settingsResult.error ?? specialistResult.error ?? reviewsResult.error ?? vehiclesResult.error,
      retryable: true,
    });
  }

  const specialistLabels: Record<string, string> = {
    '24_hour': '24 Hour', adr: 'ADR', dgsa_qualified: 'DGSA Qualified', fors_bronze: 'FORS Bronze',
    fors_silver: 'FORS Silver', fors_gold: 'FORS Gold', frozen: 'Frozen', hanging_garment: 'GOH - Hanging Garment Transportation',
    high_security: 'High Security', installation_swapout: 'Installation & Swapout', aviation_level_ab: 'Level A / B Aviation',
    cargo_operated_level_d: 'Cargo Operated (Level D)', refrigerated_chilled: 'Refrigerated / Chilled', removals: 'Removals',
    waste_carrier: 'Waste Carrier', weee: 'WEEE', authorised_economic_operator: 'Authorised Economic Operator (AEO)', cmr: 'CMR',
  };
  const publicSpecialists = (specialistResult.data ?? [])
    .filter((row) => row.verification_required !== true || String(row.verification_status ?? '').toLowerCase() === 'verified')
    .map((row) => specialistLabels[String(row.capability_code)] ?? String(row.capability_code).replaceAll('_', ' '));
  const settings = settingsResult.data;
  const emailVisible = settings?.email_visible_to_members === true;
  const fleet = [...new Set(
    (vehiclesResult.data ?? [])
      .map((vehicle) => String(vehicle.vehicle_type ?? vehicle.type ?? '').trim())
      .filter(Boolean),
  )];
  const chargeLines = [
    settings?.waiting_time_terms ? `Waiting Time: ${settings.waiting_time_terms}` : null,
    settings?.loading_time_terms ? `Loading Time: ${settings.loading_time_terms}` : null,
    settings?.cancellation_terms ? `Cancellation: ${settings.cancellation_terms}` : null,
    settings?.other_charges ? `Other: ${settings.other_charges}` : null,
  ].filter((value): value is string => Boolean(value));
  const reviews = reviewsResult.data ?? [];
  const ratings = reviews.map((review) => Number(review.rating)).filter((rating) => Number.isFinite(rating) && rating >= 1 && rating <= 5);
  const averageRating = ratings.length ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10 : null;
  const feedbackItems = reviews.slice(0, 20).map((review) => {
    const rating = Number.isFinite(Number(review.rating)) ? `${Number(review.rating)}/5` : 'Feedback';
    const comment = String(review.comment ?? '').trim() || 'No written comment supplied.';
    const date = review.created_at ? new Date(review.created_at).toLocaleDateString('en-GB') : 'Date unavailable';
    return `${rating} · ${date} · ${comment}`;
  });

  // This endpoint is intentionally conservative. It exposes only the member's
  // business-facing identity fields. Home addresses, private emails, driver
  // identity/compliance data, document URLs and internal company settings do
  // not cross this contract.
  return respond(200, {
    member: {
      companyId: company.id,
      name: company.name,
      memberId: company.xd_id ?? null,
      businessPhone: company.phone ?? null,
      phone2: settings?.secondary_phone ?? null,
      contactName: company.contact_name ?? null,
      email: emailVisible ? company.email ?? null : null,
      email2: emailVisible ? settings?.finance_email ?? null : null,
      website: emailVisible ? company.website ?? null : null,
      postcode: company.postcode ?? null,
      fax: null,
      fleet: fleet.length ? fleet.join(', ') : null,
      operatorLicence: settings?.operator_licence_number ?? null,
      paymentTerms: settings?.default_payment_terms ?? null,
      billingAddress: {
        line1: company.address_line1 ?? null,
        line2: company.address_line2 ?? null,
        town: company.city ?? null,
        postcode: company.postcode ?? null,
      },
      feedbackLast90Days: {
        count: ratings.length,
        averageRating,
      },
      memberType: publicMemberType(company.company_type),
      memberSince: company.created_at ?? null,
      status: 'active',
    },
    sections: {
      feedback: feedbackItems.length ? {
        state: 'available',
        message: `${averageRating?.toFixed(1) ?? '—'} / 5 from ${ratings.length} verified job feedback record${ratings.length === 1 ? '' : 's'}.`,
        items: feedbackItems,
      } : {
        state: 'unavailable',
        message: 'No verified job feedback is recorded for this company yet.',
        items: [],
      },
      users: {
        state: 'restricted',
        message: 'Internal company users are private and are not shown in Member Profile.',
      },
      specialistServices: publicSpecialists.length ? {
        state: 'available',
        message: 'Declared specialist services available for member review.',
        items: publicSpecialists,
      } : {
        state: 'unavailable',
        message: 'No public specialist services are currently recorded for this company.',
        items: [],
      },
      charges: chargeLines.length ? {
        state: 'available',
        message: 'Company commercial charge defaults. Job-specific agreed terms remain authoritative.',
        items: chargeLines,
      } : {
        state: 'unavailable',
        message: 'Member-visible charge information is not recorded for this company.',
        items: [],
      },
      bookingFooter: settings?.booking_footer ? {
        state: 'available',
        message: String(settings.booking_footer),
        items: [String(settings.booking_footer)],
      } : {
        state: 'unavailable',
        message: 'Booking terms are not recorded for this company profile.',
        items: [],
      },
      businessDocuments: {
        state: 'restricted',
        message: 'Business document evidence is private and is not shown in Member Profile.',
      },
    },
  });
}
