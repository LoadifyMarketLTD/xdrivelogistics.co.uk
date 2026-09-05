import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const legalUi = read('app/components/workspace/LegalAgreementsPage.tsx');
const legalRoute = read('app/api/account/legal-agreements/route.ts');
const remediationMigration = read('supabase/migrations/20260905183500_registration_legal_initial_remediation.sql');
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
  it('reads and records acceptance only through the authenticated server route', () => {
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

  it('requires explicit current-date remediation for accounts with no immutable initial evidence', () => {
    expect(legalUi).toContain('initialEvidenceRemediationConfirmed: isInitialRemediation ? true : undefined');
    expect(legalUi).toContain('does not recreate or backdate my original registration acceptance.');
    expect(legalRoute).toContain('const isInitialRemediation = context.history.length === 0;');
    expect(legalRoute).toContain('payload.initialEvidenceRemediationConfirmed !== true');
    expect(legalRoute).toContain("const acceptanceSource = isInitialRemediation ? 'initial_remediation' : 'material_reacceptance';");
    expect(legalRoute).toContain('onboarding_application_id: isInitialRemediation ? context.onboardingApplicationId : null');
    expect(remediationMigration).toContain("source in ('registration', 'material_reacceptance', 'initial_remediation')");
    expect(remediationMigration).toContain("where source = 'initial_remediation'");
  });

  it('shows exact agreement versions and immutable evidence references', () => {
    expect(legalUi).toContain('v{agreement.version}');
    expect(legalUi).toContain('Evidence ID:');
    expect(legalUi).toContain('Evidence hash:');
    expect(legalUi).toContain('record.status');
    expect(legalUi).toContain("record.source.replace(/_/g, ' ')");
  });

  it('mounts the page only under existing protected account/settings route prefixes', () => {
    for (const route of protectedWorkspaceRoutes) {
      expect(fs.existsSync(path.join(process.cwd(), route))).toBe(true);
    }
    expect(customerAccount).toContain('/customer/account/legal-agreements');
    expect(brokerAccount).toContain('/broker/account/legal-agreements');
    expect(driverAccountNav).toContain('/driver/account/legal-agreements');
    expect(fleetSettingsLayout).toContain('/admin/settings/legal-agreements');
  });

  it('does not expose the owner-operator legal entry to ordinary company drivers', () => {
    expect(driverAccountNav).toContain("user?.ownerDriverWorkspace === true");
    expect(driverAccountNav).toContain("user?.workspaceRole === 'owner_driver'");
    expect(driverAccountNav).toContain('canSeeContractualHistory');
  });
});
