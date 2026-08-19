import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260819155000_restrict_safe_dedup_drivers_execution.sql'),
  'utf8',
);

describe('safe_dedup_drivers execution boundary', () => {
  it('keeps the destructive SECURITY DEFINER helper off end-user roles', () => {
    expect(source).toContain('REVOKE ALL ON FUNCTION public.safe_dedup_drivers(uuid) FROM PUBLIC;');
    expect(source).toContain('REVOKE ALL ON FUNCTION public.safe_dedup_drivers(uuid) FROM anon;');
    expect(source).toContain('REVOKE ALL ON FUNCTION public.safe_dedup_drivers(uuid) FROM authenticated;');
    expect(source).toContain('GRANT EXECUTE ON FUNCTION public.safe_dedup_drivers(uuid) TO service_role;');
  });

  it('fails closed if the expected helper is missing', () => {
    expect(source).toContain("to_regprocedure('public.safe_dedup_drivers(uuid)') IS NULL");
    expect(source).toContain("USING ERRCODE = '42883'");
  });
});
