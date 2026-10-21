import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20261021143000_enforce_owner_driver_canonical_owner_authority.sql',
);

const sql = fs.readFileSync(migrationPath, 'utf8');

describe('Owner Driver canonical owner authority', () => {
  it('requires verified owner-driver identity before granting company owner authority', () => {
    expect(sql).toContain("oa.account_type::text = 'owner_driver'");
    expect(sql).toContain("oa.status::text = 'approved'");
    expect(sql).toContain('c.created_by = p_user_id');
    expect(sql).toContain('p.company_id = p_company_id');
    expect(sql).toContain("d.driver_type::text, '') = 'owner_driver'");
    expect(sql).toContain('d.company_id = oa.company_id');
  });

  it('forces the verified owner-driver membership to owner and protects it from downgrade/delete', () => {
    expect(sql).toContain("NEW.role_in_company := 'owner'");
    expect(sql).toContain('trg_enforce_verified_owner_driver_membership_role');
    expect(sql).toContain('trg_protect_verified_owner_driver_membership_delete');
    expect(sql).toContain('Verified Owner Driver ownership membership cannot be deleted');
  });

  it('fixes onboarding approval so an old member/admin role cannot survive for owner-driver', () => {
    expect(sql).toContain("IF v_account_type = 'owner_driver' THEN");
    expect(sql).toContain("role_in_company = 'owner'");
    expect(sql).toContain("status = 'active'");
    expect(sql).toContain('Owner Driver approval did not produce a canonical owner + driver company identity');
    expect(sql).toContain('ELSIF v_existing_membership_role IS NOT NULL THEN');
  });

  it('repairs only canonical approved owner-driver rows and never guesses ownership from metadata', () => {
    expect(sql).toContain('c.created_by = oa.user_id');
    expect(sql).toContain('p.company_id = oa.company_id');
    expect(sql).toContain('d.company_id = oa.company_id');
    expect(sql).toContain("d.driver_type::text = 'owner_driver'");
    expect(sql).toContain("oa.status::text = 'approved'");
    expect(sql).not.toContain('raw_user_meta_data');
  });

  it('provides a safe auth repair RPC that cannot create owner authority without approved onboarding', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.bootstrap_owner_driver_workspace()');
    expect(sql).toContain('Approved canonical Owner Driver company binding is required.');
    expect(sql).toContain('Canonical Owner Driver record is missing; authority cannot be bootstrapped.');
    expect(sql).not.toContain('get_or_create_company_for_user()');
  });

  it('fails the migration if any verified active owner-driver still lacks an active owner membership', () => {
    expect(sql).toContain('Owner Driver authority invariant failed for % verified account(s).');
    expect(sql).toContain("cm.role_in_company::text = 'owner'");
    expect(sql).toContain("cm.status::text = 'active'");
  });
});
