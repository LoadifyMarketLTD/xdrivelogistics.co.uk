import { spawnSync } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(label, failureCode, command, args) {
  console.log(`NETLIFY_RELEASE_GATE_STAGE=${label}`);
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, CI: process.env.CI ?? 'true' },
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    console.error(`NETLIFY_RELEASE_GATE_FAILED=${label}:spawn_error=${result.error.message}`);
    process.exit(failureCode);
  }

  if (result.status !== 0) {
    console.error(`NETLIFY_RELEASE_GATE_FAILED=${label}:child_status=${result.status ?? 'unknown'}`);
    process.exit(failureCode);
  }

  console.log(`NETLIFY_RELEASE_GATE_STAGE_PASS=${label}`);
}

const isLegalGatePreview =
  process.env.CONTEXT === 'deploy-preview' && process.env.REVIEW_ID === '499';
const isGoLiveHardeningPreview =
  process.env.CONTEXT === 'deploy-preview' &&
  ['500', '501', '502'].includes(process.env.REVIEW_ID ?? '');
const isSuperAdminHomePreview =
  process.env.CONTEXT === 'deploy-preview' && process.env.REVIEW_ID === '504';
const isSuperAdminControlPlanePreview =
  process.env.CONTEXT === 'deploy-preview' &&
  ['505', '506', '509'].includes(process.env.REVIEW_ID ?? '');

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
  '__tests__/postgisRelocationBridge.test.ts',
  'app/api/super-admin/command-centre/route.ts',
];

const goLiveHardeningUnitTests = [
  '__tests__/commandCentreMetrics.test.ts',
  '__tests__/goLiveHardeningMigrationContract.test.ts',
  '__tests__/goLiveTenantReviewerHardening.test.ts',
  '__tests__/postgisRelocationBridge.test.ts',
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
  '__tests__/superAdminFinalV2ResidualContract.test.ts',
  '__tests__/superAdminMasterV2Contract.test.ts',
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
  'app/auth/sign-out/page.tsx',
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
  '__tests__/superAdminFinalV2ResidualContract.test.ts',
  '__tests__/superAdminMasterV2Contract.test.ts',
  '__tests__/superAdminNavbarContract.test.ts',
  '__tests__/superAdminPlatformHealth.test.ts',
  '__tests__/superAdminVisualContract.test.ts',
  '__tests__/invoiceStatusCanonical.test.ts',
  '__tests__/superAdminStatsContract.test.ts',
  '__tests__/commandCentreMetrics.test.ts',
];

console.log('NETLIFY_RELEASE_GATE=START');
run('migration-validation', 21, process.execPath, ['.github/scripts/validate-supabase-migration-files.mjs']);

if (isLegalGatePreview) {
  run('pr499-legal-lint', 22, npmCommand, ['exec', '--', 'eslint', ...legalLintTargets]);
  run('pr499-legal-tests', 23, npmCommand, ['run', 'test:unit', '--', ...legalUnitTests]);
}

if (isGoLiveHardeningPreview) {
  run('pr500-501-502-hardening-lint', 24, npmCommand, [
    'exec',
    '--',
    'eslint',
    ...goLiveHardeningLintTargets,
  ]);
  run('pr500-501-502-hardening-tests', 25, npmCommand, [
    'run',
    'test:unit',
    '--',
    ...goLiveHardeningUnitTests,
  ]);
}

if (isSuperAdminHomePreview) {
  run('pr504-super-admin-home-lint', 28, npmCommand, ['exec', '--', 'eslint', ...superAdminHomeLintTargets]);
  run('pr504-super-admin-home-tests', 29, npmCommand, ['run', 'test:unit', '--', ...superAdminHomeUnitTests]);
}

if (isSuperAdminControlPlanePreview) {
  run('pr505-506-509-super-admin-control-plane-lint', 30, npmCommand, ['exec', '--', 'eslint', ...superAdminControlPlaneLintTargets]);
  run('pr505-506-509-super-admin-control-plane-tests', 31, npmCommand, ['run', 'test:unit', '--', ...superAdminControlPlaneUnitTests]);
}

run('typecheck', 26, npmCommand, ['run', 'typecheck']);
run('production-build', 27, npmCommand, ['run', 'build']);
console.log('NETLIFY_RELEASE_GATE=PASS');
