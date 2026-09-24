import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/MemberDirectoryPage.tsx'), 'utf8');

describe('CX Directory profile and messaging parity', () => {
  it('keeps a real profile target that distinguishes companies from individual drivers', () => {
    expect(source).toContain("const [profileTarget, setProfileTarget]");
    expect(source).toContain("setProfileTarget({ companyId: company.companyId })");
    expect(source).toContain("driverId: driver.driverId");
    expect(source).toContain("<MemberProfileOverlay companyId={profileTarget.companyId} driverId={profileTarget.driverId}");
  });

  it('exposes Profile and Messages actions across shared role directories', () => {
    expect(source).toContain('>Profile</ActionButton>');
    expect(source).toContain('>Messages</ActionButton>');
    expect(source).toContain('openMemberMessages');
  });

  it('does not nest the member profile button inside another button in the Driver table', () => {
    expect(source).not.toContain('<button type="button" className="dir-member-link"><b><MemberIdentityLink');
    expect(source).toContain('<div className="dir-member-link"><b><MemberIdentityLink');
  });
});
