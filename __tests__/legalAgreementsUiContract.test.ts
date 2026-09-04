import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const legalUi = read('app/components/workspace/LegalAgreementsPage.tsx');
const customerAccount = read('app/components/workspace/CustomerCompanySettingsPage.tsx');
const brokerAccount = read('app/broker/account/page.tsx');
const driverAccountNav = read('app/driver/_components/AccountSectionNav.tsx');
const fleetSettingsLayout = read('app/admin/settings/layout.tsx');

const protectedWorkspaceRoutes = [
  'app/customer/account/legal-agreements/page.tsx',
  'app/broker/account/legal-agreements/page.tsx',
  'app/driver/account/legal-agreements/page.tsx',
  'app/admin/settings/legal-agreements/page.tsx',
];

describe('Legal & Agreements account UI contract', () => {
  it('reads and re-accepts only through the authenticated server route', () => {
    expect(legalUi).toContain("fetch('/api/account/legal-agreements'");
    expect(legalUi).toContain('Authorization: `Bearer ${token}`');
    expect(legalUi).not.toContain(".from('registration_legal_acceptances')");
    expect(legalUi).not.toContain('.from("registration_legal_acceptances")');
  });

  it('requires separate contractual, authority, role and privacy confirmations', () => {
    expect(legalUi).toContain('agreementsAccepted: true');
    expect(legalUi).toContain('authorityConfirmed: true');
    expect(legalUi).toContain('roleDeclarationConfirmed: true');
    expect(legalUi).toContain('privacyAcknowledged: true');
    expect(legalUi).toContain('Privacy acknowledgement remains separate from contractual acceptance.');
  });

  it('shows exact agreement versions and immutable evidence references', () => {
    expect(legalUi).toContain('v{agreement.version}');
    expect(legalUi).toContain('Evidence ID:');
    expect(legalUi).toContain('Evidence hash:');
    expect(legalUi).toContain("record.status");
    expect(legalUi).toContain("record.source.replace(/_/g, ' ')");
  });

  it('mounts the page only under existing protected account/settings route prefixes', () => {
    for (const route of protectedWorkspaceRoutes) {
      expect(fs.existsSync(path.join(process.cwd(), route))).toBe(true);
    }
    expect(customerAccount).toContain("/customer/account/legal-agreements");
    expect(brokerAccount).toContain("/broker/account/legal-agreements");
    expect(driverAccountNav).toContain("/driver/account/legal-agreements");
    expect(fleetSettingsLayout).toContain("/admin/settings/legal-agreements");
  });

  it('does not expose the owner-operator legal entry to ordinary company drivers', () => {
    expect(driverAccountNav).toContain("user?.ownerDriverWorkspace === true");
    expect(driverAccountNav).toContain("user?.workspaceRole === 'owner_driver'");
    expect(driverAccountNav).toContain('canSeeContractualHistory');
  });
});
