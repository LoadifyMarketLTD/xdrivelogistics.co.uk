import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = (name: string) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
const reviewer = migration('20260927131500_harden_reviewer_and_member_management_scope.sql');
const capability = migration('20260927145000_harden_company_capability_actor_state.sql');
const invite = migration('20260927162500_harden_membership_role_and_driver_invite.sql');
const authority = migration('20260929195813_canonicalize_company_membership_authority.sql');
const company = '11111111-1111-4111-8111-111111111111';
const actor = '22222222-2222-4222-8222-222222222222';
const outsider = '33333333-3333-4333-8333-333333333333';

async function setup(legacy = false) {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT '{"role":"authenticated"}'::jsonb $$;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, phone text);
    CREATE TABLE companies(id uuid PRIMARY KEY, created_by uuid, status text);
    CREATE TABLE profiles(user_id uuid PRIMARY KEY, role text, status text, full_name text, phone text);
    CREATE TABLE company_memberships(company_id uuid,user_id uuid,status text,role_in_company text);
    CREATE TABLE onboarding_applications(id uuid, company_id uuid);
    CREATE TABLE driver_identity_documents(file_path text,onboarding_application_id uuid);
    CREATE TABLE company_documents(file_path text,company_id uuid,onboarding_application_id uuid);
    CREATE FUNCTION is_owner(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
    CREATE FUNCTION active_company_membership_role(uuid,uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
      SELECT m.role_in_company FROM company_memberships m JOIN companies c ON c.id=m.company_id
      JOIN profiles p ON p.user_id=m.user_id
      WHERE m.company_id=$1 AND m.user_id=$2 AND m.status='active' AND c.status='active' AND p.status='active' LIMIT 1
    $$;
    INSERT INTO companies VALUES ('${company}','${outsider}','active');
    INSERT INTO profiles(user_id,role,status) VALUES ('${actor}','carrier','active'),('${outsider}','carrier','active');
    INSERT INTO company_memberships VALUES ('${company}','${actor}','active','admin');
    SELECT set_config('request.jwt.claim.sub','${actor}',false);
  `);
  if (legacy) await db.exec(`
    CREATE TABLE invites(id uuid DEFAULT gen_random_uuid(), token text,company_id uuid,status text,expires_at timestamptz,invite_email text,invite_phone text,used_by uuid,used_at timestamptz);
    CREATE TABLE workspace_switch_audit(target_company_id uuid);
    CREATE TABLE company_members(id uuid DEFAULT gen_random_uuid(),company_id uuid,user_id uuid,member_role text DEFAULT 'driver',company_role text,is_active boolean DEFAULT true,UNIQUE(company_id,user_id));
    CREATE TABLE company_role_capabilities(company_role text,capability_key text);
    CREATE TABLE member_capability_overrides(company_member_id uuid,capability_key text,is_allowed boolean);
  `);
  return db;
}

describe('September membership migrations execute against canonical and hosted legacy schemas', () => {
  it('replays the contact backfill without a hosted website column and only copies approved values', async () => {
    const db = new PGlite();
    try {
      await db.exec(`CREATE TABLE companies(id uuid PRIMARY KEY,email text);
        CREATE TABLE onboarding_applications(company_id uuid,payload jsonb,status text,created_at timestamptz);
        INSERT INTO companies VALUES ('${company}',null);
        INSERT INTO onboarding_applications VALUES
          ('${company}','{"website":"https://approved.example.test","contact_email":"approved@example.test"}','approved','2026-10-01'),
          ('${company}','{"website":"https://pending.example.test","contact_email":"pending@example.test"}','pending','2026-10-02');`);
      const backfill = migration('20261003222500_backfill_existing_company_contact_from_onboarding.sql');
      await db.exec(backfill);
      await db.exec(backfill);
      expect((await db.query(`SELECT email,website FROM companies`)).rows[0]).toEqual({
        email: 'approved@example.test', website: 'https://approved.example.test',
      });
    } finally { await db.close(); }
  });

  it('replays all three migrations without creating retired tables or RPCs on a canonical schema', async () => {
    const db = await setup();
    try {
      await db.exec(reviewer);
      await db.exec(capability);
      await db.exec(invite);
      await db.exec(authority);
      const { rows } = await db.query(`SELECT to_regclass('public.company_members') AS legacy_table,
        to_regprocedure('public.has_capability(uuid,text)') AS capability,
        to_regprocedure('public.accept_driver_invite(text,text,text)') AS invite,
        can_manage_company_members('${company}') AS allowed`);
      expect(rows[0]).toEqual({ legacy_table: null, capability: null, invite: null, allowed: true });
      await db.exec(`UPDATE company_memberships SET status='inactive'`);
      expect((await db.query(`SELECT can_manage_company_members('${company}') AS allowed`)).rows[0]).toEqual({ allowed: false });
      await db.exec(`UPDATE company_memberships SET status='active',role_in_company='driver'`);
      expect((await db.query(`SELECT can_manage_company_members('${company}') AS allowed`)).rows[0]).toEqual({ allowed: false });
      await db.exec(`UPDATE company_memberships SET role_in_company='admin'; UPDATE companies SET status='suspended'`);
      expect((await db.query(`SELECT can_manage_company_members('${company}') AS allowed`)).rows[0]).toEqual({ allowed: false });
    } finally { await db.close(); }
  });

  it('still hardens existing legacy capability decisions and denies anonymous execution', async () => {
    const db = await setup(true);
    try {
      await db.exec(reviewer); await db.exec(capability); await db.exec(invite); await db.exec(authority);
      await db.exec(`INSERT INTO company_members(company_id,user_id,company_role) VALUES ('${company}','${actor}','carrier_admin');
        INSERT INTO company_role_capabilities VALUES ('carrier_admin','edit');`);
      expect((await db.query(`SELECT has_capability('${company}','edit') AS allowed`)).rows[0]).toEqual({ allowed: true });
      await db.exec(`INSERT INTO member_capability_overrides SELECT id,'edit',false FROM company_members`);
      expect((await db.query(`SELECT has_capability('${company}','edit') AS allowed`)).rows[0]).toEqual({ allowed: false });
      await db.exec(`DELETE FROM member_capability_overrides; UPDATE profiles SET status='suspended' WHERE user_id='${actor}'`);
      expect((await db.query(`SELECT has_capability('${company}','edit') AS allowed`)).rows[0]).toEqual({ allowed: false });
      expect((await db.query(`SELECT has_function_privilege('anon','public.has_capability(uuid,text)','execute') AS allowed,
        has_function_privilege('anon','public.accept_driver_invite(text,text,text)','execute') AS invite_allowed`)).rows[0])
        .toEqual({ allowed: false, invite_allowed: false });
    } finally { await db.close(); }
  });

  it('keeps identity and active-company checks when accepting a hosted legacy invite', async () => {
    const db = await setup(true);
    try {
      await db.exec(invite);
      await db.exec(`INSERT INTO auth.users VALUES ('${actor}','driver@example.test',null);
        INSERT INTO invites(token,company_id,status,expires_at,invite_email) VALUES ('test-token','${company}','sent',now()+interval '1 day','someone-else@example.test');`);
      await expect(db.query(`SELECT * FROM accept_driver_invite('test-token')`)).rejects.toThrow('different email');
      await db.exec(`UPDATE invites SET invite_email='driver@example.test'; UPDATE companies SET status='suspended'`);
      await expect(db.query(`SELECT * FROM accept_driver_invite('test-token')`)).rejects.toThrow('not active');
      await db.exec(`UPDATE companies SET status='active'`);
      await db.query(`SELECT * FROM accept_driver_invite('test-token','Test Driver')`);
      expect((await db.query(`SELECT status,used_by FROM invites`)).rows[0]).toEqual({ status: 'accepted', used_by: actor });
      expect((await db.query(`SELECT member_role FROM company_members`)).rows[0]).toEqual({ member_role: 'driver' });
    } finally { await db.close(); }
  });
  it('keeps hosted invitation policies effective for tenant admins and denies an outsider', async () => {
    const db = await setup(true);
    try {
      await db.exec(authority);
      await db.exec(`ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
        GRANT SELECT,INSERT ON invites TO authenticated;
        SET ROLE authenticated;
        INSERT INTO invites(token,company_id,status) VALUES ('admin-invite','${company}','sent');`);
      expect((await db.query(`SELECT count(*)::int AS n FROM invites`)).rows[0]).toEqual({ n: 1 });
      await db.query(`SELECT set_config('request.jwt.claim.sub','${outsider}',false)`);
      await expect(db.query(`INSERT INTO invites(token,company_id,status) VALUES ('outsider-invite','${company}','sent')`)).rejects.toThrow('row-level security');
    } finally { await db.close(); }
  });

});
