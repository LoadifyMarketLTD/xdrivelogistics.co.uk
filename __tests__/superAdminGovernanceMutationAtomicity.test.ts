import fs from 'node:fs';
import path from 'node:path';

describe('Super Admin governance mutation atomicity', () => {
  const root = process.cwd();
  const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

  it('routes notification retry through the atomic audited RPC and removes direct queue writes', () => {
    const route = read('app/api/super-admin/platform/route.ts');
    const migration = read('supabase/migrations/20260831020000_platform_notification_retry_audit.sql');

    expect(route).toContain("supabaseAdmin.rpc('owner_retry_notification_event'");
    expect(route).not.toMatch(/\.from\('notification_events'\)\s*\.update\(/s);
    expect(route).toContain('migrationRequired: true');
    expect(route).toContain('reason.length < 5');

    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.owner_retry_notification_event');
    expect(migration).toContain('PERFORM public.assert_platform_owner_actor(p_actor_user_id)');
    expect(migration).toContain("INSERT INTO public.owner_audit_log");
    expect(migration).toContain("'notification_retry_queued'");
    expect(migration).toContain("lower(COALESCE(v_event.status, '')) NOT IN ('failed', 'skipped')");
  });

  it('routes Platform configuration changes through one atomic audited RPC', () => {
    const route = read('app/api/super-admin/settings/route.ts');
    const migration = read('supabase/migrations/20260831022000_platform_settings_governance.sql');

    expect(route).toContain("supabaseAdmin.rpc('owner_update_platform_configuration'");
    expect(route).not.toContain(".from('platform_feature_flags').upsert");
    expect(route).not.toContain(".from('platform_settings').upsert");
    expect(route).toContain('Roles & Permissions is read-only');
    expect(route).toContain('migrationRequired: true');

    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.owner_update_platform_configuration');
    expect(migration).toContain('PERFORM public.assert_platform_owner_actor(p_actor_user_id)');
    expect(migration).toContain("v_section NOT IN ('feature-flags', 'global')");
    expect(migration).toContain("'platform_feature_flag_updated'");
    expect(migration).toContain("'platform_setting_updated'");
    expect(migration).toContain('INSERT INTO public.owner_audit_log');
  });

  it('requires written reasons at both API and database boundaries', () => {
    const platformRoute = read('app/api/super-admin/platform/route.ts');
    const settingsRoute = read('app/api/super-admin/settings/route.ts');
    const notificationMigration = read('supabase/migrations/20260831020000_platform_notification_retry_audit.sql');
    const settingsMigration = read('supabase/migrations/20260831022000_platform_settings_governance.sql');

    expect(platformRoute).toContain('reason.length < 5');
    expect(settingsRoute).toContain('reason: z.string().trim().min(5).max(5000)');
    expect(notificationMigration).toContain('char_length(v_reason) < 5');
    expect(settingsMigration).toContain('char_length(v_reason) < 5');
  });
});
