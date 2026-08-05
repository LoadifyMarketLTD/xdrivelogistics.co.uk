import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

describe('platform notifications route canonical column contract', () => {
  const ROUTE = 'app/api/super-admin/platform/route.ts';

  it('does not hard-require last_error — falls back if column is absent', () => {
    const route = readRepoFile(ROUTE);
    // The route must have a fallback query without the durability columns
    expect(route).toContain('WITHOUT_DURABILITY');
    expect(route).toContain('durabilityUnavailable');
  });

  it('does not fail the whole response when durability columns are missing', () => {
    const route = readRepoFile(ROUTE);
    // Must surface diagnosticNote rather than an error response
    expect(route).toContain('diagnosticNote');
    expect(route).toContain('error detail unavailable');
  });

  it('the fallback select does not include last_error or attempt_count', () => {
    const route = readRepoFile(ROUTE);
    const withoutMatch = route.match(/WITHOUT_DURABILITY\s*=\s*'([^']+)'/);
    expect(withoutMatch).not.toBeNull();
    const cols = withoutMatch![1];
    expect(cols).not.toContain('last_error');
    expect(cols).not.toContain('attempt_count');
    expect(cols).not.toContain('next_attempt_at');
    // Must still include core columns
    expect(cols).toContain('id');
    expect(cols).toContain('status');
    expect(cols).toContain('created_at');
  });

  it('PATCH retry gracefully handles missing last_error column', () => {
    const route = readRepoFile(ROUTE);
    // Must have a fallback update path without last_error
    expect(route).toContain('fallbackError');
    expect(route).toContain("status: 'pending', processed_at: null }");
  });
});

describe('command centre company pending approval severity', () => {
  const ROUTE = 'app/api/super-admin/command-centre/route.ts';

  it('company_pending_approval severity is always P1, never escalated to P0 by age', () => {
    const route = readRepoFile(ROUTE);
    // Must not escalate by age
    expect(route).not.toMatch(/company_pending_approval[\s\S]{0,200}age.*P0/);
    expect(route).not.toMatch(/age.*24.*60.*P0[\s\S]{0,100}company_pending_approval/);
  });

  it('p0p1Incidents label does not claim to represent incident records', () => {
    const route = readRepoFile(ROUTE);
    // Label must not say "Incidents P0/P1" — must say "actions" or similar
    expect(route).not.toContain("label: 'Incidents P0/P1'");
    expect(route).toContain('p0p1Incidents');
  });
});
