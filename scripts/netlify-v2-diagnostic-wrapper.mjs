import { spawnSync } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function runStage(label, command, args, failureCode) {
  console.log(`NETLIFY_V2_DIAGNOSTIC=${label}_START`);
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, CI: process.env.CI ?? 'true' },
    stdio: 'inherit',
    shell: false,
  });
  if (result.error || result.status !== 0) process.exit(failureCode);
  console.log(`NETLIFY_V2_DIAGNOSTIC=${label}_PASS`);
}

const lintTargets = [
  '__tests__/invoiceStatusCanonical.test.ts',
  '__tests__/superAdminControlPlaneCompleteness.test.ts',
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

const unitTests = [
  '__tests__/superAdminControlPlaneCompleteness.test.ts',
  '__tests__/superAdminMasterV2Contract.test.ts',
  '__tests__/superAdminNavbarContract.test.ts',
  '__tests__/superAdminPlatformHealth.test.ts',
  '__tests__/superAdminVisualContract.test.ts',
  '__tests__/invoiceStatusCanonical.test.ts',
  '__tests__/superAdminStatsContract.test.ts',
  '__tests__/commandCentreMetrics.test.ts',
];

runStage('MIGRATION', process.execPath, ['.github/scripts/validate-supabase-migration-files.mjs'], 41);
runStage('LINT', npmCommand, ['exec', '--', 'eslint', ...lintTargets], 42);
runStage('TESTS', npmCommand, ['run', 'test:unit', '--', ...unitTests], 44);
runStage('TYPECHECK', npmCommand, ['run', 'typecheck'], 43);
runStage('BUILD', npmCommand, ['run', 'build'], 45);
console.log('NETLIFY_V2_DIAGNOSTIC=ALL_PASS');
