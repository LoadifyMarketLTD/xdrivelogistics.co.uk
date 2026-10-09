import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { isWebDriverContext, requireActiveWebDriver } from '../_lib/webDriverContext';

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

function isMissingFuturePositionColumn(error: { code?: string | null; message?: string | null } | null | undefined) {
  if (!error) return false;
  const message = String(error.message ?? '').toLowerCase();
  return ['42703', 'PGRST204'].includes(String(error.code ?? '').toUpperCase())
    && (message.includes('future_position') || message.includes('future_position_date') || message.includes('future_availability_notes'));
}

export async function PUT(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Future-position publishing is temporarily unavailable.' });
  }

  const driver = await requireActiveWebDriver(request);
  if (!isWebDriverContext(driver)) return driver;

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const position = typeof body.futurePosition === 'string' ? body.futurePosition.trim() : '';
  const dateText = typeof body.futureDate === 'string' ? body.futureDate.trim() : '';
  const untilText = typeof body.futureUntil === 'string' ? body.futureUntil.trim() : '';
  const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 1000) : '';
  if (position.length > 160) return json(400, { error: 'Future position must be 160 characters or fewer.' });

  let futureDate: string | null = null;
  if (dateText) {
    const parsed = new Date(dateText);
    if (Number.isNaN(parsed.getTime())) return json(400, { error: 'Future-position date/time is invalid.' });
    if (parsed.getTime() <= Date.now()) return json(400, { error: 'Future-position date/time must be in the future.' });
    futureDate = parsed.toISOString();
  }
  let futureUntil: string | null = null;
  if (untilText) {
    const parsed = new Date(untilText);
    if (Number.isNaN(parsed.getTime())) return json(400, { error: 'Future-position end date/time is invalid.' });
    if (parsed.getTime() <= Date.now()) return json(400, { error: 'Future-position end date/time must be in the future.' });
    if (futureDate && parsed.getTime() <= new Date(futureDate).getTime()) return json(400, { error: 'Future-position end must be after the start.' });
    futureUntil = parsed.toISOString();
  }

  // Only the self-owned future-capacity fields below are writable through this
  // service-role boundary. General drivers-table UPDATE remains operator/admin
  // controlled by the existing RLS contract.
  const { data, error } = await supabaseAdmin
    .from('drivers')
    .update({
      future_position: position || null,
      future_position_date: futureDate,
      future_position_until: position ? futureUntil : null,
      future_availability_notes: position ? (notes || null) : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', driver.driverId)
    .eq('user_id', driver.userId)
    .eq('app_access', true)
    .eq('status', 'active')
    .select('id, future_position, future_position_date, future_position_until, future_availability_notes, availability_status, status')
    .maybeSingle();

  if (error) {
    if (isMissingFuturePositionColumn(error)) {
      return json(503, {
        error: 'Future-position publishing is not enabled in this database build yet.',
        code: 'FUTURE_POSITION_SCHEMA_UNAVAILABLE',
      });
    }
    return json(500, { error: 'Future position could not be saved.' });
  }
  if (!data) return json(409, { error: 'Your active Driver workspace record could not be updated.' });

  return json(200, { driver: data });
}
