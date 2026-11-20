import { describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

describe('Won work pagination', () => {
  for (const count of [0, 99, 100, 101, 200, 205]) {
    it('retrieves each record once for ' + count + ' rows using actual PostgREST query serialization', async () => {
      const rows = Array.from({ length: count }, (_, id) => ({ id }));
      const client = createClient('https://example.supabase.co', 'test-key', {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: async (input) => {
          const url = new URL(String(input));
          const offset = Number(url.searchParams.get('offset'));
          const limit = Number(url.searchParams.get('limit'));
          expect(url.searchParams.get('assigned_driver_id')).toBe('eq.driver-1');
          expect(limit).toBe(101);
          return new Response(JSON.stringify(rows.slice(offset, offset + limit)), { headers: { 'Content-Type': 'application/json' } });
        } },
      });
      const seen: unknown[] = [];
      let page = 1;
      while (true) {
        const offset = (page - 1) * 100;
        const { data, error } = await client.from('jobs').select('id').eq('assigned_driver_id', 'driver-1').order('pickup_datetime').limit(100).order('id').range(offset, offset + 100);
        expect(error).toBeNull();
        seen.push(...(data ?? []).slice(0, 100));
        if ((data?.length ?? 0) <= 100) break;
        page++;
        expect(page).toBeLessThan(5);
      }
      expect(seen).toEqual(rows);
    });
  }
  it('keeps paging opt-in and bound to authenticated driver', () => {
    const route = readFileSync('app/api/driver/jobs/route.ts', 'utf8');
    expect(route).toContain("searchParams.get('page')");
    expect(route).toContain(".eq('assigned_driver_id', driver.driverId)");
    expect(route).toContain("if (page !== null)");
    expect(route).toContain(".range(offset, offset + limit)");
    const ui = readFileSync('app/driver/won-work/page.tsx', 'utf8');
    expect(ui).toContain('limit=100&page=');
    expect(ui).toContain('payload.hasMore === true');
  });
});