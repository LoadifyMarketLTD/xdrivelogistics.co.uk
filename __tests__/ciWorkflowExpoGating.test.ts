import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

const extractJob = (workflow: string, jobName: string, nextJobName: string) => {
  const start = workflow.indexOf(`  ${jobName}:`);
  const end = workflow.indexOf(`\n  ${nextJobName}:`, start);

  if (start === -1 || end === -1) return '';
  return workflow.slice(start, end);
};

describe('CI workflow Expo gating', () => {
  it('runs Expo validation on main or explicitly mobile and cross-scope pull requests', () => {
    const workflow = readRepoFile('.github/workflows/ci.yml');
    const expoJob = extractJob(workflow, 'expo-driver-typecheck', 'codeql-web');

    expect(expoJob).toContain("needs.detect-expo-driver-changes.outputs.driver_changed == 'true'");
    expect(expoJob).toContain('scope:expo');
    expect(expoJob).toContain('scope:android');
    expect(expoJob).toContain('scope:cross');
    expect(expoJob).not.toContain('scope:web');
    expect(expoJob).not.toContain('scope:supabase');
  });

  it('detects native Android changes for Kotlin CodeQL without duplicating the native build workflow', () => {
    const workflow = readRepoFile('.github/workflows/ci.yml');
    const detectorJob = extractJob(workflow, 'detect-expo-driver-changes', 'expo-driver-typecheck');
    const nativeWorkflow = readRepoFile('.github/workflows/android-native-ci.yml');

    expect(detectorJob).toContain('android_native_changed');
    expect(detectorJob).toContain("grep -Eq '^android-native/'");
    expect(workflow).toContain("needs.detect-expo-driver-changes.outputs.android_native_changed == 'true'");
    expect(workflow).toContain('name: CodeQL Security Scan (java-kotlin)');
    expect(workflow).not.toContain('name: Native Android Validation');
    expect(nativeWorkflow).toContain('- "android-native/**"');
    expect(nativeWorkflow).toContain('./gradlew --no-daemon clean testDebugUnitTest lintDebug assembleDebug');
  });
});
