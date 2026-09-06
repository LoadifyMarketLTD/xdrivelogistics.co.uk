import { spawnSync } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, CI: process.env.CI ?? 'true' },
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) process.exit(1);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const isLegalGatePreview =
  process.env.CONTEXT === 'deploy-preview' && process.env.REVIEW_ID === '499';
const isGoLiveHardeningPreview =
  process.env.CONTEXT === 'deploy-preview' &&
  ['500', '501'].includes(process.env.REVIEW_ID ?? '');
const isSuperAdminHomePreview =
  process.env.CONTEXT === 'deploy-preview' && process.env.REVIEW_ID === '504';
const isSuperAdminControlPlanePreview =
  process.env.CONTEXT === 'deploy-preview' &&
  ['505', '506'].includes(process.env.REVIEW_ID ?? '');

const legalLintTargets = [
  '__tests__/legalAgreementState.test.ts',
  '__tests__/legalAgreementsUiContract.test.ts',
  '__tests__/registrationLegalEvidence.test.ts',
  'app/admin/settings/layout.tsx',
  'app/admin/settings/legal-agreements/page.tsx',
  'app/api/account/legal-agreements/route.ts',
  'app/api/onboarding/init/route.ts',
  'app/broker/account/legal-agreements/page.tsx',
  'app/broker/account/page.tsx',
  'app/components/workspace/CustomerCompanySettingsPage.tsx',
  'app/components/workspace/LegalAgreementsPage.tsx',
  'app/customer/account/legal-agreements/page.tsx',
  'app/driver/_components/AccountSectionNav.tsx',
  'app/driver/account/legal-agreements/page.tsx',
  'app/legal/page.tsx',
  'app/register/RegistrationAgreementGate.tsx',
  'app/register/page.tsx',
  'lib/legal/contractualGate.ts',
  'lib/legal/legalAgreementState.ts',
  'lib/legal/registrationAgreements.ts',
  'lib/legal/registrationEvidence.ts',
];

const legalUnitTests = [
  '__tests__/legalAgreementState.test.ts',
  '__tests__/legalAgreementsUiContract.test.ts',
  '__tests__/registrationLegalEvidence.test.ts',
];

const goLiveHardeningLintTargets = [
  '__tests__/commandCentreMetrics.test.ts',
  '__tests__/goLiveHardeningMigrationContract.test.ts',
  '__tests__/goLiveTenantReviewerHardening.test.ts',
  'app/api/super-admin/command-centre/route.ts',
];

const goLiveHardeningUnitTests = [
  '__tests__/commandCentreMetrics.test.ts',
  '__tests__/goLiveHardeningMigrationContract.test.ts',
  '__tests__/goLiveTenantReviewerHardening.test.ts',
];

const superAdminHomeLintTargets = [
  '__tests__/superAdminStatsContract.test.ts',
  'app/api/super-admin/stats/route.ts',
  'app/super-admin/page.tsx',
  'e2e/super-admin.spec.ts',
];

const superAdminHomeUnitTests = [
  '__tests__/superAdminStatsContract.test.ts',
  '__tests__/commandCentreMetrics.test.ts',
];

const superAdminControlPlaneLintTargets = [
  '__tests__/invoiceStatusCanonical.test.ts',
  '__tests__/superAdminControlPlaneCompleteness.test.ts',
  '__tests__/superAdminNavbarContract.test.ts',
  '__tests__/superAdminPlatformHealth.test.ts',
  '__tests__/superAdminVisualContract.test.ts',
  'app/api/super-admin/_lib/platformHealth.ts',
  'app/api/super-admin/_lib/verifyPlatformOwner.ts',
  'app/api/super-admin/audit/route.ts',
  'app/api/super-admin/brokers/route.ts',
  'app/api/super-admin/cases/route.ts',
  'app/api/super-admin/command-centre/route.ts',
  'app/api/super-admin/companies/[id]/route.ts',
  'app/api/super-admin/companies/approval-readiness/route.ts',
  'app/api/super-admin/companies/route.ts',
  'app/api/super-admin/companies/summary/route.ts',
  'app/api/super-admin/compliance/route.ts',
  'app/api/super-admin/email-readiness/route.ts',
  'app/api/super-admin/finance/route.ts',
  'app/api/super-admin/finance/summary/route.ts',
  'app/api/super-admin/governance/route.ts',
  'app/api/super-admin/health/route.ts',
  'app/api/super-admin/marketplace/[id]/route.ts',
  'app/api/super-admin/marketplace/route.ts',
  'app/api/super-admin/notifications/route.ts',
  'app/api/super-admin/onboarding/route.ts',
  'app/api/super-admin/operations/route.ts',
  'app/api/super-admin/platform/route.ts',
  'app/api/super-admin/settings/route.ts',
  'app/api/super-admin/stats/route.ts',
  'app/api/super-admin/support/route.ts',
  'app/api/super-admin/users/route.ts',
  'app/api/super-admin/xdrive-logistics/enquiries/[id]/route.ts',
  'app/api/super-admin/xdrive-logistics/enquiries/route.ts',
  'app/api/super-admin/xdrive-logistics/jobs/route.ts',
  'app/api/super-admin/xdrive-logistics/marketplace/route.ts',
  'app/super-admin/_components/SuperAdminLiveTablePage.tsx',
  'app/super-admin/_components/SuperAdminNavbar.tsx',
  'app/super-admin/_components/SuperAdminOperationalMap.tsx',
  'app/super-admin/_components/SuperAdminUserListPage.tsx',
  'app/super-admin/_components/SuperAdminWorkspaceShell.tsx',
  'app/super-admin/_lib/getAuthHeader.ts',
  'app/super-admin/analytics/page.tsx',
  'app/super-admin/companies/active/page.tsx',
  'app/super-admin/companies/brokers/page.tsx',
  'app/super-admin/companies/memberships/page.tsx',
  'app/super-admin/companies/page.tsx',
  'app/super-admin/compliance/insurance/page.tsx',
  'app/super-admin/compliance/operator-licences/page.tsx',
  'app/super-admin/directory/page.tsx',
  'app/super-admin/finance/fees/page.tsx',
  'app/super-admin/finance/invoices/page.tsx',
  'app/super-admin/finance/page.tsx',
  'app/super-admin/finance/payments/page.tsx',
  'app/super-admin/finance/revenue/page.tsx',
  'app/super-admin/finance/stripe-webhooks/page.tsx',
  'app/super-admin/finance/subscriptions/page.tsx',
  'app/super-admin/fleet/return-journeys/page.tsx',
  'app/super-admin/fleet/vehicles/page.tsx',
  'app/super-admin/health/page.tsx',
  'app/super-admin/layout.tsx',
  'app/super-admin/marketplace/page.tsx',
  'app/super-admin/operations/control-centre/page.tsx',
  'app/super-admin/operations/driver-availability/page.tsx',
  'app/super-admin/platform/page.tsx',
  'app/super-admin/settings/global/page.tsx',
  'app/super-admin/settings/legal-agreements/page.tsx',
  'app/super-admin/settings/roles-permissions/page.tsx',
  'app/super-admin/support/tickets/page.tsx',
  'app/super-admin/users/platform-admins/page.tsx',
  'lib/invoiceStatus.ts',
];

const superAdminControlPlaneUnitTests = [
  '__tests__/superAdminControlPlaneCompleteness.test.ts',
  '__tests__/superAdminNavbarContract.test.ts',
  '__tests__/superAdminPlatformHealth.test.ts',
  '__tests__/superAdminVisualContract.test.ts',
  '__tests__/invoiceStatusCanonical.test.ts',
  '__tests__/superAdminStatsContract.test.ts',
  '__tests__/commandCentreMetrics.test.ts',
];

console.log('NETLIFY_RELEASE_GATE=START');
run(process.execPath, ['.github/scripts/validate-supabase-migration-files.mjs']);

if (isLegalGatePreview) {
  console.log('NETLIFY_RELEASE_GATE=PR499_LEGAL_LINT');
  run(npmCommand, ['exec', '--', 'eslint', ...legalLintTargets]);
  console.log('NETLIFY_RELEASE_GATE=PR499_LEGAL_TESTS');
  run(npmCommand, ['run', 'test:unit', '--', ...legalUnitTests]);
}

if (isGoLiveHardeningPreview) {
  console.log('NETLIFY_RELEASE_GATE=PR500_501_GO_LIVE_HARDENING_LINT');
  run(npmCommand, ['exec', '--', 'eslint', ...goLiveHardeningLintTargets]);
  console.log('NETLIFY_RELEASE_GATE=PR500_501_GO_LIVE_HARDENING_TESTS');
  run(npmCommand, ['run', 'test:unit', '--', ...goLiveHardeningUnitTests]);
}

if (isSuperAdminHomePreview) {
  console.log('NETLIFY_RELEASE_GATE=PR504_SUPER_ADMIN_HOME_LINT');
  run(npmCommand, ['exec', '--', 'eslint', ...superAdminHomeLintTargets]);
  console.log('NETLIFY_RELEASE_GATE=PR504_SUPER_ADMIN_HOME_TESTS');
  run(npmCommand, ['run', 'test:unit', '--', ...superAdminHomeUnitTests]);
}

if (isSuperAdminControlPlanePreview) {
  console.log('NETLIFY_RELEASE_GATE=PR505_506_SUPER_ADMIN_CONTROL_PLANE_LINT');
  run(npmCommand, ['exec', '--', 'eslint', ...superAdminControlPlaneLintTargets]);
  console.log('NETLIFY_RELEASE_GATE=PR505_506_SUPER_ADMIN_CONTROL_PLANE_TESTS');
  run(npmCommand, ['run', 'test:unit', '--', ...superAdminControlPlaneUnitTests]);
}

run(npmCommand, ['run', 'typecheck']);
run(npmCommand, ['run', 'build']);
console.log('NETLIFY_RELEASE_GATE=PASS');
