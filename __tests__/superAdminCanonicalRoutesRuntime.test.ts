import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { finiteNumberOrNull, isTimestampFresh } from '../app/api/super-admin/_lib/operationalMapTruth';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const routes = [
  'app/api/super-admin/inspect/[entityType]/[entityId]/route.ts',
  'app/api/super-admin/inspect/company/[entityId]/360/route.ts',
  'app/api/super-admin/operations-cockpit/route.ts',
];

describe('Super Admin canonical read-only route contract', () => {
  it.each(routes)('checks canonical owner authority before dispatching %s', (file) => {
    const source = read(file);
    const handler = source.slice(source.indexOf('export async function GET'));
    expect(source).toContain('verifyPlatformOwner');
    expect(handler).toContain('const owner = await verifyPlatformOwner(request)');
    expect(handler).toContain('if (!owner) return respond(403');
    expect(handler.indexOf('const owner = await verifyPlatformOwner(request)')).toBeLessThan(
      handler.indexOf('if (!owner) return respond(403'),
    );
  });

  it.each(routes)('uses the same map freshness contract in %s', (file) => {
    expect(read(file)).toContain('isTimestampFresh');
  });

  it('does not turn absent coordinates into a real position at latitude and longitude zero', () => {
    expect(finiteNumberOrNull(null)).toBeNull();
    expect(finiteNumberOrNull(undefined)).toBeNull();
    expect(finiteNumberOrNull('')).toBeNull();
    expect(finiteNumberOrNull('  ')).toBeNull();
    expect(finiteNumberOrNull(false)).toBeNull();
    expect(finiteNumberOrNull('oops')).toBeNull();
    expect(finiteNumberOrNull(Infinity)).toBeNull();
    expect(finiteNumberOrNull(0)).toBe(0);
    expect(finiteNumberOrNull('53.4808')).toBe(53.4808);
    expect(finiteNumberOrNull(-2.2426)).toBe(-2.2426);
    expect(read(routes[2])).toContain('const num = finiteNumberOrNull');
  });

  it('only treats fresh real timestamps as live telemetry', () => {
    const now = Date.UTC(2026, 9, 22, 7, 0, 0);
    expect(isTimestampFresh(null, now)).toBe(false);
    expect(isTimestampFresh('invalid', now)).toBe(false);
    expect(isTimestampFresh(now - 31 * 60_000, now)).toBe(false);
    expect(isTimestampFresh(now - 10 * 60_000, now)).toBe(true);
    expect(isTimestampFresh(now, now)).toBe(true);
    expect(isTimestampFresh(now + 5 * 60_000, now)).toBe(false);
  });

  it('requires freshness even for busy drivers and validates Company 360 identifiers', () => {
    const driver = read(routes[0]);
    const company = read(routes[1]);
    expect(driver).toContain('(!locationFresh && !presenceUsable)');
    expect(company).toContain('(!fresh && !presenceActive)');
    expect(company).toContain('Invalid company identifier.');
    expect(company).toContain('driver.is_active === false');
  });
});
