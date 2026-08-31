import fs from 'node:fs';
import path from 'node:path';

const collectRouteFiles = (directory: string): string[] => {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectRouteFiles(absolute));
      continue;
    }
    if (entry.isFile() && entry.name === 'route.ts') files.push(absolute);
  }

  return files;
};

describe('Super Admin Platform Owner authority convergence', () => {
  const root = process.cwd();
  const apiRoot = path.join(root, 'app/api/super-admin');
  const helperPath = path.join(apiRoot, '_lib/verifyPlatformOwner.ts');
  const helper = fs.readFileSync(helperPath, 'utf8');
  const routeFiles = collectRouteFiles(apiRoot);

  it('keeps active Platform Owner verification canonical in the shared helper', () => {
    expect(helper).toContain(".select('role, status')");
    expect(helper).toContain("role !== 'owner'");
    expect(helper).toContain("status !== 'active'");
    expect(helper).toContain('getBearerToken(request)');
  });

  it('does not allow route-local owner authentication implementations', () => {
    const violations: string[] = [];

    for (const absolute of routeFiles) {
      const source = fs.readFileSync(absolute, 'utf8');
      const relative = path.relative(root, absolute).replace(/\\/g, '/');

      const hasLocalOwnerVerifier =
        /\b(?:const|let|var)\s+verifyOwner\s*=/.test(source)
        || /\bfunction\s+verifyOwner\s*\(/.test(source)
        || /\b(?:const|let|var)\s+verifyPlatformOwner\s*=\s*async\b/.test(source)
        || /\basync\s+function\s+verifyPlatformOwner\s*\(/.test(source);
      const validatesBearerDirectly = /\bgetBearerToken\s*\(\s*request\s*\)/.test(source);

      if (hasLocalOwnerVerifier || validatesBearerDirectly) violations.push(relative);
    }

    expect(violations).toEqual([]);
  });

  it('routes privileged control-plane surfaces through the shared verifier', () => {
    const requiredRoutes = [
      'app/api/super-admin/audit/route.ts',
      'app/api/super-admin/cases/route.ts',
      'app/api/super-admin/companies/route.ts',
      'app/api/super-admin/compliance/route.ts',
      'app/api/super-admin/compliance/documents/route.ts',
      'app/api/super-admin/compliance/fraud-cases/route.ts',
      'app/api/super-admin/email-readiness/route.ts',
      'app/api/super-admin/finance/route.ts',
      'app/api/super-admin/health/route.ts',
      'app/api/super-admin/marketplace/route.ts',
      'app/api/super-admin/notifications/route.ts',
      'app/api/super-admin/onboarding/[id]/route.ts',
      'app/api/super-admin/operations/route.ts',
      'app/api/super-admin/platform/route.ts',
      'app/api/super-admin/settings/route.ts',
      'app/api/super-admin/stats/route.ts',
      'app/api/super-admin/support/route.ts',
      'app/api/super-admin/users/route.ts',
      'app/api/super-admin/xdrive-logistics/enquiries/route.ts',
      'app/api/super-admin/xdrive-logistics/enquiries/[id]/route.ts',
      'app/api/super-admin/xdrive-logistics/jobs/route.ts',
      'app/api/super-admin/xdrive-logistics/marketplace/route.ts',
    ];

    for (const relative of requiredRoutes) {
      const source = fs.readFileSync(path.join(root, relative), 'utf8');
      expect(source).toContain('verifyPlatformOwner');
    }
  });
});
