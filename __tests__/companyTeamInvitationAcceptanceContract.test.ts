import fs from 'node:fs';
import path from 'node:path';

const teamRoute = fs.readFileSync(
  path.join(process.cwd(), 'app/api/customer/team/route.ts'),
  'utf8',
);
const acceptRoute = fs.readFileSync(
  path.join(process.cwd(), 'app/api/team-invitations/accept/route.ts'),
  'utf8',
);
const resetPassword = fs.readFileSync(
  path.join(process.cwd(), 'app/reset-password/page.tsx'),
  'utf8',
);
const authCallback = fs.readFileSync(
  path.join(process.cwd(), 'app/auth/callback/page.tsx'),
  'utf8',
);
const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260927041000_accept_company_team_invitation_atomic.sql'),
  'utf8',
);

describe('company team invitation activation contract', () => {
  it('keeps new team users pending and memberships invited until explicit acceptance', () => {
    expect(teamRoute).toContain("status: 'pending'");
    expect(teamRoute).toContain("status: 'invited'");
    expect(teamRoute).toContain("flow=team-invite");
    expect(teamRoute).toContain('getAuthCallbackEmailRedirectTo()');
    expect(teamRoute).toContain('getResetPasswordEmailRedirectTo()');
    expect(teamRoute).toContain('conflictingPendingMembership');
  });

  it('activates only through a service-side atomic RPC bound to the authenticated user', () => {
    expect(acceptRoute).toContain("getBearerToken(request)");
    expect(acceptRoute).toContain('validatorClient.auth.getUser(token)');
    expect(acceptRoute).toContain("rpc('accept_company_team_invitation_atomic'");
    expect(migration).toContain("cm.status = 'invited'");
    expect(migration).toContain("cm.status = 'active'");
    expect(migration).toContain("SET status = 'active'");
    expect(migration).toContain("v_invited_count <> 1");
    expect(migration).toContain("v_active_count > 0");
    expect(migration).toContain("v_company_status <> 'active'");
    expect(migration).toContain("COALESCE(v_profile.role, '') NOT IN ('customer', 'broker')");
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.accept_company_team_invitation_atomic(uuid)');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.accept_company_team_invitation_atomic(uuid)');
    expect(migration).toContain('TO service_role');
  });

  it('accepts the invitation after password setup for new users and after magic-link auth for existing users', () => {
    expect(resetPassword).toContain("setIsTeamInvite((signals?.flow ?? '').trim().toLowerCase() === 'team-invite')");
    expect(resetPassword).toContain("fetch('/api/team-invitations/accept'");
    expect(authCallback).toContain("const isTeamInvite = (signals.flow ?? '').trim().toLowerCase() === 'team-invite'");
    expect(authCallback).toContain("fetch('/api/team-invitations/accept'");
  });
});
