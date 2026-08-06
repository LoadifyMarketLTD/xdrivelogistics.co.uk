import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, supabaseValidator } from '../../_lib/supabaseAdmin';
import { resolveWorkspaceRole, type WorkspaceRole } from '../../../../lib/workspaceRole';
import {
  getActionCentreRoute,
  isActionCentreEventVisibleToRole,
  resolveRoleScopedHref,
  type ActionCentreRole,
} from '../../../components/workspace/actionCentreConfig';
import { isActionCentreRoleAllowed } from '../../../components/workspace/actionCentreAuthorisation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  || process.env.SUPABASE_URL?.trim()
  || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';

const json = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
    },
  });

const extractAuthRole = (user: Record<string, unknown> | null | undefined): WorkspaceRole => {
  const appMeta = (user?.app_metadata as Record<string, unknown> | undefined) ?? {};
  const userMeta = (user?.user_metadata as Record<string, unknown> | undefined) ?? {};

  return resolveWorkspaceRole({
    role:
      (appMeta.role as string | undefined)
      ?? (userMeta.role as string | undefined)
      ?? null,
    rawRole:
      (appMeta.raw_role as string | undefined)
      ?? (userMeta.raw_role as string | undefined)
      ?? (appMeta.user_role as string | undefined)
      ?? (userMeta.user_role as string | undefined)
      ?? null,
    membershipRole:
      (appMeta.membership_role as string | undefined)
      ?? (userMeta.membership_role as string | undefined)
      ?? null,
    ownerDriverWorkspace:
      (appMeta.owner_driver_workspace as boolean | undefined)
      ?? (userMeta.owner_driver_workspace as boolean | undefined)
      ?? null,
  });
};

const parseRole = (value: string | null): ActionCentreRole | null => {
  if (
    value === 'admin' ||
    value === 'broker' ||
    value === 'customer' ||
    value === 'driver' ||
    value === 'platform_owner'
  ) {
    return value;
  }
  return null;
};

const normaliseEventLabel = (eventType: unknown): string => {
  const text = typeof eventType === 'string' ? eventType.trim() : '';
  if (!text) return 'Activity update';
  return text.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const inferStatus = (status: unknown): string => {
  const text = typeof status === 'string' ? status.trim().toLowerCase() : '';
  return text || 'pending';
};

export async function GET(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseValidator) {
    return json(503, { error: 'Authentication service is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Missing bearer token.' });

  const { data: authData, error: authError } = await supabaseValidator.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: 'Invalid session.' });

  const params = new URL(request.url).searchParams;
  const role = parseRole(params.get('role'));
  if (!role) return json(400, { error: 'Invalid role.' });

  const resolvedRole = extractAuthRole(authData.user as unknown as Record<string, unknown>);
  if (!isActionCentreRoleAllowed(role, resolvedRole)) {
    return json(403, { error: 'Forbidden for this role.' });
  }

  const limitValue = Number(params.get('limit') ?? '100');
  const limit = Number.isFinite(limitValue) ? Math.max(1, Math.min(200, Math.trunc(limitValue))) : 100;

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: 'Bearer ' + token } },
  });

  const { data, error } = await client
    .from('notification_events')
    .select('id,event_type,entity_type,status,created_at')
    .eq('recipient_user_id', authData.user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return json(500, { error: 'Unable to load action centre.' });

  const items = (data ?? [])
    .filter((row) =>
      isActionCentreEventVisibleToRole(
        role,
        typeof row.event_type === 'string' ? row.event_type : null,
        typeof row.entity_type === 'string' ? row.entity_type : null,
      ),
    )
    .map((row, index) => {
      const eventId = typeof row.id === 'string' ? row.id : null;
      const entityType = typeof row.entity_type === 'string' ? row.entity_type : null;
      const ctaHref = resolveRoleScopedHref(role, entityType, eventId);
      return {
        id: `${String(row.created_at ?? 'event')}-${index}`,
        event_id: eventId,
        event_type: normaliseEventLabel(row.event_type),
        entity_type: entityType,
        status: inferStatus(row.status),
        created_at: row.created_at,
        cta_href: ctaHref || getActionCentreRoute(role, eventId),
      };
    });

  return json(200, { items });
}
