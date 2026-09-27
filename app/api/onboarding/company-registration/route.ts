import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';
import { registerCompaniesHouseCompany } from '../../../../lib/server/companyRegistration';

const requestSchema = z.object({
  companyNumber: z.string().trim().min(1).max(32),
});

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status });

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Server auth is not configured.' });
  }

  const bearer = getBearerToken(request);
  if (!bearer) return json(401, { error: 'Unauthorized.' });

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(bearer);
  if (authError || !authData.user) return json(401, { error: 'Unauthorized.' });

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return json(400, { error: 'Enter a valid Companies House number.' });
  }

  const { data: applications, error: applicationError } = await supabaseAdmin
    .from('onboarding_applications')
    .select('id, user_id, account_type, company_id, payload')
    .eq('user_id', authData.user.id)
    .order('created_at', { ascending: false })
    .limit(2);

  if (applicationError) return json(500, { error: applicationError.message });
  if ((applications ?? []).length !== 1) {
    return json(409, {
      error: (applications ?? []).length === 0
        ? 'Onboarding application not found.'
        : 'Multiple onboarding applications were found. Platform Owner review is required.',
    });
  }

  const application = applications![0];
  if (application.account_type !== 'broker_shipper' && application.account_type !== 'fleet_courier') {
    return json(403, { error: 'Company verification is not available for this onboarding account type.' });
  }

  const registration = await registerCompaniesHouseCompany({
    supabase: supabaseAdmin,
    actorUserId: authData.user.id,
    companyNumber: parsed.data.companyNumber,
    accountType: application.account_type,
  });

  if (!registration.success) {
    return json(registration.httpStatus, {
      error: registration.error,
      code: registration.errorCode,
    });
  }

  const verifiedAt = new Date().toISOString();
  const existingPayload =
    application.payload && typeof application.payload === 'object' && !Array.isArray(application.payload)
      ? application.payload as Record<string, unknown>
      : {};
  const payload: Record<string, unknown> = {
    ...existingPayload,
    company_number: registration.companyNumber,
    companies_house_verified_name: registration.registeredName,
    companies_house_registry_status: registration.registryStatus,
    companies_house_verified_at: verifiedAt,
  };
  if (application.account_type === 'broker_shipper') {
    payload.company_name = registration.registeredName;
  } else {
    payload.legal_company_name = registration.registeredName;
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('onboarding_applications')
    .update({
      company_id: registration.companyId,
      payload,
      last_activity_at: verifiedAt,
    })
    .eq('id', application.id)
    .eq('user_id', authData.user.id)
    .select('id, company_id, payload')
    .single();

  if (updateError) return json(500, { error: updateError.message });

  return json(200, {
    companyId: updated.company_id,
    companyNumber: registration.companyNumber,
    registeredName: registration.registeredName,
    registryStatus: registration.registryStatus,
    created: registration.created,
    payload: updated.payload,
  });
}
