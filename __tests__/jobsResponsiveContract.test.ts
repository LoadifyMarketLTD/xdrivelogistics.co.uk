/**
 * Jobs responsive layout contract tests.
 *
 * Validates that the responsive layout contract for the Jobs operational table
 * and mobile card list is correctly structured in the component and CSS module.
 *
 * Breakpoints:
 *   Desktop  ≥769px : full dense table (default)
 *   Tablet   481–768px : compact table; Customer/Distance columns hidden via CSS
 *   Mobile   ≤480px : table hidden; stacked job cards shown
 *
 * These tests verify the code-level contract (CSS class presence, media queries,
 * component structure) rather than pixel-level rendering, which is verified by
 * E2E visual fixture tests.
 *
 * Reference: docs/ui/cx/jobs.md, PR #338 directive Section 1/2/3
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const TABLE_SRC = readFileSync(
  resolve(process.cwd(), 'app/components/workspace/JobsOperationalTable.tsx'),
  'utf8',
);

const CSS_SRC = readFileSync(
  resolve(process.cwd(), 'app/components/workspace/WorkspaceUI.module.css'),
  'utf8',
);

// ---------------------------------------------------------------------------
// 1. Mobile card container — CSS class existence and media query
// ---------------------------------------------------------------------------

describe('Jobs responsive — mobile card CSS', () => {
  it('defines .jobsMobileCardList in the CSS module', () => {
    expect(CSS_SRC).toContain('.jobsMobileCardList');
  });

  it('defines .jobsMobileCard in the CSS module', () => {
    expect(CSS_SRC).toContain('.jobsMobileCard {');
  });

  it('defines .jobsMobileCardHeader for ref/status/expand row', () => {
    expect(CSS_SRC).toContain('.jobsMobileCardHeader {');
  });

  it('defines .jobsMobileCardBody for the main card body', () => {
    expect(CSS_SRC).toContain('.jobsMobileCardBody {');
  });

  it('defines .jobsMobileCardRoute for the pickup→delivery route block', () => {
    expect(CSS_SRC).toContain('.jobsMobileCardRoute {');
  });

  it('defines .jobsMobileCardRow for label+value field rows', () => {
    expect(CSS_SRC).toContain('.jobsMobileCardRow {');
  });

  it('defines .jobsMobileCardLabel for field labels', () => {
    expect(CSS_SRC).toContain('.jobsMobileCardLabel {');
  });

  it('defines .jobsMobileCardDetail for the expandable detail section', () => {
    expect(CSS_SRC).toContain('.jobsMobileCardDetail {');
  });

  it('defines .jobsMobileCardActions for the primary action row', () => {
    expect(CSS_SRC).toContain('.jobsMobileCardActions {');
  });

  it('hides .jobsMobileCardList by default (display:none)', () => {
    // The default rule for mobile card list must be display:none so it is
    // invisible on desktop and tablet (where table is shown).
    const listRule = CSS_SRC.match(/\.jobsMobileCardList\s*\{([^}]+)\}/);
    expect(listRule).not.toBeNull();
    expect(listRule![1]).toContain('display: none');
  });

  it('shows .jobsMobileCardList and hides .jobsTableSection inside @media (max-width: 480px)', () => {
    expect(CSS_SRC).toContain('@media (max-width: 480px)');
    // Both rules must appear inside the 480px media query block
    const mobileMediaBlock = CSS_SRC.match(/@media \(max-width: 480px\)\s*\{([\s\S]*?)(?=\n@media|$)/)?.[1] ?? '';
    expect(mobileMediaBlock).toContain('jobsTableSection');
    expect(mobileMediaBlock).toContain('jobsMobileCardList');
  });
});

// ---------------------------------------------------------------------------
// 2. Desktop/tablet table section wrapper
// ---------------------------------------------------------------------------

describe('Jobs responsive — table section wrapper', () => {
  it('defines .jobsTableSection in the CSS module', () => {
    expect(CSS_SRC).toContain('.jobsTableSection');
  });

  it('uses .jobsTableSection wrapper in the component', () => {
    expect(TABLE_SRC).toContain('jobsTableSection');
  });

  it('marks the table section with data-testid="jobs-desktop-table"', () => {
    expect(TABLE_SRC).toContain('data-testid="jobs-desktop-table"');
  });

  it('marks the mobile card list with data-testid="jobs-mobile-cards"', () => {
    expect(TABLE_SRC).toContain('data-testid="jobs-mobile-cards"');
  });
});

// ---------------------------------------------------------------------------
// 3. Tablet column hiding — Customer and Distance columns
// ---------------------------------------------------------------------------

describe('Jobs responsive — tablet column hiding', () => {
  it('defines .jobsColCustomer in the CSS module', () => {
    expect(CSS_SRC).toContain('.jobsColCustomer');
  });

  it('defines .jobsColDistance in the CSS module', () => {
    expect(CSS_SRC).toContain('.jobsColDistance');
  });

  it('hides .jobsColCustomer and .jobsColDistance at max-width 768px', () => {
    expect(CSS_SRC).toContain('@media (max-width: 768px)');
    const tabletBlock = CSS_SRC.match(/@media \(max-width: 768px\)\s*\{([\s\S]*?)(?=\n@media)/)?.[1] ?? '';
    expect(tabletBlock).toContain('jobsColCustomer');
    expect(tabletBlock).toContain('jobsColDistance');
    // Both must be set to display:none
    expect(tabletBlock).toContain('display: none');
  });

  it('applies .jobsColCustomer to both the Customer <th> and <td>', () => {
    // Count occurrences — must appear at least twice (th + td)
    const matches = TABLE_SRC.match(/jobsColCustomer/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });

  it('applies .jobsColDistance to both the Distance <th> and <td>', () => {
    const matches = TABLE_SRC.match(/jobsColDistance/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// 4. Mobile card required fields — component source contract
// ---------------------------------------------------------------------------

describe('Jobs responsive — mobile card required fields', () => {
  it('renders job reference in the card header (.jobsMobileCardRef)', () => {
    expect(TABLE_SRC).toContain('jobsMobileCardRef');
    expect(TABLE_SRC).toContain('job.jobRef');
  });

  it('renders status badge in each card', () => {
    // The mobile card path must use jobsStatusBadge with statusLabel
    // Count occurrences (once for table row, at least once for mobile card)
    const badgeCount = (TABLE_SRC.match(/jobsStatusBadge/g) ?? []).length;
    expect(badgeCount).toBeGreaterThanOrEqual(2);
  });

  it('renders expand/collapse control in each card', () => {
    // jobsExpandBtn must appear for both table row and mobile card
    const expandCount = (TABLE_SRC.match(/jobsExpandBtn/g) ?? []).length;
    expect(expandCount).toBeGreaterThanOrEqual(2);
  });

  it('renders route block (pickup → delivery) in mobile card', () => {
    expect(TABLE_SRC).toContain('jobsMobileCardRoute');
    expect(TABLE_SRC).toContain('jobsMobileCardRouteOrigin');
    expect(TABLE_SRC).toContain('jobsMobileCardRouteDest');
    expect(TABLE_SRC).toContain('job.pickup.location');
    expect(TABLE_SRC).toContain('job.delivery.location');
  });

  it('renders pickup and delivery timing rows', () => {
    // Both pickup and delivery labels appear as JSX text nodes in the card body
    expect(TABLE_SRC).toContain('>Pickup<');
    expect(TABLE_SRC).toContain('>Delivery<');
    expect(TABLE_SRC).toContain('job.pickup.date');
    expect(TABLE_SRC).toContain('job.delivery.date');
  });

  it('renders vehicle and cargo summary in card body', () => {
    expect(TABLE_SRC).toContain('>Vehicle<');
    expect(TABLE_SRC).toContain('job.vehicleType');
    expect(TABLE_SRC).toContain('job.cargo?.type');
  });

  it('renders assigned driver or Unassigned in card body', () => {
    expect(TABLE_SRC).toContain('>Driver<');
    expect(TABLE_SRC).toContain('resolveDriverName(job.assignedDriverId)');
  });

  it('renders customer name in card body', () => {
    expect(TABLE_SRC).toContain('>Customer<');
    expect(TABLE_SRC).toContain('job.client.name');
  });

  it('renders View action in card action row', () => {
    expect(TABLE_SRC).toContain('jobsMobileCardActions');
    // View button must appear in the card action section (not just the table)
    expect(TABLE_SRC).toContain("onViewJob(job.id)");
  });

  it('renders Post action for draft jobs in card action row', () => {
    expect(TABLE_SRC).toContain("onPostJob(job.id)");
  });

  it('renders status-update select for non-draft jobs with valid transitions', () => {
    // The mobile card must also include the status update select
    expect(TABLE_SRC).toContain('transitions.length > 0');
    expect(TABLE_SRC).toContain('onStatusChange(job.id, next)');
  });

  it('renders Direct Invite button when eligible', () => {
    expect(TABLE_SRC).toContain('isDirectInviteEligible(job)');
    expect(TABLE_SRC).toContain('onDirectInvite(job)');
  });
});

// ---------------------------------------------------------------------------
// 5. Mobile card expandable detail fields
// ---------------------------------------------------------------------------

describe('Jobs responsive — mobile card expandable detail', () => {
  it('conditionally renders .jobsMobileCardDetail when row is expanded', () => {
    expect(TABLE_SRC).toContain('jobsMobileCardDetail');
    expect(TABLE_SRC).toContain('isExpanded');
  });

  it('shows client email in expandable detail', () => {
    expect(TABLE_SRC).toContain('job.clientEmail');
  });

  it('shows client phone in expandable detail', () => {
    expect(TABLE_SRC).toContain('job.clientPhone');
  });

  it('shows payment terms in expandable detail', () => {
    expect(TABLE_SRC).toContain('job.paymentTerms');
  });

  it('shows awarded carrier in expandable detail', () => {
    expect(TABLE_SRC).toContain('job.awarded_carrier_company_id');
  });

  it('shows exchange visibility in expandable detail', () => {
    expect(TABLE_SRC).toContain('job.exchange_visibility');
  });

  it('shows cargo notes in expandable detail', () => {
    expect(TABLE_SRC).toContain("job.cargo?.notes");
  });

  it('shows load detail summary in expandable detail', () => {
    expect(TABLE_SRC).toContain('job.loadDetailSummary');
  });

  it('shows distance in expandable detail', () => {
    expect(TABLE_SRC).toContain('job.distanceMiles');
  });
});

// ---------------------------------------------------------------------------
// 6. Toolbar responsive adaptation
// ---------------------------------------------------------------------------

describe('Jobs responsive — toolbar adaptation', () => {
  it('overrides toolbar height to auto at max-width 768px', () => {
    const tabletBlock = CSS_SRC.match(/@media \(max-width: 768px\)\s*\{([\s\S]*?)(?=\n@media)/)?.[1] ?? '';
    expect(tabletBlock).toContain('height: auto');
  });

  it('allows toolbar wrapping at tablet breakpoint', () => {
    const tabletBlock = CSS_SRC.match(/@media \(max-width: 768px\)\s*\{([\s\S]*?)(?=\n@media)/)?.[1] ?? '';
    expect(tabletBlock).toContain('flex-wrap: wrap');
  });

  it('narrows search input at tablet breakpoint', () => {
    const tabletBlock = CSS_SRC.match(/@media \(max-width: 768px\)\s*\{([\s\S]*?)(?=\n@media)/)?.[1] ?? '';
    expect(tabletBlock).toContain('jobsToolbarSearch');
  });
});

// ---------------------------------------------------------------------------
// 7. Fragment key — no anonymous fragment root in lists
// ---------------------------------------------------------------------------

describe('Jobs responsive — fragment key correctness', () => {
  it('uses Fragment (not <>) for the keyed table row list', () => {
    // Anonymous fragment (<>) cannot carry a React key; must use Fragment explicitly
    expect(TABLE_SRC).toContain('<Fragment key={job.id}>');
    expect(TABLE_SRC).toContain('</Fragment>');
  });
});

// ---------------------------------------------------------------------------
// 8. Breakpoint values match the documented contracts
// ---------------------------------------------------------------------------

describe('Jobs responsive — breakpoint values', () => {
  it('uses 480px as the mobile/card breakpoint', () => {
    expect(CSS_SRC).toContain('max-width: 480px');
  });

  it('uses 768px as the tablet breakpoint', () => {
    expect(CSS_SRC).toContain('max-width: 768px');
  });
});
