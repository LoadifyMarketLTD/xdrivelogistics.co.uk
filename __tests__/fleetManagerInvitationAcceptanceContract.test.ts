import fs from 'node:fs';
import path from 'node:path';

const managerApi = fs.readFileSync(
  path.join(process.cwd(), 'app/api/admin/fleet/managers/route.ts'),
  'utf8',
);
const acceptanceMigration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260927103000_generalize_company_team_invitation_acceptance.sql'),
  'utf8',
);
const acceptRoute = fs.readFileSync(
  path.join(process.cwd(), 'app/api/team-invitations/accept/route.ts'),
  'utf8',
);

describe('Fleet Manager invitation acceptance boundary', () => {
  it('keeps Fleet Manager authority pending until the invitee authenticates and accepts', () => {
    expect(managerApi).toContain("status: 'pending'");
    expect(managerApi).toContain("status: 'invited'");
    expect(managerApi).toContain('flow=team-invite&workspace=fleet_manager');
    expect(managerApi).toContain('getAuthCallbackEmailRedirectTo()');
    expect(managerApi).toContain('getResetPasswordEmailRedirectTo()');
    expect(managerApi).not.toContain("status: 'active',\n      company_id: access.companyId");
  });

  it('denies cross-company active and pending membership collisions', () => {
    expect(managerApi).toContain("This account already belongs to another active company workspace.");
    expect(managerApi).toContain("This account already has a pending invitation for another company workspace.");
    expect(managerApi).toContain("existingProfile.company_id !== access.companyId");
  });

  it('uses the shared authenticated acceptance endpoint', () => {
    expect(acceptRoute).toContain("rpc('accept_company_team_invitation_atomic'");
    expect(managerApi).toContain("delivery: 'auth_invite' | 'magic_link'");
  });

  it('allows company_staff activation only for Fleet Manager membership', () => {
    expect(acceptanceMigration).toContain("v_profile_role = 'company_staff'");
    expect(acceptanceMigration).toContain("v_membership_role <> 'fleet_manager'");
    expect(acceptanceMigration).toContain("COALESCE(v_profile.status::text, '') <> 'pending'");
    expect(acceptanceMigration).toContain("v_profile_role IN ('customer', 'broker')");
    expect(acceptanceMigration).toContain("v_membership_role NOT IN ('admin', 'dispatcher', 'viewer')");
    expect(acceptanceMigration).toContain('TO service_role');
    expect(acceptanceMigration).toContain('FROM PUBLIC, anon, authenticated');
  });
});
