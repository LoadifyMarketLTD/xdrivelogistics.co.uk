import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { isWebDriverContext, requireActiveWebDriver } from '../_lib/webDriverContext';

const preferenceSchema = z.object({
  enabled: z.boolean(),
  currentRadiusEnabled: z.boolean(),
  homeOutcodeEnabled: z.boolean(),
  homeOutcode: z.string().trim().max(8).optional().nullable(),
  futurePositionEnabled: z.boolean(),
  radiusMiles: z.number().int().min(5).max(300),
  currentLocationMaxAgeMinutes: z.number().int().min(15).max(360),
  requireVehicleMatch: z.boolean(),
  minimumBudgetGbp: z.number().finite().nonnegative().max(1_000_000).optional().nullable(),
  inAppEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  pushEnabled: z.boolean(),
});

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

function missingRelation(error: { code?: string | null; message?: string | null } | null | undefined) {
  if (!error) return false;
  const code = String(error.code ?? '').toUpperCase();
  const message = String(error.message ?? '').toLowerCase();
  return (code === '42P01' || code === 'PGRST205') && message.includes('driver_load_alert_preferences');
}

function normalizeOutcode(value: string | null | undefined) {
  const compact = String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const match = compact.match(/^([A-Z]{1,2}\d[A-Z\d]?)/);
  return match?.[1] ?? '';
}

function mapPreference(row: Record<string, unknown> | null) {
  return {
    enabled: row?.enabled === true,
    currentRadiusEnabled: row ? row.current_radius_enabled === true : true,
    homeOutcodeEnabled: row?.home_outcode_enabled === true,
    homeOutcode: typeof row?.home_outcode === 'string' ? row.home_outcode : '',
    futurePositionEnabled: row ? row.future_position_enabled === true : true,
    radiusMiles: Number(row?.radius_miles ?? 30),
    currentLocationMaxAgeMinutes: Number(row?.current_location_max_age_minutes ?? 120),
    requireVehicleMatch: row ? row.require_vehicle_match === true : true,
    minimumBudgetGbp: row?.minimum_budget_gbp == null ? null : Number(row.minimum_budget_gbp),
    inAppEnabled: row ? row.in_app_enabled === true : true,
    emailEnabled: row?.email_enabled === true,
    pushEnabled: row?.push_enabled === true,
  };
}

async function loadContext(driverId: string) {
  const [{ data: driver }, { data: vehicle }] = await Promise.all([
    supabaseAdmin!
      .from('drivers')
      .select('future_position, future_position_date, availability_status')
      .eq('id', driverId)
      .maybeSingle(),
    supabaseAdmin!
      .from('vehicles')
      .select('vehicle_type, type, reg_plate')
      .eq('assigned_driver_id', driverId)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    futurePosition: typeof driver?.future_position === 'string' ? driver.future_position : null,
    futurePositionDate: typeof driver?.future_position_date === 'string' ? driver.future_position_date : null,
    availabilityStatus: typeof driver?.availability_status === 'string' ? driver.availability_status : null,
    vehicleType: typeof vehicle?.vehicle_type === 'string'
      ? vehicle.vehicle_type
      : typeof vehicle?.type === 'string' ? vehicle.type : null,
    vehicleRegistration: typeof vehicle?.reg_plate === 'string' ? vehicle.reg_plate : null,
  };
}

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Load Alert settings are temporarily unavailable.' });
  }

  const driver = await requireActiveWebDriver(request);
  if (!isWebDriverContext(driver)) return driver;
  if (!driver.companyId) return json(409, { error: 'Your Driver account is not linked to a company.' });

  const [{ data, error }, context] = await Promise.all([
    supabaseAdmin
      .from('driver_load_alert_preferences')
      .select('enabled,current_radius_enabled,home_outcode_enabled,home_outcode,future_position_enabled,radius_miles,current_location_max_age_minutes,require_vehicle_match,minimum_budget_gbp,in_app_enabled,email_enabled,push_enabled')
      .eq('driver_id', driver.driverId)
      .eq('user_id', driver.userId)
      .maybeSingle(),
    loadContext(driver.driverId),
  ]);

  if (error) {
    if (missingRelation(error)) {
      return json(503, {
        error: 'Smart Load Alerts are not enabled in this database build yet.',
        code: 'LOAD_ALERT_SCHEMA_UNAVAILABLE',
      });
    }
    return json(500, { error: 'Load Alert settings could not be loaded.' });
  }

  return json(200, { preference: mapPreference(data as Record<string, unknown> | null), context });
}

export async function PUT(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Load Alert settings are temporarily unavailable.' });
  }

  const driver = await requireActiveWebDriver(request);
  if (!isWebDriverContext(driver)) return driver;
  if (!driver.companyId) return json(409, { error: 'Your Driver account is not linked to a company.' });

  const parsed = preferenceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json(400, { error: 'Load Alert settings are incomplete or invalid.', fields: parsed.error.flatten().fieldErrors });
  }
  const input = parsed.data;

  if (input.enabled && !input.currentRadiusEnabled && !input.homeOutcodeEnabled && !input.futurePositionEnabled) {
    return json(400, { error: 'Choose at least one matching location for Load Alerts.' });
  }
  if (input.enabled && !input.inAppEnabled && !input.emailEnabled && !input.pushEnabled) {
    return json(400, { error: 'Choose at least one notification channel for Load Alerts.' });
  }

  const homeOutcode = normalizeOutcode(input.homeOutcode);
  if (input.homeOutcodeEnabled && !homeOutcode) {
    return json(400, { error: 'Enter a valid UK outcode, for example BB1 or M1.' });
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('driver_load_alert_preferences')
    .upsert({
      driver_id: driver.driverId,
      user_id: driver.userId,
      company_id: driver.companyId,
      enabled: input.enabled,
      current_radius_enabled: input.currentRadiusEnabled,
      home_outcode_enabled: input.homeOutcodeEnabled,
      home_outcode: input.homeOutcodeEnabled ? homeOutcode : null,
      future_position_enabled: input.futurePositionEnabled,
      radius_miles: input.radiusMiles,
      current_location_max_age_minutes: input.currentLocationMaxAgeMinutes,
      require_vehicle_match: input.requireVehicleMatch,
      minimum_budget_gbp: input.minimumBudgetGbp ?? null,
      in_app_enabled: input.inAppEnabled,
      email_enabled: input.emailEnabled,
      push_enabled: input.pushEnabled,
      updated_at: now,
    }, { onConflict: 'driver_id' })
    .select('enabled,current_radius_enabled,home_outcode_enabled,home_outcode,future_position_enabled,radius_miles,current_location_max_age_minutes,require_vehicle_match,minimum_budget_gbp,in_app_enabled,email_enabled,push_enabled')
    .single();

  if (error) {
    if (missingRelation(error)) {
      return json(503, {
        error: 'Smart Load Alerts are not enabled in this database build yet.',
        code: 'LOAD_ALERT_SCHEMA_UNAVAILABLE',
      });
    }
    return json(500, { error: 'Load Alert settings could not be saved.' });
  }

  let matchedRecent = 0;
  if (input.enabled) {
    const replay = await supabaseAdmin.rpc('fn_enqueue_driver_load_alerts_for_user', { p_user_id: driver.userId });
    if (replay.error) {
      // The preference save is authoritative and should not be rolled back only
      // because catch-up matching failed. New marketplace publications still
      // pass through the database trigger. Surface the degraded catch-up state.
      return json(200, {
        preference: mapPreference(data as Record<string, unknown>),
        context: await loadContext(driver.driverId),
        matchedRecent: 0,
        warning: 'Settings were saved, but recent open loads could not be rechecked. New loads will still be matched.',
      });
    }
    matchedRecent = Number(replay.data ?? 0) || 0;
  }

  return json(200, {
    preference: mapPreference(data as Record<string, unknown>),
    context: await loadContext(driver.driverId),
    matchedRecent,
  });
}
