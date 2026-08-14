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
  if (raw.includes('carrier') || raw.includes('fleet') || raw.includes('courier')) return 'Carrier / Fleet';
  if (raw.includes('owner_driver') || raw.includes('owner driver')) return 'Owner Driver';
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

  const { data: viewer, error: viewerError } = await supabaseAdmin
    .from('profiles')
    .select('status')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (viewerError) {
    return operationalError({
      status: 500,
      message: 'Your member access could not be verified.',
      context: `member-profile.viewer:${authData.user.id}`,
      cause: viewerError,
      retryable: true,
    });
  }
  if (!viewer || String(viewer.status ?? '').toLowerCase() !== 'active') {
    return respond(403, { error: 'An active XDrive account is required to view member profiles.' });
  }

  const { companyId } = await params;
  const { data: company, error: companyError } = await supabaseAdmin
    .from('companies')
    .select('id, name, company_number, phone, company_type, status, created_at')
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

  // This endpoint is intentionally conservative. It exposes only the member's
  // business-facing identity fields. Home addresses, private emails, driver
  // identity/compliance data, document URLs and internal company settings do
  // not cross this contract.
  return respond(200, {
    member: {
      companyId: company.id,
      name: company.name,
      memberId: company.company_number ?? null,
      businessPhone: company.phone ?? null,
      memberType: publicMemberType(company.company_type),
      memberSince: company.created_at ?? null,
      status: 'active',
    },
    sections: {
      feedback: {
        state: 'unavailable',
        message: 'Member-level feedback attribution is not exposed by the current verified XDrive data contract.',
      },
      users: {
        state: 'restricted',
        message: 'Internal company users are not published through the member profile contract.',
      },
      specialistServices: {
        state: 'unavailable',
        message: 'Verified specialist-service declarations are not currently exposed.',
      },
      charges: {
        state: 'unavailable',
        message: 'Member charge cards are not currently exposed as a verified public-to-members dataset.',
      },
      bookingFooter: {
        state: 'unavailable',
        message: 'Member booking-footer terms are not currently exposed as a verified public-to-members dataset.',
      },
      businessDocuments: {
        state: 'restricted',
        message: 'Business document evidence is not published until a dedicated member-visible document permission contract exists.',
      },
    },
  });
}
