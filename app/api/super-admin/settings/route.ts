import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

const verifyOwner = async (request: NextRequest) => {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;
  const token = getBearerToken(request);
  if (!token) return null;
  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error } = await validatorClient.auth.getUser(token);
  if (error || !authData.user) return null;
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (!profile || profile.role !== 'owner') return null;
  return authData.user;
};

// ── GET — read global settings or feature flags ──────────────────────────────
export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server configuration not available.' });
  }

  const owner = await verifyOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: owner role required.' });

  const { searchParams } = new URL(request.url);
  const section = searchParams.get('section') ?? 'global';

  if (section === 'feature-flags') {
    const { data, error } = await supabaseAdmin
      .from('platform_feature_flags')
      .select('key, label, description, category, is_enabled, updated_at, updated_by')
      .order('category')
      .order('label');

    if (error) {
      // Gracefully handle table not existing yet
      if (error.message?.includes('does not exist') || error.message?.includes('relation')) {
        return respond(200, {
          section,
          flags: [],
          note: 'Feature flags table not yet created. Apply migration 20260725170000 first.',
          migrationRequired: '20260725170000_platform_feature_flags.sql',
        });
      }
      return respond(500, { error: error.message });
    }

    return respond(200, { section, flags: data ?? [] });
  }

  // Default: global settings from app_settings
  const { data, error } = await supabaseAdmin
    .from('app_settings')
    .select('key, value, created_at')
    .order('key');

  if (error) {
    if (error.message?.includes('does not exist') || error.message?.includes('relation')) {
      return respond(200, {
        section,
        settings: [],
        note: 'app_settings table not yet populated.',
      });
    }
    return respond(500, { error: error.message });
  }

  return respond(200, { section, settings: data ?? [] });
}

// ── PATCH — update a setting or toggle a feature flag ────────────────────────
export async function PATCH(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server configuration not available.' });
  }

  const owner = await verifyOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: owner role required.' });

  let body: { section?: string; key?: string; value?: string; is_enabled?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return respond(400, { error: 'Invalid JSON body.' });
  }

  const { section, key, value, is_enabled } = body;
  if (!key?.trim()) return respond(400, { error: 'key is required.' });

  if (section === 'feature-flags') {
    if (is_enabled === undefined) return respond(400, { error: 'is_enabled is required.' });

    const { data: updated, error } = await supabaseAdmin
      .from('platform_feature_flags')
      .update({ is_enabled, updated_by: owner.id })
      .eq('key', key.trim())
      .select('key, is_enabled, updated_at')
      .single();

    if (error) return respond(500, { error: error.message });
    return respond(200, { flag: updated, success: true });
  }

  // Default: upsert into app_settings
  if (value === undefined) return respond(400, { error: 'value is required.' });

  const { data: updated, error } = await supabaseAdmin
    .from('app_settings')
    .upsert({ key: key.trim(), value: String(value) })
    .select('key, value')
    .single();

  if (error) return respond(500, { error: error.message });
  return respond(200, { setting: updated, success: true });
}
