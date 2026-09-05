import { spawnSync } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, CI: process.env.CI ?? 'true', ...extraEnv },
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
const isExpoDriverHardeningPreview =
  process.env.CONTEXT === 'deploy-preview' && process.env.REVIEW_ID === '503';

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

const expoDriverUnitTests = [
  '__tests__/expoDriverE2EContract.test.ts',
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

if (isExpoDriverHardeningPreview) {
  console.log('NETLIFY_RELEASE_GATE=PR503_EXPO_DRIVER_SOURCE_CONTRACT');
  run(npmCommand, ['run', 'test:unit', '--', ...expoDriverUnitTests]);

  // Reconcile the mobile lock deterministically in the networked Preview build.
  // This is temporary until the generated lock is committed to PR #503.
  console.log('NETLIFY_RELEASE_GATE=PR503_EXPO_DRIVER_LOCK_RECONCILE');
  run(npmCommand, [
    '--prefix', 'apps/driver-mobile',
    'install',
    '--package-lock-only',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
  ]);

  console.log('NETLIFY_RELEASE_GATE=PR503_EXPO_DRIVER_CI_INSTALL');
  run(npmCommand, [
    '--prefix', 'apps/driver-mobile',
    'ci',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
  ]);

  console.log('NETLIFY_RELEASE_GATE=PR503_EXPO_DRIVER_TYPECHECK');
  run(npmCommand, ['--prefix', 'apps/driver-mobile', 'run', 'typecheck']);
  console.log('NETLIFY_RELEASE_GATE=PR503_EXPO_DRIVER_TESTS');
  run(npmCommand, ['--prefix', 'apps/driver-mobile', 'run', 'test']);
  console.log('NETLIFY_RELEASE_GATE=PR503_EXPO_DRIVER_ANDROID_BUNDLE');
  run(
    npmCommand,
    ['--prefix', 'apps/driver-mobile', 'run', 'bundle:android'],
    { EXPO_NO_DOCTOR: '1' },
  );
  console.log('NETLIFY_RELEASE_GATE=PR503_EXPO_DRIVER_NATIVE_BINARY_GATE=EXTERNAL_REQUIRED');
}

run(npmCommand, ['run', 'typecheck']);
run(npmCommand, ['run', 'build']);
console.log('NETLIFY_RELEASE_GATE=PASS');
