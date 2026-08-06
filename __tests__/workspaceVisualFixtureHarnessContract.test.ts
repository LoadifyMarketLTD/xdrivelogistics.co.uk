import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const fixtureRoute = readFileSync(
  resolve(process.cwd(), 'app/visual-fixture/workspace/[role]/page.tsx'),
  'utf8',
);

const fixtureComponent = readFileSync(
  resolve(process.cwd(), 'app/components/workspace/WorkspaceVisualFixture.tsx'),
  'utf8',
);

const shell = readFileSync(
  resolve(process.cwd(), 'app/components/workspace/WorkspaceShell.tsx'),
  'utf8',
);

const visualWorkflow = readFileSync(
  resolve(process.cwd(), '.github/workflows/visual-fixture-gate.yml'),
  'utf8',
);

const fixtureEnabled = (nodeEnv: string | undefined, fixtureFlag: string | undefined) =>
  nodeEnv !== 'production' && fixtureFlag === 'true';

const allowedRolesFromRoute = (() => {
  const match = fixtureRoute.match(/new Set\(\[(.*?)\] as const\)/s);
  if (!match) return [];
  return [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
})();

describe('workspace visual fixture harness contract', () => {
  it('is fail-closed behind explicit non-production guard', () => {
    expect(fixtureRoute).toContain("process.env.NODE_ENV !== 'production'");
    expect(fixtureRoute).toContain("process.env.E2E_VISUAL_FIXTURE === 'true'");
    expect(fixtureRoute).toContain('notFound()');
    expect(fixtureEnabled('production', 'true')).toBe(false);
    expect(fixtureEnabled('development', undefined)).toBe(false);
    expect(fixtureEnabled('development', 'true')).toBe(true);
  });

  it('allowlists only the required deterministic role fixtures', () => {
    const expectedRoles = ['carrier', 'broker', 'customer', 'driver', 'fleet', 'operations', 'super-admin'];
    expect(allowedRolesFromRoute).toEqual(expectedRoles);
    for (const role of expectedRoles) {
      expect(fixtureRoute).toContain(`'${role}'`);
      expect(fixtureComponent).toContain(role.includes('-') ? `'${role}':` : `${role}:`);
    }
    expect(fixtureComponent).not.toContain('finance:');
    expect(fixtureComponent).not.toContain('compliance:');
  });

  it('keeps action centre and notifications distinct in shell controls', () => {
    expect(shell).toContain('data-route={actionCentreHref}');
    expect(shell).toContain('data-route={notificationsHref}');
  });

  it('uses fixture overrides only as explicit opt-in inputs', () => {
    expect(shell).toContain('fixtureOverrides?: WorkspaceShellFixtureOverrides');
    expect(shell).toContain('fixtureOverrides?.tickerItems');
    expect(shell).toContain('fixtureOverrides?.unreadCount');
  });

  it('wires a dedicated CI visual gate workflow with artifacts', () => {
    expect(visualWorkflow).toContain('name: Visual Fixture Gate');
    expect(visualWorkflow).toContain('workspace-visual-fixture-gate');
    expect(visualWorkflow).toContain('E2E_VISUAL_FIXTURE: "true"');
    expect(visualWorkflow).toContain('NODE_ENV: development');
    expect(visualWorkflow).toContain('workspace-visual-auth-gate.spec.ts');
    expect(visualWorkflow).toContain('--project=chromium');
    expect(visualWorkflow).toContain('if: always()');
    expect(visualWorkflow).toContain('actions/upload-artifact@v4');
    expect(visualWorkflow).toContain('playwright-report/**');
    expect(visualWorkflow).toContain('test-results/**');
  });
});
