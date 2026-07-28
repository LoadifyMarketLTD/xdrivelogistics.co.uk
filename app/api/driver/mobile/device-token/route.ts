import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isDriverContext, requireDriver, respond } from '../_lib';
import { parseDeviceTokenRegisterBody, parseDeviceTokenUnregisterBody } from './contract';

function isMissingRelationError(error: { code?: string | null } | null | undefined) {
  return error?.code === '42P01';
}

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return respond(400, { error: 'Invalid JSON body.' });
  }

  const parsed = parseDeviceTokenRegisterBody(body);
  if (!parsed.ok) return respond(400, { error: parsed.error });
  const { token, platform, appPackage, installationId, generation } = parsed.value;
  const now = new Date().toISOString();

  // ── Stale-generation guard ──────────────────────────────────────────────────
  // Before any revocation or upsert, check whether a newer registration for the
  // same (installation_id, token) pair already exists.  If it does, the incoming
  // request is stale (delayed A request after B registered on the same device) and
  // must be rejected without mutating server state.
  const { data: existingByInstall } = await supabaseAdmin
    .from('driver_device_tokens')
    .select('registration_generation')
    .eq('installation_id', installationId)
    .eq('token', token)
    .maybeSingle();

  if (existingByInstall && existingByInstall.registration_generation >= generation) {
    // Stale or exact-duplicate request — no-op, do not revoke any token.
    return respond(200, { ok: true });
  }

  // Revoke any currently active token rows for this owner/driver except the current token.
  // If the normalized lifecycle table is not yet present, gracefully fall back to legacy drivers.device_token.
  const { error: revokeExistingError } = await supabaseAdmin
    .from('driver_device_tokens')
    .update({ revoked_at: now, updated_at: now })
    .eq('user_id', driver.userId)
    .eq('driver_id', driver.driverId)
    .is('revoked_at', null)
    .neq('token', token);
  if (revokeExistingError && !isMissingRelationError(revokeExistingError)) {
    return respond(500, { error: revokeExistingError.message });
  }

  // Ensure a token belongs to exactly one active owner session at a time.
  const { error: revokeForeignOwnerError } = await supabaseAdmin
    .from('driver_device_tokens')
    .update({ revoked_at: now, updated_at: now })
    .neq('user_id', driver.userId)
    .eq('token', token)
    .is('revoked_at', null);
  if (revokeForeignOwnerError && !isMissingRelationError(revokeForeignOwnerError)) {
    return respond(500, { error: revokeForeignOwnerError.message });
  }

  const { error: upsertError } = await supabaseAdmin
    .from('driver_device_tokens')
    .upsert(
      {
        user_id: driver.userId,
        driver_id: driver.driverId,
        company_id: driver.companyId,
        token,
        platform,
        app_package: appPackage,
        installation_id: installationId,
        registration_generation: generation,
        revoked_at: null,
        last_registered_at: now,
        updated_at: now,
      },
      { onConflict: 'token' },
    );
  if (upsertError && !isMissingRelationError(upsertError)) {
    return respond(500, { error: upsertError.message });
  }

  const { error } = await supabaseAdmin
    .from('drivers')
    .update({ device_token: token })
    .eq('id', driver.driverId)
    .eq('user_id', driver.userId);

  if (error) return respond(500, { error: error.message });
  return respond(200, { ok: true });
}

export async function DELETE(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return respond(400, { error: 'Invalid JSON body.' });
  }

  const parsed = parseDeviceTokenUnregisterBody(body);
  if (!parsed.ok) return respond(400, { error: parsed.error });
  const now = new Date().toISOString();

  const { error: revokeError } = await supabaseAdmin
    .from('driver_device_tokens')
    .update({ revoked_at: now, updated_at: now })
    .eq('user_id', driver.userId)
    .eq('driver_id', driver.driverId)
    .eq('token', parsed.token)
    .is('revoked_at', null);
  if (revokeError && !isMissingRelationError(revokeError)) {
    return respond(500, { error: revokeError.message });
  }

  const { error: clearLegacyError } = await supabaseAdmin
    .from('drivers')
    .update({ device_token: null })
    .eq('id', driver.driverId)
    .eq('user_id', driver.userId)
    .eq('device_token', parsed.token);
  if (clearLegacyError) return respond(500, { error: clearLegacyError.message });

  return respond(200, { ok: true });
}
