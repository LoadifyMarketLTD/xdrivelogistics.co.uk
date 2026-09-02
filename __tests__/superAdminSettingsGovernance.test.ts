import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');
const MIGRATION = 'supabase/migrations/20260902103000_platform_settings_governance.sql';
const ROUTE = 'app/api/super-admin/settings/route.ts';

describe('Platform settings governance boundary', () => {
  it('closes direct tenant write paths while preserving governed RPC execution', () => {
    const migration = readRepoFile(MIGRATION);
    expect(migration).toContain('DROP POLICY IF EXISTS platform_settings_write_owner');
    expect(migration).toContain('DROP POLICY IF EXISTS platform_feature_flags_write_owner');
    expect(migration).toContain('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.platform_settings FROM anon, authenticated');
    expect(migration).toContain('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.platform_feature_flags FROM anon, authenticated');
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('SET search_path = pg_catalog, public');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.owner_update_platform_configuration(uuid, text, jsonb, text) FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.owner_update_platform_configuration(uuid, text, jsonb, text) TO service_role');
  });

  it('requires Platform Owner authority, reason and durable audit', () => {
    const migration = readRepoFile(MIGRATION);
    expect(migration).toContain('PERFORM public.assert_platform_owner_actor(p_actor_user_id)');
    expect(migration).toContain('A Platform configuration change reason of at least 5 characters is required.');
    expect(migration).toContain('INSERT INTO public.owner_audit_log');
    expect(migration).toContain("'platform_feature_flag_updated'");
    expect(migration).toContain("'platform_setting_updated'");
  });

  it('removes direct API upserts and keeps roles read-only', () => {
    const route = readRepoFile(ROUTE);
    const patch = route.slice(route.indexOf('export async function PATCH'));
    expect(patch).toContain("supabaseAdmin.rpc('owner_update_platform_configuration'");
    expect(patch).not.toContain(".from('platform_settings')");
    expect(patch).not.toContain(".from('platform_feature_flags')");
    expect(patch).not.toContain('.upsert(');
    expect(patch).toContain('Roles & Permissions is read-only');
  });
});
