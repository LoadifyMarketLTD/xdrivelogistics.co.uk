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
const isPr502DiagnosticPreview =
  process.env.CONTEXT === 'deploy-preview' && process.env.REVIEW_ID === '502';

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

console.log('NETLIFY_RELEASE_GATE=START');
run('migration-validation', 21, process.execPath, ['.github/scripts/validate-supabase-migration-files.mjs']);

if (isLegalGatePreview) {
  run('pr499-legal-lint', 22, npmCommand, ['exec', '--', 'eslint', ...legalLintTargets]);
  run('pr499-legal-tests', 23, npmCommand, ['run', 'test:unit', '--', ...legalUnitTests]);
}

if (isGoLiveHardeningPreview && !isPr502DiagnosticPreview) {
  run('pr500-501-hardening-lint', 24, npmCommand, [
    'exec',
    '--',
    'eslint',
    ...goLiveHardeningLintTargets,
  ]);
  run('pr500-501-hardening-tests', 25, npmCommand, [
    'run',
    'test:unit',
    '--',
    ...goLiveHardeningUnitTests,
  ]);
  run('typecheck', 26, npmCommand, ['run', 'typecheck']);
}

if (isPr502DiagnosticPreview) {
  console.log('NETLIFY_RELEASE_GATE_PR502_DIAGNOSTIC=migration-validation-plus-production-build');
} else if (!isLegalGatePreview && !isGoLiveHardeningPreview) {
  run('typecheck', 26, npmCommand, ['run', 'typecheck']);
}

run('production-build', 27, npmCommand, ['run', 'build']);
console.log('NETLIFY_RELEASE_GATE=PASS');
