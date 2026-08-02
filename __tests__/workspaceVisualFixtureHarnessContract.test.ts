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

describe('workspace visual fixture harness contract', () => {
  it('is fail-closed behind explicit non-production guard', () => {
    expect(fixtureRoute).toContain("process.env.NODE_ENV !== 'production'");
    expect(fixtureRoute).toContain("process.env.E2E_VISUAL_FIXTURE === 'true'");
    expect(fixtureRoute).toContain('notFound()');
  });

  it('supports deterministic role fixtures for all required workspaces', () => {
    for (const role of ['admin', 'broker', 'customer', 'driver', 'operations']) {
      expect(fixtureRoute).toContain(`'${role}'`);
      expect(fixtureComponent).toContain(`${role}:`);
    }
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
});
