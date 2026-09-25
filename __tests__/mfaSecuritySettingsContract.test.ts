import fs from 'node:fs';
import path from 'node:path';

const workspace = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/RoleSettingsWorkspace.tsx'), 'utf8');
const panel = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/MfaSecurityPanel.tsx'), 'utf8');

describe('XDrive MFA security settings', () => {
  it('uses Supabase TOTP MFA rather than a decorative toggle', () => {
    expect(panel).toContain("supabase.auth.mfa.enroll({ factorType: 'totp'");
    expect(panel).toContain('supabase.auth.mfa.challengeAndVerify');
    expect(panel).toContain('supabase.auth.mfa.unenroll');
    expect(panel).toContain('supabase.auth.mfa.listFactors');
    expect(panel).toContain('supabase.auth.mfa.getAuthenticatorAssuranceLevel');
  });

  it('supports QR/secret enrollment and six-digit verification', () => {
    expect(panel).toContain('data.totp.qr_code');
    expect(panel).toContain('data.totp.secret');
    expect(panel).toContain('6-DIGIT CODE');
    expect(panel).toContain("replace(/\\D/g, '').slice(0, 6)");
  });

  it('requires AAL2 verification before disabling a verified factor when needed', () => {
    expect(panel).toContain("currentLevel !== 'aal2'");
    expect(panel).toContain('Verify the 6-digit authenticator code before disabling two-factor authentication.');
    expect(panel).toContain('challengeAndVerify({ factorId: verifiedFactor.id');
  });

  it('is wired into the shared role Security settings for all scoped workspaces', () => {
    expect(workspace).toContain("{ label: 'Security'");
    expect(workspace).toContain('<MfaSecurityPanel />');
  });
});
