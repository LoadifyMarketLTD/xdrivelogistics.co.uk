import fs from 'node:fs';
import path from 'node:path';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('workspace canonical handoff geometry', () => {
  it('keeps Carrier scoped away from Driver and Super Admin', () => {
    const layout = read('app/admin/layout.tsx');
    const css = read('app/admin/carrier-workspace-canonical.css');
    expect(layout).toContain('xdrive-carrier-workspace');
    expect(css).toContain('.xdrive-carrier-workspace');
    expect(css).not.toContain('.xdrive-driver-workspace');
    expect(css).not.toContain('.super-admin');
  });

  it('does not reintroduce superseded shared geometry tokens outside the frozen Driver dashboard', () => {
    const liveSharedCss = [
      'app/admin/carrier-workspace-canonical.css',
      'app/broker/broker-dashboard-convergence.css',
      'app/customer/customer-dashboard.css',
      'app/components/workspace/workspace-measured-cx-baseline.css',
      'app/components/workspace/top-workspace-shell.css',
      'app/components/workspace/WorkspaceUI.module.css',
    ].map(read).join('\n');

    expect(liveSharedCss).not.toMatch(/--ws-filter-rail-w\s*:\s*(?:185|188|220|245)px/);
    expect(liveSharedCss).not.toMatch(/--ws-tab-h\s*:\s*38px/);
    expect(liveSharedCss).not.toMatch(/--ws-table-row-h\s*:\s*46px/);
    expect(liveSharedCss).not.toMatch(/--ws-font-body\s*:\s*12\.5px/);
    expect(liveSharedCss).not.toMatch(/--ws-nav-h\s*:\s*50px/);
  });

  it('keeps 11px filter and operational labels owned by the shared typography token', () => {
    const baseline = read('app/components/workspace/workspace-measured-cx-baseline.css');
    expect(baseline).toContain('--ws-font-label: 11px;');
    expect(baseline).toMatch(/\.xdrive-workspace-measured label,[\s\S]{0,220}font-size: var\(--ws-font-label\) !important;/);
    expect(baseline).toMatch(/\.xdrive-workspace-measured \.driver-cell-label,[\s\S]{0,220}font-size: var\(--ws-font-label\) !important;/);
    expect(baseline).toMatch(/\.xdrive-workspace-measured \.workspace-operational-cell>div:first-child\{\s*font-size:var\(--ws-font-label\)!important;/);
    expect(baseline).not.toContain('font-size: 10.8px !important;');
  });

  it('keeps Carrier register and detail density on the shared approved reference', () => {
    const css = read('app/admin/carrier-workspace-canonical.css');
    const baseline = read('app/components/workspace/workspace-measured-cx-baseline.css');
    expect(css).toContain('padding: 8px 10px 12px !important;');
    expect(css).toContain('height: var(--ws-table-head-h) !important;');
    expect(css).toContain('height: var(--ws-table-row-h) !important;');
    expect(css).toContain('font-size: var(--ws-font-body) !important;');
    const registerLabel = css.match(/\.xdrive-carrier-workspace \.carrier-register-page label \{([^}]*)\}/)?.[1];
    expect(registerLabel).toContain('font-size: var(--ws-font-label, 11px) !important;');
    expect(registerLabel).not.toContain('--ws-font-body');
    expect(css.match(/\.xdrive-carrier-workspace \.carrier-register-page button \{/g)).toHaveLength(1);
    expect(css).toContain('min-height: var(--ws-control-h, 32px) !important;');
    expect(css).toContain('border-radius: var(--ws-radius, 4px) !important;');
    expect(baseline).toContain('--ws-table-head-h: 40px');
    expect(baseline).toContain('--ws-table-row-h: 42px');
    expect(baseline).toContain('--ws-font-body: 12px');
  });

  it('keeps Broker dashboard compact on the shared Owner Driver control-desk geometry', () => {
    const layout = read('app/broker/layout.tsx');
    const dashboard = read('app/broker/BrokerDashboardHome.tsx');
    const css = read('app/broker/broker-dashboard-convergence.css');
    const baseline = read('app/components/workspace/workspace-measured-cx-baseline.css');
    const workspaceUi = read('app/components/workspace/WorkspaceUI.module.css');
    expect(layout).toContain('xdrive-broker-workspace');
    expect(dashboard).toContain('broker-clean-dashboard xdrive-owner-dashboard-grid');
    expect(dashboard).toContain('<OperationalCard');
    expect(dashboard).toContain('<OperationalTable');
    expect(css).not.toContain('.broker-clean-box {');
    expect(css).not.toContain('.broker-clean-table {');
    expect(workspaceUi).toContain('height: var(--ws-table-head-h, 40px);');
    expect(workspaceUi).toContain('height: var(--ws-table-row-h, 42px);');
    expect(baseline).toContain('--ws-dashboard-left-col: .84fr');
    expect(baseline).toContain('--ws-dashboard-right-col: 1.16fr');
    expect(baseline).toContain('minmax(360px, var(--ws-dashboard-left-col)) minmax(0, var(--ws-dashboard-right-col))');
    expect(baseline).toContain('--ws-table-head-h: 40px');
    expect(baseline).toContain('--ws-table-row-h: 42px');
  });

  it('keeps Customer rail and table geometry on the shared approved reference', () => {
    const layout = read('app/customer/layout.tsx');
    const css = read('app/customer/customer-dashboard.css');
    const baseline = read('app/components/workspace/workspace-measured-cx-baseline.css');
    expect(layout).toContain('xdrive-customer-workspace');
    expect(css).not.toContain('.customer-owner-stat-grid');
    expect(read('app/customer/CustomerDashboardHome.tsx')).toContain('<KpiGrid>');
    expect(css).not.toMatch(/grid-template-columns:\s*(?:165|185|220)px\s+minmax\(0,\s*1fr\)/);
    expect(baseline).toContain('.xdrive-workspace-measured .workspace-board-layout');
    expect(baseline).toContain('grid-template-columns: var(--ws-filter-rail-w) minmax(0, 1fr) !important;');
    expect(baseline).toContain('.xdrive-workspace-measured thead th {');
    expect(baseline).toContain('height: var(--ws-table-head-h) !important;');
    expect(baseline).toContain('.xdrive-workspace-measured tbody td {');
    expect(baseline).toContain('font-size: var(--ws-font-body) !important;');
    expect(baseline).toContain('--ws-filter-rail-w: 165px');
    expect(baseline).toContain('--ws-table-head-h: 40px');
    expect(baseline).toContain('--ws-table-row-h: 42px');
    expect(baseline).toContain('--ws-font-body: 12px');
  });

  it('keeps every legacy Carrier page inside an approved page model', () => {
    const registerPages = [
      'app/admin/bids/page.tsx',
      'app/admin/companies/page.tsx',
      'app/admin/dispatchers/page.tsx',
      'app/admin/disputes/page.tsx',
      'app/admin/documents/page.tsx',
      'app/admin/drivers/page.tsx',
      'app/admin/fleet/managers/page.tsx',
      'app/admin/vehicles/page.tsx',
    ];
    const detailPages = [
      'app/admin/invoices/[id]/page.tsx',
      'app/admin/invoices/new/page.tsx',
      'app/admin/jobs/[id]/page.tsx',
    ];

    for (const page of registerPages) expect(read(page)).toContain('carrier-register-page');
    for (const page of detailPages) expect(read(page)).toContain('carrier-detail-page');
  });

  it('keeps Carrier create-job and empty-state surfaces compact', () => {
    const jobs = read('app/admin/jobs/page.tsx');
    const css = read('app/admin/carrier-workspace-canonical.css');
    expect(jobs).toContain('carrier-job-create-header');
    expect(jobs).toContain('carrier-job-create-body');
    expect(jobs).toContain('carrier-job-create-actions');
    expect(css).toContain('.carrier-job-create-body .admin-job-section');
    expect(css).toContain('.carrier-register-empty');
    // The measured 32px input reset must not suppress invalid-field borders.
    // Preserve feedback for all fields validated by the six-step form.
    for (const field of [
      'clientName', 'clientEmail', 'clientPhone', 'pickupPostcode', 'pickupAddress',
      'pickupDate', 'pickupTime', 'collectionContactName', 'collectionContactPhone',
      'deliveryPostcode', 'deliveryAddress', 'deliveryDate', 'deliveryTime',
      'deliveryContactName', 'deliveryContactPhone', 'cargoQuantity',
    ]) {
      expect(jobs).toContain(`aria-invalid={Boolean(formErrors.${field})}`);
    }
    expect(css).toContain('.carrier-job-create-body :is(input:not([type="checkbox"]), select)[aria-invalid="true"]');
    expect(css).toContain('border-color: var(--ws-red, #c62828) !important;');
  });

  it('reuses responsive Carrier Company edit modal fields and accessible close buttons', () => {
    const companies = read('app/admin/companies/page.tsx');
    const css = read('app/admin/carrier-workspace-canonical.css');
    expect(companies.match(/className="carrier-register-modal__field-grid"/g)).toHaveLength(3);
    expect(companies).toContain('aria-label="Close register company dialog"');
    expect(companies).toContain('aria-label="Close edit company dialog"');
    expect(companies).not.toContain('}>?</button>');
    expect(css).toContain('grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));');
  });

  it('reuses Carrier invoice panels in responsive edit and preview views', () => {
    const invoice = read('app/admin/invoices/[id]/page.tsx');
    const css = read('app/admin/carrier-workspace-canonical.css');
    expect(invoice.match(/className="carrier-invoice-create-panel"/g)).toHaveLength(3);
    expect(invoice).toContain('className="carrier-invoice-editor-columns"');
    expect(css).toContain('.carrier-invoice-editor-columns > *');
    expect(invoice).toContain('className="carrier-invoice-action-toolbar"');
    expect(css).toContain('.carrier-invoice-action-toolbar > button {');
  });

  it('uses one measured register grammar for Drivers and Vehicles instead of legacy dark/pill styles', () => {
    const css = read('app/admin/carrier-workspace-canonical.css');
    const baseline = read('app/components/workspace/workspace-measured-cx-baseline.css');
    const drivers = read('app/admin/drivers/page.tsx');
    const vehicles = read('app/admin/vehicles/page.tsx');
    for (const className of [
      'carrier-register-summary',
      'carrier-register-board',
      'carrier-register-filters',
      'carrier-register-results',
      'carrier-register-tabs',
      'carrier-driver-card',
    ]) {
      expect(drivers).toContain(className);
      expect(css).toContain(`.xdrive-carrier-workspace .${className}`);
    }
    expect(drivers).toContain('className="carrier-register-tab"');
    expect(drivers).toContain('data-active={activeTab === tab.key}');
    expect(drivers).not.toContain("background: '#111827'");
    expect(drivers).not.toContain("gridTemplateColumns: 'minmax(220px, 260px)");
    // Company warnings and the driver/vehicle form errors preserve their
    // semantic colours while inheriting compact shared banner geometry.
    expect(drivers.match(/className="xdrive-alert-banner"/g)).toHaveLength(4);
    expect(vehicles.match(/className="xdrive-alert-banner"/g)).toHaveLength(2);
    expect(baseline).toContain('.xdrive-workspace-measured .xdrive-alert-banner {');
    expect(drivers).not.toContain("borderRadius: '10px', padding: '0.85rem'");
    expect(vehicles).not.toContain("borderRadius: '6px', padding: '0.75rem'");
    expect(vehicles.match(/className="carrier-register-modal__field-grid"/g)).toHaveLength(2);
    expect(vehicles).not.toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))'");
    expect(css).toContain('.xdrive-carrier-workspace .carrier-register-modal__field-grid {');
    expect(css).toContain('grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));');
    expect(vehicles).toContain('carrier-register-toolbar');
    expect(vehicles).toContain('carrier-register-table-wrap');
    expect(vehicles).toContain('carrier-register-table');
    expect(vehicles).toContain('carrier-register-action');
    expect(css).toContain('grid-template-columns: var(--ws-filter-rail-w) minmax(0, 1fr);');
    // Register status tabs are an instance of the shared tab primitive, not a
    // second owner of height, hover colours or active underline rules.
    expect(drivers).toContain('carrier-register-tabs workspace-tab-strip');
    expect(baseline).toContain('.xdrive-workspace-measured .workspace-tab-strip button,');
    expect(baseline).toContain('.xdrive-workspace-measured .workspace-tab-strip button[data-active="true"],');
    expect(css).toContain('.xdrive-carrier-workspace .carrier-register-tab {');
    expect(css).not.toContain('.xdrive-carrier-workspace .carrier-register-tab:hover');
    expect(css).not.toContain('.xdrive-carrier-workspace .carrier-register-tab[data-active="true"]');
    expect(css).not.toContain('.carrier-register-page--drivers > div:nth-child(2)');
  });

  it('keeps Dispatcher, Company, Bid, Dispute and Compliance document pages on reusable register surfaces', () => {
    const css = read('app/admin/carrier-workspace-canonical.css');
    const dispatchers = read('app/admin/dispatchers/page.tsx');
    const companies = read('app/admin/companies/page.tsx');
    const bids = read('app/admin/bids/page.tsx');
    const disputes = read('app/admin/disputes/page.tsx');
    const documents = read('app/admin/documents/page.tsx');
    for (const page of [dispatchers, companies, bids, disputes, documents]) {
      expect(page).toContain('carrier-register-toolbar');
      expect(page).toContain('carrier-register-title');
      expect(page).toContain('carrier-register-subtitle');
    }
    for (const page of [dispatchers, companies, bids, documents]) {
      expect(page).toContain('carrier-register-table-wrap');
    }
    for (const page of [dispatchers, companies, documents]) {
      expect(page).toContain('carrier-register-results');
    }
    for (const page of [dispatchers, companies, documents]) {
      expect(page).toContain('carrier-register-action');
    }
    expect(bids).toContain('carrier-register-bid-group');
    expect(bids).toContain('data-awarded={isAwarded');
    expect(disputes).toContain('xdrive-owner-dashboard-grid carrier-register-dispute-grid');
    expect(disputes).toContain('carrier-register-dispute-detail');
    expect(disputes).toContain('className="xdrive-alert-banner" role="alert"');
    expect(disputes.match(/className="carrier-register-results carrier-register-empty" role="status"/g)).toHaveLength(2);
    expect(css).toContain('.xdrive-carrier-workspace .carrier-register-empty {');
    expect(disputes).not.toContain("borderRadius: '10px', padding: '2rem'");
    expect(css).toContain('.carrier-register-dispute-grid');
    expect(css).toContain('.carrier-register-bid-group__header');
    expect(css).toContain('.carrier-register-content');
  });

  it('activates the light-workspace guard on the live non-Driver operational shells while leaving the frozen Driver shell independent', () => {
    const admin = read('app/admin/layout.tsx');
    const broker = read('app/broker/layout.tsx');
    const customer = read('app/customer/layout.tsx');
    const driver = read('app/driver/layout.tsx');
    for (const layout of [admin, broker, customer]) expect(layout).toContain('xdrive-workspace-visual');
    expect(driver).not.toContain('xdrive-workspace-visual');
  });

  it('keeps shared PageFrame and PageHeader styles in WorkspaceUI instead of competing shell overrides', () => {
    const ui = read('app/components/workspace/WorkspaceUI.tsx');
    const moduleCss = read('app/components/workspace/WorkspaceUI.module.css');
    const shellCss = read('app/components/workspace/top-workspace-shell.css');
    const baseline = read('app/components/workspace/workspace-measured-cx-baseline.css');
    for (const name of ['pageFrame', 'pageHeader', 'pageHeaderTitle', 'pageHeaderMeta', 'pageHeaderActions']) {
      expect(ui).toContain(`styles.${name}`);
      expect(moduleCss).toContain(`.${name} {`);
    }
    expect(shellCss).not.toContain('.top-workspace-shell__content th {');
    expect(shellCss).not.toContain('.top-workspace-shell__content input,');
    // The mobile shell must not override PageFrame padding owned by the CX baseline.
    expect(shellCss).not.toMatch(/\.xdrive-operational-top-workspace \.xdrive-page-frame\s*\{/);
    expect(baseline).toContain('.xdrive-workspace-measured thead th {');
    expect(baseline).toContain('.xdrive-workspace-measured tbody td {');
    expect(baseline).toContain('--ws-nav-h: 42px;');
    expect(baseline).toContain('--ws-filter-rail-w: 165px;');
  });

  it('keeps the Carrier Create Job mobile stepper isolated and on the measured tab contract', () => {
    const jobs = read('app/admin/jobs/page.tsx');
    const css = read('app/admin/carrier-workspace-canonical.css');
    expect(jobs).toContain('aria-label="Create job steps"');
    expect(jobs).toContain('className="admin-job-mobile-stepper__tab"');
    expect(jobs).toContain('data-active={index === jobFormStep}');
    expect(jobs).toContain("aria-current={index === jobFormStep ? 'step' : undefined}");
    expect(jobs).not.toContain('<style>{`');
    expect(css).toContain('.xdrive-carrier-workspace .carrier-job-create-modal .admin-job-mobile-stepper__tab');
    expect(css).toContain('min-height: var(--ws-tab-h, 28px) !important;');
    expect(css).toContain('border-bottom: 2px solid transparent !important;');
    expect(css).toContain('.admin-job-mobile-stepper__tab[data-active="true"]');
    expect(css).toContain('border-bottom-color: var(--ws-blue, #1d57d8) !important;');
    expect(css).toContain('.xdrive-carrier-workspace .carrier-job-create-body .admin-job-section.active');
    expect(css).not.toMatch(/(?:^|\n)\s*\.admin-job-section\s*\{\s*display:\s*none/i);
  });

  it('stacks Broker customer and Owner Driver invoice editors with the shared tablet two-column contract', () => {
    const brokerCustomers = read('app/broker/customers/page.tsx');
    const editor = read('app/driver/finance/invoices/[id]/edit/page.tsx');
    expect(brokerCustomers).toContain('className="workspace-panel__body xdrive-two-column"');
    const baseline = read('app/components/workspace/workspace-measured-cx-baseline.css');
    expect(editor).toContain('className="xdrive-two-column"');
    expect(editor).toContain('minmax(0, 1fr) minmax(320px, .72fr)');
    expect(baseline).toMatch(/@media \(max-width: 1024px\) \{[\s\S]*?\.xdrive-workspace-measured \.xdrive-two-column \{\s*grid-template-columns: minmax\(0, 1fr\) !important;/);
  });

  it('uses a shared CX-density dialog grammar for company, team, vehicle and quote registers', () => {
    const css = read('app/admin/carrier-workspace-canonical.css');
    const rolePages = [
      'app/admin/companies/page.tsx',
      'app/admin/dispatchers/page.tsx',
      'app/admin/drivers/page.tsx',
      'app/admin/vehicles/page.tsx',
      'app/admin/quotes/page.tsx',
    ];
    for (const name of [
      'carrier-register-modal-overlay',
      'carrier-register-modal',
      'carrier-register-modal__header',
      'carrier-register-modal__body',
      'carrier-register-modal__footer',
    ]) {
      expect(css).toContain('.xdrive-carrier-workspace .' + name);
      for (const page of rolePages) expect(read(page)).toContain(name);
    }
    // The shared overlay must own backdrop opacity, stacking and spacing;
    // legacy inline geometry was silently winning over this canonical CSS.
    for (const page of [
      'app/admin/companies/page.tsx',
      'app/admin/dispatchers/page.tsx',
      'app/admin/documents/page.tsx',
      'app/admin/drivers/page.tsx',
      'app/admin/vehicles/page.tsx',
      'app/admin/quotes/page.tsx',
    ]) {
      const overlays = read(page).match(/<div className="carrier-register-modal-overlay"[^>]*>/g) ?? [];
      expect(overlays.length, `${page} needs the shared overlay`).toBeGreaterThan(0);
      for (const overlay of overlays) expect(overlay).not.toContain('style=');
    }
    const overlayCss = css.match(/\.xdrive-carrier-workspace \.carrier-register-modal-overlay \{([^}]*)\}/)?.[1];
    expect(overlayCss).toContain('z-index: 1000 !important;');
    expect(overlayCss).toContain('padding: 12px;');
    expect(css).toContain('min-height: var(--ws-control-h) !important;');
    expect(css).toContain('min-height: var(--ws-panel-head-h);');
    expect(css).toContain(':not(.carrier-register-modal-overlay) > div');
    expect(read('app/admin/vehicles/page.tsx')).toContain('carrier-register-modal--confirm');
    expect(read('app/admin/documents/page.tsx')).toContain('carrier-register-modal--documents');
    expect(css).toContain('.carrier-register-modal--documents > h2');
    const quotePage = read('app/admin/quotes/page.tsx');
    expect(quotePage).toContain('role="dialog" aria-modal="true" aria-labelledby="carrier-new-quote-title"');
    expect(quotePage).toContain('aria-label="Close quote editor"');
    expect(quotePage).toContain("fontSize: 'var(--ws-font-body, 12px)'");
    expect(quotePage.match(/style=\{modalFieldPairStyle\}/g)).toHaveLength(2);
    expect(quotePage).toContain('repeat(auto-fit, minmax(min(100%, 180px), 1fr))');
    expect(quotePage).not.toContain("background: 'rgba(15,23,42,.38)'");
  });
});
