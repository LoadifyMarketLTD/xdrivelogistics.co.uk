import { NextRequest } from 'next/server';
import { isDriverContext, requireDriver, respond } from '../_lib';

export async function POST(request: NextRequest) {
  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return respond(400, { error: 'Invalid JSON body.' });
  }

  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!token) return respond(400, { error: 'token is required.' });

  const { error } = await driver.db
    .from('drivers')
    .update({ device_token: token })
    .eq('id', driver.driverId);

  if (error) return respond(500, { error: error.message });
  return respond(200, { ok: true });
}
