import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

describe('Super Admin Command Centre convergence', () => {
  it('uses live Health summary instead of a hard-coded degraded-services zero', () => {
    const page = readRepoFile('app/super-admin/page.tsx');
    const health = readRepoFile('app/api/super-admin/health/route.ts');

    expect(page).toContain("fetch('/api/super-admin/health'");
    expect(page).toContain('health?.summary?.degradedServices');
    expect(page).toContain("count: null, label: 'Degraded core services'");
    expect(health).toContain('degradedServices: degradedChecks + failedChecks');
    expect(health).toContain('verifyPlatformOwner(request)');
  });

  it('routes derived queue detections into canonical Platform Entity Inspectors', () => {
    const page = readRepoFile('app/super-admin/page.tsx');

    expect(page).toContain('PlatformEntityLink');
    expect(page).toContain('inspectableType(item.entityType)');
    expect(page).toContain('entityId={item.entityId}');
    expect(page).not.toContain('href={item.href}');
  });

  it('keeps derived detections separate from persistent Platform Cases', () => {
    const page = readRepoFile('app/super-admin/page.tsx');

    expect(page).toContain('Derived detection queue');
    expect(page).toContain('Persistent Platform Cases');
    expect(page).toContain("fetch('/api/super-admin/cases?status=active&limit=8'");
    expect(page).toContain('Durable investigations are separate from the re-derived detection queue.');
  });

  it('does not fabricate persistent case counts when SA-02 schema is unavailable', () => {
    const page = readRepoFile('app/super-admin/page.tsx');
    const actionCentre = readRepoFile('app/super-admin/action-centre/page.tsx');

    expect(page).toContain('No case count is inferred.');
    expect(page).toContain('Platform Case Centre schema is not applied in this environment.');
    expect(actionCentre).toContain('No P0/P1/unassigned/investigating zeroes are inferred.');
    expect(actionCentre).toContain('No empty registry is fabricated.');
    expect(actionCentre).toContain('disabled={available === false}');
  });

  it('keeps /super-admin/cases as a compatibility alias to the canonical Action Centre', () => {
    const alias = readRepoFile('app/super-admin/cases/page.tsx');
    expect(alias).toContain("redirect('/super-admin/action-centre')");
  });
});
