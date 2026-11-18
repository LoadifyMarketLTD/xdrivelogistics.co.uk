import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
const read = (name: string) => fs.readFileSync(path.join(process.cwd(), name), 'utf8');
const mobile = 'app/api/driver/mobile/jobs/[id]/stop-status/route.ts';
const web = 'app/api/driver/web/jobs/[id]/webStopStatus.ts';
const endpoint = 'app/api/driver/jobs/[jobId]/custody-resolution/route.ts';
const cancellationSql = 'supabase/migrations/20261117174000_atomic_driver_stop_cancellation.sql';
const resolutionSql = 'supabase/migrations/20261117175000_authorised_goods_custody_resolution.sql';
describe('driver cancellation and custody safety contracts', () => {
  for (const route of [mobile, web]) {
    it(`${route} invokes atomic cancellation`, () => {
      const source = read(route);
      expect(source).toContain(".rpc('apply_driver_stop_cancellation_atomic'");
      expect(source).not.toMatch(/if \(followUpId\) await supabaseAdmin!?\.from\('job_stops'\)\.delete\(/);
    });
  }
  it('custody endpoint verifies bearer identity and calls authorised atomic RPC', () => {
    const source = read(endpoint);
    expect(source).toContain('getBearerToken(request)');
    expect(source).toContain('.auth.getUser(token)');
    expect(source).toContain(".rpc('resolve_driver_goods_custody_atomic'");
  });
  it('cancellation SQL locks parent and stop and restricts execution to service role', () => {
    const sql = read(cancellationSql);
    expect(sql).toContain('FOR UPDATE');
    expect(sql).toContain('Assigned active driver required');
    expect(sql).toContain('TO service_role');
  });
  it('custody SQL checks dispatcher membership and requires unresolved custody', () => {
    const sql = read(resolutionSql);
    expect(sql).toContain('public.company_memberships');
    expect(sql).toContain("role_in_company::text IN ('owner','admin','dispatcher')");
    expect(sql).toContain("'resolutionRequired',false");
    expect(sql).toContain('TO service_role');
  });
});
