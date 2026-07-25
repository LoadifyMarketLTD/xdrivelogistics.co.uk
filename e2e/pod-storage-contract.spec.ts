import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildCanonicalPodPath,
  isCanonicalPodPath,
  POD_BUCKET,
} from '../lib/podStorage';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test.describe('pod storage contract', () => {
  test('builds and validates canonical POD paths', () => {
    const podPath = buildCanonicalPodPath({
      companyId: '5587a84f-de1f-4e35-9991-3a6857de477d',
      jobId: '11111111-2222-4333-8444-555555555555',
      uploaderUserId: '608f4f95-0121-40bd-8bab-43022c16a567',
      filename: 'delivery proof.jpg',
    });

    expect(podPath).toBe(
      '5587a84f-de1f-4e35-9991-3a6857de477d/11111111-2222-4333-8444-555555555555/608f4f95-0121-40bd-8bab-43022c16a567/delivery_proof.jpg'
    );
    expect(isCanonicalPodPath(podPath, {
      companyId: '5587a84f-de1f-4e35-9991-3a6857de477d',
      jobId: '11111111-2222-4333-8444-555555555555',
      uploaderUserId: '608f4f95-0121-40bd-8bab-43022c16a567',
    })).toBe(true);
    expect(isCanonicalPodPath('11111111-2222-4333-8444-555555555555/photos/file.jpg')).toBe(false);
  });

  test('runtime POD uploads use the canonical bucket and do not reference pod-docs', () => {
    const runtimeFiles = [
      'app/components/workspace/DriverJobExecutionPage.tsx',
      'app/m/_components/DriverMobileApp.tsx',
      'app/m/_components/DriverMobileAppVariant.tsx',
      'app/api/pod/signed-url/route.ts',
      'app/api/driver/mobile/jobs/[id]/[action]/route.ts',
      'apps/driver-mobile/src/api.ts',
      'apps/driver-mobile/src/api/jobs.ts',
      'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/data/ApiClient.kt',
    ];

    for (const relativePath of runtimeFiles) {
      const content = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
      expect(content.includes(POD_BUCKET) || content.includes('POD_BUCKET'), relativePath).toBe(true);
      expect(content.includes('pod-docs'), relativePath).toBe(false);
    }
  });
});
