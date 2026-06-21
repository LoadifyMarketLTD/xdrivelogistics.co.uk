import { NextRequest, NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import type { z } from 'zod';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';
import type { OnboardingAccountType } from '../../_lib/onboarding';

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

export const buildSessionHandlers = <TPatchSchema extends z.ZodTypeAny>(options: {
  expectedAccountType: OnboardingAccountType;
  patchSchema: TPatchSchema;
}) => {
  const { expectedAccountType, patchSchema } = options;

  const GET = async (request: NextRequest) => {
    if (!isSupabaseAdminConfigured || !supabaseAdmin) {
      return json(503, { error: 'Server auth is not configured.' });
    }

    const authUser = await getAuthUser(request);
    const url = new URL(request.url);
    const token = url.searchParams.get('token')?.trim() || undefined;

    if (!token && !authUser) {
      return json(401, { error: 'Authentication required.' });
    }

    const { data: app, error } = await resolveApplication({ token, authUserId: authUser?.id });
    if (error) return json(500, { error: error.message });
    if (!app) return json(404, { error: 'Onboarding application not found.' });

    if (!validateAccountType(app.account_type, expectedAccountType)) {
      return json(403, { error: 'Forbidden onboarding account type.' });
    }

    if (authUser && app.user_id !== authUser.id) {
      return json(403, { error: 'Forbidden.' });
    }

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

    const payloadPatch = patchData.payload ?? {};

    const nextStatus =
      patchData.status && ['draft', 'in_progress', 'request_changes', 'submitted'].includes(patchData.status)
        ? patchData.status
        : existing.status;

    const updatePayload: Record<string, unknown> = {
      last_activity_at: new Date().toISOString(),
      status: nextStatus,
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
  persist: (args: { userId: string; applicationId: string; payload: z.infer<TPayloadSchema> }) => Promise<void>;
}) => {
  const { expectedAccountType, payloadSchema, persist } = options;

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

    const payload = payloadSchema.safeParse((application.payload ?? {}) as Record<string, unknown>);
    if (!payload.success) {
      return json(400, { error: 'Onboarding payload is incomplete or invalid.', details: payload.error.flatten() });
    }

    await persist({ userId: authUser.id, applicationId: application.id, payload: payload.data });

    const reviewStatusByAccountType: Record<OnboardingAccountType, string> = {
      broker_shipper: 'under_review',
      fleet_courier: 'compliance_review',
      owner_driver: 'compliance_review',
    };

    const reviewStatus = reviewStatusByAccountType[expectedAccountType];

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('onboarding_applications')
      .update({
        status: reviewStatus,
        current_step: 'pending_review',
        completion_percentage: 100,
        submitted_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', application.id)
      .eq('account_type', expectedAccountType)
      .select('*')
      .single();

    if (updateError) return json(500, { error: updateError.message });

    await supabaseAdmin.from('notification_events').insert({
      event_type: 'onboarding_submitted',
      entity_type: 'onboarding_application',
      entity_id: application.id,
      recipient_user_id: authUser.id,
      payload: {
        onboarding_application_id: application.id,
        account_type: expectedAccountType,
        status: reviewStatus,
      },
    });

    return json(200, {
      application: updated,
      status: reviewStatus,
    });
  };
};
