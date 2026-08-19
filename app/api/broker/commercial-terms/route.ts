import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';
import { operationalError } from '../../_lib/operationalError';

const querySchema = z.object({
  companyId: z.string().uuid(),
});

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

const companyStatus = (value: unknown) => {
  if (Array.isArray(value)) return String(value[0]?.status ?? '').trim().toLowerCase();
  if (value && typeof value === 'object') {
    return String((value as { status?: unknown }).status ?? '').trim().toLowerCase();
  }
  return '';
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return operationalError({
      status: 503,
      message: 'Broker commercial terms are temporarily unavailable.',
      context: 'broker.commercial-terms.config',
      retryable: true,
    });
  }

  const parsed = querySchema.safeParse({
    companyId: request.nextUrl.searchParams.get('companyId'),
  });
  if (!parsed.success) {
    return respond(400, { error: 'A valid companyId is required.' });
  }

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Unauthorized.' });

  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return respond(401, { error: 'Unauthorized.' });

  const companyId = parsed.data.companyId;
  const [{ data: membership, error: membershipError }, { data: profile, error: profileError }] = await Promise.all([
    supabaseAdmin
      .from('company_memberships')
      .select('id, role_in_company, status, companies!inner(status)')
      .eq('company_id', companyId)
      .eq('user_id', authData.user.id)
      .eq('status', 'active')
      .maybeSingle(),
    supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', authData.user.id)
      .maybeSingle(),
  ]);

  if (membershipError) {
    return operationalError({
      status: 500,
      message: 'Broker company access could not be verified.',
      context: `broker.commercial-terms.membership.company:${companyId}.user:${authData.user.id}`,
      cause: membershipError,
      retryable: true,
    });
  }
  if (profileError) {
    return operationalError({
      status: 500,
      message: 'Broker role could not be verified.',
      context: `broker.commercial-terms.profile.user:${authData.user.id}`,
      cause: profileError,
      retryable: true,
    });
  }

  const profileRole = String(profile?.role ?? '').trim().toLowerCase();
  const activeCompany = companyStatus(membership?.companies) === 'active';
  if (!membership?.id || !activeCompany || profileRole !== 'broker') {
    return respond(403, { error: 'Forbidden — active Broker company membership required.' });
  }

  const { data: terms, error: termsError } = await supabaseAdmin
    .from('job_private_commercial_terms')
    .select('job_id, owner_company_id, customer_price, target_carrier_cost, currency, updated_at')
    .eq('owner_company_id', companyId)
    .order('updated_at', { ascending: false })
    .limit(1000);

  if (termsError) {
    return operationalError({
      status: 503,
      message: 'Broker commercial terms are temporarily unavailable.',
      context: `broker.commercial-terms.query.company:${companyId}`,
      cause: termsError,
      retryable: true,
    });
  }

  return respond(200, {
    companyId,
    terms: terms ?? [],
  });
}
