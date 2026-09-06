import { NextRequest, NextResponse } from 'next/server';

import {
  isSupabaseAdminConfigured,
  supabaseAdmin,
} from '../../../_lib/supabaseAdmin';

type SafeError = {
  code: string | null;
  message: string | null;
  details: string | null;
  hint: string | null;
};

function safeError(error: unknown): SafeError | null {
  if (!error) return null;
  const value = error && typeof error === 'object'
    ? error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown }
    : null;
  return {
    code: typeof value?.code === 'string' ? value.code : null,
    message: typeof value?.message === 'string' ? value.message : String(error),
    details: typeof value?.details === 'string' ? value.details : null,
    hint: typeof value?.hint === 'string' ? value.hint : null,
  };
}

function localDiagnosticAllowed(request: NextRequest) {
  if (process.env.XDRIVE_LOCAL_PREVIEW_DEVICE_BYPASS !== 'true') return false;
  const hostname = request.nextUrl.hostname.toLowerCase();
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
}

export async function GET(request: NextRequest) {
  if (!localDiagnosticAllowed(request)) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    '';

  let urlRef: string | null = null;
  try {
    urlRef = new URL(supabaseUrl).hostname.split('.')[0] || null;
  } catch {
    urlRef = null;
  }

  const base = {
    adminConfigured: isSupabaseAdminConfigured && Boolean(supabaseAdmin),
    urlRef,
    serviceRolePresent: Boolean(
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
      process.env.SUPABASE_SERVICE_KEY?.trim(),
    ),
    validatorKeyPresent: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()),
    appEnv: process.env.APP_ENV ?? null,
  };

  if (!supabaseAdmin) {
    return NextResponse.json({
      ...base,
      featureFlag: null,
      jobsRead: null,
      bidsRead: null,
      adminAuth: null,
    });
  }

  const [flagResult, jobsResult, bidsResult, authResult] = await Promise.all([
    supabaseAdmin
      .from('platform_feature_flags')
      .select('key,is_enabled')
      .eq('key', 'driver_mobile_app')
      .maybeSingle(),
    supabaseAdmin
      .from('jobs')
      .select('id')
      .limit(1),
    supabaseAdmin
      .from('job_bids')
      .select('id')
      .limit(1),
    supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 }),
  ]);

  return NextResponse.json({
    ...base,
    featureFlag: {
      ok: !flagResult.error,
      key: flagResult.data?.key ?? null,
      enabled: flagResult.data?.is_enabled ?? null,
      error: safeError(flagResult.error),
    },
    jobsRead: {
      ok: !jobsResult.error,
      rowsReturned: jobsResult.data?.length ?? 0,
      error: safeError(jobsResult.error),
    },
    bidsRead: {
      ok: !bidsResult.error,
      rowsReturned: bidsResult.data?.length ?? 0,
      error: safeError(bidsResult.error),
    },
    adminAuth: {
      ok: !authResult.error,
      usersReturned: authResult.data?.users?.length ?? 0,
      error: safeError(authResult.error),
    },
  });
}
