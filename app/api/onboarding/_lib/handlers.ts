import { NextRequest, NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import type { z } from 'zod';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';
import { normalizeOnboardingStatus, type OnboardingAccountType } from '../../_lib/onboarding';
import {
  registerCompaniesHouseCompany,
  type CompanyRegistrationAccountType,
} from '../../../../lib/server/companyRegistration';

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

type OnboardingPatchData = {
  payload?: Record<string, unknown>;
  status?: string;
  currentStep?: string;
  completionPercentage?: number;
};

const getAuthUser = async (request: NextRequest): Promise<User | null> => {
  const token = getBearerToken(request);
  if (!token || !supabaseAdmin) return null;
  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data, error } = await validatorClient.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
};

const resolveApplication = async ({
  token,
  authUserId,
}: {
  token?: string;
  authUserId?: string;
}) => {
  if (!supabaseAdmin) return { data: null, error: new Error('Admin client unavailable') };

  if (token) {
    const { hashOnboardingToken } = await import('../../_lib/onboarding');
    const tokenHash = hashOnboardingToken(token);
    return supabaseAdmin.from('onboarding_applications').select('*').eq('token_hash', tokenHash).maybeSingle();
  }

  if (!authUserId) return { data: null, error: null };
  return supabaseAdmin.from('onboarding_applications').select('*').eq('user_id', authUserId).maybeSingle();
};

const validateAccountType = (raw: string, expected: OnboardingAccountType) => raw === expected;

const isCompanyRegistrationAccountType = (
  accountType: OnboardingAccountType,
): accountType is CompanyRegistrationAccountType =>
  accountType === 'broker_shipper' || accountType === 'fleet_courier';

const resolveApplicantPatchStatus = (
  existingStatusRaw: string | null | undefined,
  requestedStatus?: string,
): { nextStatus: string; error?: string } => {
  const existingStatus = normalizeOnboardingStatus(existingStatusRaw);
  const immutableApplicantStatuses = new Set(['under_review', 'approved', 'rejected']);
  const allowedRequestedStatuses = new Set(['draft', 'in_progress']);

  if (requestedStatus && !allowedRequestedStatuses.has(requestedStatus)) {
    return {
      nextStatus: existingStatus,
      error: 'Invalid status transition: applicants can only set draft or in_progress.',
    };
  }

  if (immutableApplicantStatuses.has(existingStatus)) {
    if (requestedStatus && requestedStatus !== existingStatus) {
      return {
        nextStatus: existingStatus,
        error: `Invalid status transition: application in ${existingStatus} cannot be changed by applicant.`,
      };
    }
    return { nextStatus: existingStatus };
  }

  if (existingStatus === 'request_changes') {
    if (!requestedStatus) return { nextStatus: existingStatus };
    if (requestedStatus === 'in_progress') return { nextStatus: 'in_progress' };
    return {
      nextStatus: existingStatus,
      error: 'Invalid status transition: request_changes can only resume to in_progress.',
    };
  }

  if (existingStatus === 'in_progress') {
    if (!requestedStatus || requestedStatus === 'in_progress') return { nextStatus: 'in_progress' };
    return {
      nextStatus: existingStatus,
      error: 'Invalid status transition: in_progress cannot regress to draft.',
    };
  }

  if (existingStatus === 'draft') {
    if (!requestedStatus || requestedStatus === 'draft') return { nextStatus: 'draft' };
    return { nextStatus: 'in_progress' };
  }

  return { nextStatus: existingStatus };
};

export const buildSessionHandlers = <TPatchSchema extends z.ZodTypeAny>(options: {
  expectedAccountType: OnboardingAccountType;
  patchSchema: TPatchSchema;
  validateApplication?: (application: Record<string, unknown>) => { status: number; body: Record<string, unknown> } | null;
}) => {
  const { expectedAccountType, patchSchema, validateApplication } = options;

  const GET = async (request: NextRequest) => {
    if (!isSupabaseAdminConfigured || !supabaseAdmin) {
      return json(503, { error: 'Server auth is not configured.' });
    }

    const authUser = await getAuthUser(request);
    const url = new URL(request.url);
    const token = url.searchParams.get('token')?.trim() || undefined;

    if (!token && !authUser) return json(401, { error: 'Authentication required.' });

    const { data: app, error } = await resolveApplication({ token, authUserId: authUser?.id });
    if (error) return json(500, { error: error.message });
    if (!app) return json(404, { error: 'Onboarding application not found.' });

    if (!validateAccountType(app.account_type, expectedAccountType)) {
      return json(403, { error: 'Forbidden onboarding account type.' });
    }
    const validationError = validateApplication?.(app as Record<string, unknown>);
    if (validationError) return json(validationError.status, validationError.body);

    if (authUser && app.user_id !== authUser.id) return json(403, { error: 'Forbidden.' });

    const expiresAt = app.token_expires_at ? new Date(app.token_expires_at).getTime() : null;
    if (token && expiresAt && Date.now() > expiresAt) {
      return json(410, { error: 'Onboarding token expired. Request a new onboarding email.' });
    }

    if (token && app.token_activated_at && !authUser) {
      return json(401, {
        error: 'This onboarding link was already activated. Sign in to resume onboarding.',
        requireLogin: true,
      });
    }

    if (token && !app.token_activated_at) {
      const status = app.status === 'draft' ? 'in_progress' : app.status;
      const { data: activated, error: activationError } = await supabaseAdmin
        .from('onboarding_applications')
        .update({
          token_activated_at: new Date().toISOString(),
          status,
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', app.id)
        .eq('account_type', expectedAccountType)
        .select('*')
        .single();

      if (activationError) return json(500, { error: activationError.message });
      return json(200, { application: activated, resumable: true });
    }

    return json(200, { application: app, resumable: true });
  };

  const PATCH = async (request: NextRequest) => {
    if (!isSupabaseAdminConfigured || !supabaseAdmin) {
      return json(503, { error: 'Server auth is not configured.' });
    }

    const authUser = await getAuthUser(request);
    if (!authUser) return json(401, { error: 'Unauthorized.' });

    const body = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return json(400, { error: 'Invalid onboarding payload.', details: parsed.error.flatten() });
    }

    const patchData = parsed.data as OnboardingPatchData;

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('onboarding_applications')
      .select('*')
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (existingError) return json(500, { error: existingError.message });
    if (!existing) return json(404, { error: 'Onboarding application not found.' });

    if (!validateAccountType(existing.account_type, expectedAccountType)) {
      return json(403, { error: 'Forbidden onboarding account type.' });
    }
    const validationError = validateApplication?.(existing as Record<string, unknown>);
    if (validationError) return json(validationError.status, validationError.body);

    const payloadPatch = patchData.payload ?? {};

    const statusDecision = resolveApplicantPatchStatus(existing.status, patchData.status);
    if (statusDecision.error) {
      return json(409, { error: statusDecision.error });
    }

    const updatePayload: Record<string, unknown> = {
      last_activity_at: new Date().toISOString(),
      status: statusDecision.nextStatus,
      payload: {
        ...(existing.payload as Record<string, unknown>),
        ...payloadPatch,
      },
    };

    if (patchData.currentStep) updatePayload.current_step = patchData.currentStep;
    if (typeof patchData.completionPercentage === 'number') {
      updatePayload.completion_percentage = patchData.completionPercentage;
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('onboarding_applications')
      .update(updatePayload)
      .eq('id', existing.id)
      .eq('account_type', expectedAccountType)
      .select('*')
      .single();

    if (updateError) return json(500, { error: updateError.message });

    return json(200, { application: updated });
  };

  return { GET, PATCH };
};

export const buildSubmitHandler = <TPayloadSchema extends z.ZodTypeAny>(options: {
  expectedAccountType: OnboardingAccountType;
  payloadSchema: TPayloadSchema;
}) => {
  const { expectedAccountType, payloadSchema } = options;

  return async (request: NextRequest) => {
    if (!isSupabaseAdminConfigured || !supabaseAdmin) {
      return json(503, { error: 'Server auth is not configured.' });
    }

    const authUser = await getAuthUser(request);
    if (!authUser) return json(401, { error: 'Unauthorized.' });

    const { data: application, error: appError } = await supabaseAdmin
      .from('onboarding_applications')
      .select('*')
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (appError) return json(500, { error: appError.message });
    if (!application) return json(404, { error: 'Onboarding application not found.' });

    if (!validateAccountType(application.account_type, expectedAccountType)) {
      return json(403, { error: 'Forbidden onboarding account type.' });
    }

    const parsedPayload = payloadSchema.safeParse((application.payload ?? {}) as Record<string, unknown>);
    if (!parsedPayload.success) {
      return json(400, { error: 'Onboarding payload is incomplete or invalid.', details: parsedPayload.error.flatten() });
    }

    let companyId: string | null = application.company_id ?? null;

    if (isCompanyRegistrationAccountType(expectedAccountType)) {
      const validatedPayload = parsedPayload.data as Record<string, unknown>;
      const rawCompanyNumber = typeof validatedPayload.company_number === 'string'
        ? validatedPayload.company_number
        : '';

      const registration = await registerCompaniesHouseCompany({
        supabase: supabaseAdmin,
        actorUserId: authUser.id,
        companyNumber: rawCompanyNumber,
        accountType: expectedAccountType,
      });

      if (!registration.success) {
        return json(registration.httpStatus, {
          error: registration.error,
          code: registration.errorCode,
        });
      }

      companyId = registration.companyId;
      const verifiedAt = new Date().toISOString();
      const canonicalPayload: Record<string, unknown> = {
        ...((application.payload ?? {}) as Record<string, unknown>),
        company_number: registration.companyNumber,
        companies_house_verified_name: registration.registeredName,
        companies_house_registry_status: registration.registryStatus,
        companies_house_verified_at: verifiedAt,
      };

      if (expectedAccountType === 'broker_shipper') {
        canonicalPayload.company_name = registration.registeredName;
      } else {
        canonicalPayload.legal_company_name = registration.registeredName;
      }

      const { error: bindError } = await supabaseAdmin
        .from('onboarding_applications')
        .update({
          company_id: registration.companyId,
          payload: canonicalPayload,
          last_activity_at: verifiedAt,
        })
        .eq('id', application.id)
        .eq('user_id', authUser.id)
        .eq('account_type', expectedAccountType);

      if (bindError) {
        console.error('[onboarding] Failed to bind verified company:', bindError.message);
        return json(500, { error: 'The verified company could not be linked to onboarding.' });
      }
    }

    const { data, error: submitError } = await supabaseAdmin.rpc('submit_onboarding_application', {
      p_application_id: application.id,
    });

    if (submitError) {
      return json(500, {
        error: 'Failed to submit onboarding application.',
        details: submitError.message,
      });
    }

    const submittedCompanyId = data as string;
    if (companyId && submittedCompanyId !== companyId) {
      console.error('[onboarding] Company registration postcondition failed.', {
        applicationId: application.id,
        expectedCompanyId: companyId,
        submittedCompanyId,
      });
      return json(500, { error: 'Company registration could not be confirmed after submission.' });
    }
    companyId = submittedCompanyId;

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('onboarding_applications')
      .select('*')
      .eq('id', application.id)
      .single();

    if (updateError) return json(500, { error: updateError.message });

    const { error: notificationError } = await supabaseAdmin.from('notification_events').insert({
      event_type: 'onboarding_submitted',
      entity_type: 'onboarding_application',
      entity_id: application.id,
      recipient_user_id: authUser.id,
      payload: {
        onboarding_application_id: application.id,
        account_type: expectedAccountType,
        status: updated.status,
        company_id: companyId,
      },
    });

    if (notificationError) {
      console.error('[onboarding] onboarding_submitted notification failed', notificationError.message);
    }

    return json(200, {
      application: updated,
      status: updated.status,
      company_id: companyId,
    });
  };
};
