import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isDriverContext, requireDriver, respond } from '../_lib';
import { parseDeviceTokenRegisterBody, parseDeviceTokenUnregisterBody } from './contract';

const ATOMIC_REGISTER_RPC = 'driver_register_device_token_atomic';
const ATOMIC_UNREGISTER_RPC = 'driver_unregister_device_token_atomic';

function isMissingAtomicRpc(error: { code?: string | null; message?: string | null } | null | undefined) {
  if (!error) return false;
  if (error.code === '42883') return true;
  return typeof error.message === 'string' && /function .* does not exist/i.test(error.message);
}

function normalizeAtomicResult(data: unknown): 'accepted' | 'duplicate' | 'stale' | null {
  if (data === 'accepted' || data === 'duplicate' || data === 'stale') return data;
  if (Array.isArray(data) && data.length > 0) {
    const first = data[0];
    if (first === 'accepted' || first === 'duplicate' || first === 'stale') return first;
  }
  return null;
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
  const { data, error } = await supabaseAdmin.rpc(ATOMIC_REGISTER_RPC, {
    p_user_id: driver.userId,
    p_driver_id: driver.driverId,
    p_company_id: driver.companyId,
    p_token: token,
    p_platform: platform,
    p_app_package: appPackage,
    p_installation_id: installationId,
    p_generation: generation,
  });
  if (error) {
    if (isMissingAtomicRpc(error)) {
      return respond(500, { error: `${ATOMIC_REGISTER_RPC} is not installed.` });
    }
    return respond(500, { error: error.message });
  }
  const result = normalizeAtomicResult(data);
  if (!result) return respond(500, { error: 'Unexpected token registration result.' });
  return respond(200, { ok: true, result });
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
  const { data, error } = await supabaseAdmin.rpc(ATOMIC_UNREGISTER_RPC, {
    p_user_id: driver.userId,
    p_driver_id: driver.driverId,
    p_token: parsed.token,
    p_installation_id: parsed.installationId,
    p_generation: parsed.generation,
  });
  if (error) {
    if (isMissingAtomicRpc(error)) {
      return respond(500, { error: `${ATOMIC_UNREGISTER_RPC} is not installed.` });
    }
    return respond(500, { error: error.message });
  }
  const result = normalizeAtomicResult(data);
  if (!result) return respond(500, { error: 'Unexpected token unregister result.' });
  return respond(200, { ok: true, result });
}
