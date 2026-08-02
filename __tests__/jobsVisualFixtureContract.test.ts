/**
 * Jobs visual fixture harness contract tests.
 *
 * Validates source-level guarantees of the Jobs visual fixture:
 *   - The fixture route is fail-closed behind the E2E guard.
 *   - The fixture component contains deterministic data covering every
 *     required scenario: draft/posted/allocated/terminal statuses,
 *     private/public visibility, assigned/unassigned drivers, and
 *     enough records to exercise pagination.
 *   - The CI workflow runs the Jobs visual gate spec.
 *   - The E2E spec guards itself with the fixture flag.
 *
 * These are source-contract tests (file-read assertions), not rendering tests.
 * Rendering is validated by e2e/jobs-visual-gate.spec.ts.
 *
 * Reference: docs/ui/cx/jobs.md, PR #338 directive §§1–5
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const CWD = process.cwd();

const fixturePage = readFileSync(
  resolve(CWD, 'app/visual-fixture/jobs/page.tsx'),
  'utf8',
);

const fixtureComponent = readFileSync(
  resolve(CWD, 'app/components/workspace/JobsVisualFixture.tsx'),
  'utf8',
);

const e2eSpec = readFileSync(
  resolve(CWD, 'e2e/jobs-visual-gate.spec.ts'),
  'utf8',
);

const workflow = readFileSync(
  resolve(CWD, '.github/workflows/visual-fixture-gate.yml'),
  'utf8',
);

// ── Route page ───────────────────────────────────────────────────────────────

describe('Jobs visual fixture route page', () => {
  it('is fail-closed behind non-production + fixture-flag guard', () => {
    expect(fixturePage).toContain("process.env.NODE_ENV !== 'production'");
    expect(fixturePage).toContain("process.env.E2E_VISUAL_FIXTURE === 'true'");
    expect(fixturePage).toContain('notFound()');
  });

  it('imports and renders JobsVisualFixture', () => {
    expect(fixturePage).toContain('JobsVisualFixture');
    expect(fixturePage).toContain('<JobsVisualFixture />');
  });
});

// ── Fixture component — deterministic data coverage ───────────────────────

describe('JobsVisualFixture deterministic data coverage', () => {
  it('exports FIXTURE_JOBS constant', () => {
    expect(fixtureComponent).toContain('FIXTURE_JOBS');
  });

  it('exports FIXTURE_DRIVERS constant', () => {
    expect(fixtureComponent).toContain('FIXTURE_DRIVERS');
  });

  it('exports FIXTURE_PER_PAGE constant', () => {
    expect(fixtureComponent).toContain('FIXTURE_PER_PAGE');
  });

  it('defines a draft job eligible for Post', () => {
    expect(fixtureComponent).toContain("status: 'draft'");
  });

  it('defines a posted job', () => {
    expect(fixtureComponent).toContain("status: 'posted'");
  });

  it('defines an allocated job', () => {
    expect(fixtureComponent).toContain("status: 'allocated'");
  });

  it('defines a terminal delivered job', () => {
    expect(fixtureComponent).toContain("status: 'delivered'");
  });

  it('defines a cancelled job', () => {
    expect(fixtureComponent).toContain("status: 'cancelled'");
  });

  it('defines an in_transit job', () => {
    expect(fixtureComponent).toContain("status: 'in_transit'");
  });

  it('defines a private-visibility job eligible for Direct Invite', () => {
    expect(fixtureComponent).toContain("exchange_visibility: 'private'");
    expect(fixtureComponent).toContain("awarded_carrier_company_id: null");
  });

  it('defines a public-visibility job (blocks Direct Invite)', () => {
    expect(fixtureComponent).toContain("exchange_visibility: 'public'");
  });

  it('defines a job with an awarded carrier (blocks Direct Invite)', () => {
    expect(fixtureComponent).toContain("awarded_carrier_company_id: 'fx-carrier");
  });

  it('assigns driver A to at least one job', () => {
    expect(fixtureComponent).toContain("assignedDriverId: 'fixture-driver-aaa-111'");
  });

  it('assigns driver B to at least one job', () => {
    expect(fixtureComponent).toContain("assignedDriverId: 'fixture-driver-bbb-222'");
  });

  it('includes jobs with full detail fields (email, phone, terms, cargo, loadDetail)', () => {
    expect(fixtureComponent).toContain('clientEmail:');
    expect(fixtureComponent).toContain('clientPhone:');
    expect(fixtureComponent).toContain('paymentTerms:');
    expect(fixtureComponent).toContain('cargo:');
    expect(fixtureComponent).toContain('loadDetailSummary:');
  });

  it('has at least 12 job records to exercise pagination beyond perPage=10', () => {
    // Count 'fx-job-' id occurrences as a proxy for job count
    const matches = fixtureComponent.match(/id: 'fx-job-\d+'/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(12);
  });

  it('uses FIXTURE_PER_PAGE <= 10 so pagination is always exercised', () => {
    const match = fixtureComponent.match(/FIXTURE_PER_PAGE\s*=\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeLessThanOrEqual(10);
    expect(Number(match![1])).toBeGreaterThan(0);
  });

  it('renders JobsOperationalTable', () => {
    expect(fixtureComponent).toContain('JobsOperationalTable');
  });

  it('wraps content in WorkspaceShell with fixtureOverrides', () => {
    expect(fixtureComponent).toContain('WorkspaceShell');
    expect(fixtureComponent).toContain('fixtureOverrides');
  });

  it('provides fixture overrides for companyName, unreadCount and tickerItems', () => {
    expect(fixtureComponent).toContain('companyName:');
    expect(fixtureComponent).toContain('unreadCount:');
    expect(fixtureComponent).toContain('tickerItems:');
  });

  it('applies filterJobsByDriver in the filtered derivation', () => {
    expect(fixtureComponent).toContain('filterJobsByDriver');
  });

  it('resets page to 0 on any filter change', () => {
    expect(fixtureComponent).toContain('setPage(0)');
  });
});

// ── E2E spec — structural requirements ───────────────────────────────────────

describe('Jobs visual gate E2E spec', () => {
  it('guards itself behind E2E_VISUAL_FIXTURE flag', () => {
    expect(e2eSpec).toContain("process.env.E2E_VISUAL_FIXTURE !== 'true'");
    expect(e2eSpec).toContain('test.skip(');
  });

  it('targets the /visual-fixture/jobs URL', () => {
    expect(e2eSpec).toContain('/visual-fixture/jobs');
  });

  it('covers all three required viewports', () => {
    expect(e2eSpec).toContain('1440');
    expect(e2eSpec).toContain('900');
    expect(e2eSpec).toContain('768');
    expect(e2eSpec).toContain('1024');
    expect(e2eSpec).toContain('390');
    expect(e2eSpec).toContain('844');
  });

  it('asserts desktop table visible and mobile cards hidden on desktop', () => {
    expect(e2eSpec).toContain('jobs-desktop-table');
    expect(e2eSpec).toContain('jobs-mobile-cards');
  });

  it('asserts no body horizontal overflow', () => {
    expect(e2eSpec).toContain('scrollWidth > document.documentElement.clientWidth');
  });

  it('asserts sticky header on desktop and tablet', () => {
    // Spec evaluates computedStyle.position and expects it to be 'sticky'
    expect(e2eSpec).toContain("getComputedStyle(el).position");
    expect(e2eSpec).toContain(".toBe('sticky')");
  });

  it('asserts at least 10 rows on desktop', () => {
    expect(e2eSpec).toContain('toBeGreaterThanOrEqual(10)');
  });

  it('asserts driver filter interaction on desktop', () => {
    expect(e2eSpec).toContain('fixture-driver-aaa-111');
    expect(e2eSpec).toContain('selectOption(DRIVER_A_ID)');
    expect(e2eSpec).toContain('fixture-driver-bbb-222');
    expect(e2eSpec).toContain('selectOption(DRIVER_B_ID)');
  });

  it('asserts expand row reveals operational detail', () => {
    expect(e2eSpec).toContain('ops@acmefreight.co.uk');
  });

  it('asserts Post action only for draft jobs', () => {
    expect(e2eSpec).toContain('Post job JOB-F001 to marketplace');
    expect(e2eSpec).toContain('Post job JOB-F004 to marketplace');
    expect(e2eSpec).toContain('toHaveCount(0)');
  });

  it('asserts Invite action eligibility rules', () => {
    expect(e2eSpec).toContain('Invite carrier for job JOB-F001');
    expect(e2eSpec).toContain('Invite carrier for job JOB-F005');
  });

  it('asserts Customer and Distance columns hidden on tablet', () => {
    expect(e2eSpec).toContain("'Customer'");
    expect(e2eSpec).toContain("'Dist.'");
    expect(e2eSpec).toContain("toBe('none')");
  });

  it('asserts required columns remain visible on tablet', () => {
    expect(e2eSpec).toContain("'Status'");
    expect(e2eSpec).toContain("'Route'");
    expect(e2eSpec).toContain("'Pickup'");
    expect(e2eSpec).toContain("'Delivery'");
    expect(e2eSpec).toContain("'Vehicle'");
  });

  it('asserts table hidden and mobile cards shown on mobile', () => {
    expect(e2eSpec).toContain("toBe('none')");
    expect(e2eSpec).toContain("toBe('flex')");
    expect(e2eSpec).toContain('jobs-mobile-card');
  });

  it('asserts required card fields on mobile', () => {
    expect(e2eSpec).toContain('Birmingham');
    expect(e2eSpec).toContain('Manchester');
    expect(e2eSpec).toContain('Driver label');
  });

  it('captures screenshot artifacts for all viewports', () => {
    expect(e2eSpec).toContain('page.screenshot');
    // Screenshot path uses template literal: jobs-fixture-${vp.label}.png
    expect(e2eSpec).toContain('jobs-fixture-');
    expect(e2eSpec).toContain('vp.label');
    expect(e2eSpec).toContain('.png');
  });

  it('verifies no console errors and no failed requests', () => {
    expect(e2eSpec).toContain('consoleErrors');
    expect(e2eSpec).toContain('failedRequests');
    expect(e2eSpec).toContain('failingResponses');
  });
});

// ── CI workflow ───────────────────────────────────────────────────────────────

describe('Jobs visual gate CI workflow', () => {
  it('runs the Jobs visual gate spec alongside the workspace gate', () => {
    expect(workflow).toContain('jobs-visual-gate.spec.ts');
  });

  it('still runs the workspace visual auth gate', () => {
    expect(workflow).toContain('workspace-visual-auth-gate.spec.ts');
  });

  it('runs under E2E_VISUAL_FIXTURE: "true"', () => {
    expect(workflow).toContain('E2E_VISUAL_FIXTURE: "true"');
  });

  it('uploads Playwright artifacts', () => {
    expect(workflow).toContain('actions/upload-artifact@v4');
    expect(workflow).toContain('if: always()');
  });
});
