import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260830183500_retire_legacy_accept_bid_rpcs.sql'),
  'utf8',
);

describe('legacy accept_bid RPC retirement', () => {
  it('drops both legacy accept_bid overloads', () => {
    expect(migration).toContain('DROP FUNCTION IF EXISTS public.accept_bid(uuid);');
    expect(migration).toContain('DROP FUNCTION IF EXISTS public.accept_bid(uuid, uuid);');
  });

  it('preserves the canonical atomic award path', () => {
    expect(migration).toContain("p.proname = 'accept_job_bid_atomic'");
    expect(migration).toContain('Canonical accept_job_bid_atomic(uuid, uuid) is missing.');
  });

  it('keeps the canonical award path off client roles', () => {
    expect(migration).toContain("has_function_privilege('anon'");
    expect(migration).toContain("has_function_privilege('authenticated'");
    expect(migration).toContain("has_function_privilege('service_role'");
    expect(migration).toContain('Canonical award RPC is unexpectedly executable by client roles.');
  });

  it('contains a zero-tolerance postcondition for legacy authority', () => {
    expect(migration).toContain("p.proname = 'accept_bid'");
    expect(migration).toContain('Legacy accept_bid overloads still exist after retirement');
  });
});
