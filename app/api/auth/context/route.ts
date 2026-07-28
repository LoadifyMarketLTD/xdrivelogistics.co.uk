import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
  getBearerToken,
} from '../../_lib/supabaseAdmin';
import {
  normalizeAuthMembershipRows,
  type AuthMembershipQueryRow,
} from '../../../../lib/authActiveCompanyContext';
import type { DriverBootstrapEvidenceRow } from '../../../../lib/bootstrapProfileRole';
import { ROUTE_AUTH_COOKIE_NAME } from '../../../../lib/routeAuthCookie';
import {
  BUSINESS_WORKSPACE_VALUES,
  resolveSharedUiContext,
} from '../../../../lib/sharedUiContext';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ContextRouteResponse = NextResponse<Record<string, unknown>>;

const responseHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
};

const json = (
  status: number,
  body: Record<string, unknown>,
): ContextRouteResponse =>
  NextResponse.json<Record<string, unknown>>(body, {
    status,
    headers: responseHeaders,
  });

const switchSchema = z.object({
  companyId: z.string().uuid(),
  workspace: z.enum(
    BUSINESS_WORKSPACE_VALUES as [
      (typeof BUSINESS_WORKSPACE_VALUES)[number],
      ...(typeof BUSINESS_WORKSPACE_VALUES)[number][],
    ],
  ),
});

type ProfileRow = {
  user_id: string;
  company_id: string | null;
  role: string | null;
  status: string | null;
  is_driver: boolean | null;
};

const readRouteToken = (request: NextRequest): string | null => {
  const cookieToken = request.cookies.get(ROUTE_AUTH_COOKIE_NAME)?.value?.trim();
  if (cookieToken) {
    try {
      return decodeURIComponent(cookieToken);
    } catch {
      return cookieToken;
    }
  }
  return getBearerToken(request);
};

const isServiceFailure = (message: string | null | undefined): boolean => {
  const normalized = (message ?? '').toLowerCase();
  return (
    normalized.includes('failed to fetch') ||
    normalized.includes('network') ||
    normalized.includes('timeout') ||
    normalized.includes('timed out') ||
    normalized.includes('503')
  );
};

const resolveAuthoritativeSource = async (request: NextRequest) => {
  if (!isSupabaseAdminConfigured || !supabaseAdmin || !supabaseValidator) {
    return {
      ok: false as const,
      response: json(503, { error: 'Context service is not configured.' }),
    };
  }

  const token = readRouteToken(request);
  if (!token) {
    return {
      ok: false as const,
      response: json(401, { error: 'Unauthorized.' }),
    };
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseValidator.auth.getUser(token);

  if (authError && isServiceFailure(authError.message)) {
    return {
      ok: false as const,
      response: json(503, { error: 'Authentication service is unavailable.' }),
    };
  }
  if (authError || !user) {
    return {
      ok: false as const,
      response: json(401, { error: 'Unauthorized.' }),
    };
  }

  const [profileResult, membershipsResult, driversResult] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('user_id, company_id, role, status, is_driver')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabaseAdmin
      .from('company_memberships')
      .select('id, company_id, user_id, role_in_company, status, companies(id, name, company_type, status)')
      .eq('user_id', user.id)
      .eq('status', 'active'),
    supabaseAdmin
      .from('drivers')
      .select('id, user_id, company_id, must_change_password, status, app_access, driver_type, can_commercial_bid')
      .eq('user_id', user.id),
  ]);

  if (profileResult.error || membershipsResult.error || driversResult.error) {
    console.error('[Shared UI Context] authoritative query failed', {
      profile: profileResult.error?.message ?? null,
      memberships: membershipsResult.error?.message ?? null,
      drivers: driversResult.error?.message ?? null,
      userId: user.id,
    });
    return {
      ok: false as const,
      response: json(500, { error: 'Unable to validate workspace context.' }),
    };
  }

  const profile = profileResult.data as ProfileRow | null;
  if (!profile) {
    return {
      ok: false as const,
      response: json(409, { error: 'Account profile is missing.' }),
    };
  }

  const profileStatus = (profile.status ?? '').trim().toLowerCase();
  if (profileStatus !== 'active') {
    return {
      ok: false as const,
      response: json(403, { error: 'Account is not active.' }),
    };
  }

  const memberships = normalizeAuthMembershipRows(
    (membershipsResult.data ?? []) as AuthMembershipQueryRow[],
  );
  const drivers = (driversResult.data ?? []) as DriverBootstrapEvidenceRow[];

  return {
    ok: true as const,
    admin: supabaseAdmin,
    user,
    profile,
    memberships,
    drivers,
  };
};

const mapResolutionError = (error: string): ContextRouteResponse => {
  if (error === 'no_active_membership') {
    return json(403, { error: 'No active company membership is available.' });
  }
  if (error === 'company_not_available') {
    return json(403, { error: 'The requested company is not available to this account.' });
  }
  if (error === 'workspace_not_enabled') {
    return json(403, { error: 'The requested workspace is not enabled for this company.' });
  }
  if (error === 'driver_context_required') {
    return json(403, { error: 'Active same-company Driver access is required.' });
  }
  return json(403, { error: 'Workspace context is not permitted.' });
};

export async function GET(
  request: NextRequest,
): Promise<ContextRouteResponse> {
  try {
    const source = await resolveAuthoritativeSource(request);
    if (!source.ok) return source.response;

    const initial = resolveSharedUiContext({
      memberships: source.memberships,
      profileCompanyId: source.profile.company_id,
      drivers: source.drivers,
      userId: source.user.id,
    });

    if (!initial.ok && initial.error === 'company_not_available') {
      const recoverable = resolveSharedUiContext({
        memberships: source.memberships,
        profileCompanyId: null,
        drivers: source.drivers,
        userId: source.user.id,
      });
      if (!recoverable.ok) return mapResolutionError(recoverable.error);
      return json(200, {
        ...recoverable.snapshot,
        staleSelectionCleared: true,
      });
    }

    if (!initial.ok) return mapResolutionError(initial.error);

    return json(200, {
      ...initial.snapshot,
      staleSelectionCleared: false,
    });
  } catch (error) {
    console.error('[Shared UI Context] GET failed unexpectedly', error);
    return json(500, { error: 'Unable to validate workspace context.' });
  }
}

export async function POST(
  request: NextRequest,
): Promise<ContextRouteResponse> {
  try {
    const source = await resolveAuthoritativeSource(request);
    if (!source.ok) return source.response;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json(400, { error: 'Invalid JSON body.' });
    }

    const parsed = switchSchema.safeParse(body);
    if (!parsed.success) {
      return json(400, {
        error: 'Validation failed.',
        details: parsed.error.flatten(),
      });
    }

    const resolution = resolveSharedUiContext({
      memberships: source.memberships,
      requestedCompanyId: parsed.data.companyId,
      requestedWorkspace: parsed.data.workspace,
      drivers: source.drivers,
      userId: source.user.id,
    });

    if (!resolution.ok) return mapResolutionError(resolution.error);
    if (!resolution.snapshot.current) {
      return json(409, { error: 'A complete company and workspace selection is required.' });
    }

    const { data: updatedProfile, error: updateError } = await source.admin
      .from('profiles')
      .update({ company_id: resolution.snapshot.current.companyId })
      .eq('user_id', source.user.id)
      .select('company_id')
      .maybeSingle();

    if (updateError) {
      console.error('[Shared UI Context] profile company switch failed', {
        message: updateError.message,
        userId: source.user.id,
        companyId: resolution.snapshot.current.companyId,
      });
      return json(500, { error: 'Unable to save the selected company.' });
    }

    if (updatedProfile?.company_id !== resolution.snapshot.current.companyId) {
      return json(409, { error: 'The selected company could not be confirmed.' });
    }

    return json(200, {
      ...resolution.snapshot,
      landingRoute: resolution.snapshot.current.landingRoute,
    });
  } catch (error) {
    console.error('[Shared UI Context] POST failed unexpectedly', error);
    return json(500, { error: 'Unable to update workspace context.' });
  }
}
