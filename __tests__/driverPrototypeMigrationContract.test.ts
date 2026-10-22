import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('Driver prototype migration contract', () => {
  const layout = read('app/driver/layout.tsx');
  const css = read('app/driver/driver-prototype-parity.css');
  const compatibility = read('app/driver/driver-operational.css');
  const baseline = read('app/components/workspace/workspace-measured-cx-baseline.css');

  it('loads the shared seven-workspace baseline last so legacy Driver CSS cannot override canonical geometry', () => {
    const operational = layout.indexOf("driver-operational.css");
    const parity = layout.indexOf("driver-prototype-parity.css");
    const baselineIndex = layout.indexOf("workspace-measured-cx-baseline.css");
    const reference = layout.indexOf("driver-dashboard-reference.css");
    const close = layout.indexOf("driver-dashboard-cx-close.css");
    const exact = layout.indexOf("driver-dashboard-prototype-exact.css");
    expect(operational).toBeGreaterThan(-1);
    expect(parity).toBeGreaterThan(operational);
    expect(close).toBeGreaterThan(reference);
    expect(exact).toBeGreaterThan(close);
    expect(baselineIndex).toBeGreaterThan(exact);
  });

  it('keeps Driver board and filter primitives owned by the measured shared baseline', () => {
    for (const selector of [
      'driver-board-layout',
      'driver-board-main',
      'driver-filter-rail',
      'driver-filter-rail__header',
      'driver-filter-rail__body',
      'driver-filter-field',
      'driver-filter-actions',
    ]) {
      expect(compatibility).not.toContain(`\n.${selector} {`);
      expect(baseline).toContain(`.xdrive-workspace-measured .${selector}`);
    }
    // Tablet rail columns are a real Driver-specific responsive adjustment.
    expect(compatibility).toContain('  .driver-filter-rail__body {');
    expect(compatibility).toContain('.driver-filter-field input,');
    // The shared 1200/1024/768px record and details breakpoints must not be
    // reintroduced in the lower-specificity Driver compatibility stylesheet.
    expect(compatibility).not.toMatch(/\.driver-load-row__top\s*\{\s*grid-template-columns:/);
    expect(compatibility).not.toMatch(/\.driver-detail-grid\s*\{\s*grid-template-columns:/);
    expect(compatibility).not.toContain('@media (max-width: 430px)');
    expect(baseline).toContain('.xdrive-workspace-measured .driver-load-row__top');
    expect(baseline).toContain('.xdrive-workspace-measured .driver-detail-grid');
    // Route-independent mobile min-height overrides must not cancel the shared
    // 52px operational row contract. Dashboard-specific refinements remain valid.
    const genericPrototypeOverrides: string[] = [];
    postcss.parse(css).walkRules((rule) => {
      for (const selector of rule.selectors) {
        if ([
          '.xdrive-driver-workspace .driver-load-row__top',
          '.xdrive-driver-workspace .driver-detail-grid',
        ].includes(selector.trim())) genericPrototypeOverrides.push(selector);
      }
    });
    expect(genericPrototypeOverrides).toEqual([]);
    // The 2px active underline must not be doubled by a legacy inset shadow.
    expect(compatibility).not.toContain('box-shadow: inset 0 -2px 0 var(--ws-blue');
    expect(baseline).toContain('border-bottom: 2px solid transparent !important;');
    expect(baseline).toContain('border-bottom-color: var(--ws-blue) !important;');
  });

  it('covers live Driver route-specific surfaces without restoring deleted legacy owners', () => {
    for (const token of [
      'driver-reference-availability',
      'driver-returns-exchange',
      'driver-load-row__top',
      'driver-diary-route',
      'xdrive-post-load-form',
      'driver-account-workspace',
      'fleet-cx-toolbar',
      'fleet-table--compact',
    ]) expect(css).toContain(token);
    // The dashboard reference is deliberately frozen in its own late layer.
    const frozen = read('app/driver/driver-dashboard-reference.css');
    expect(frozen).toContain('.driver-reference-dashboard');
    expect(read('app/driver/page.tsx')).toContain('driver-reference-dashboard');
    expect(css).not.toContain('.xdrive-driver-workspace .driver-reference-dashboard');
    // Quotes/finance are real routes, not obsolete generic board selectors.
    expect(read('app/driver/quotes/page.tsx')).toContain('driver-quotes-prototype');
    expect(read('app/driver/finance/page.tsx')).toContain('driver-finance-register');
  });

  it('does not touch the navbar in the prototype parity layer', () => {
    expect(css).not.toContain('driver-top-nav');
    expect(css).not.toContain('driver-top-shell__header');
    expect(css).toContain('.driver-prototype-port .fleet-cx-toolbar');
  });

  it('keeps prototype data out of the live Driver workspace', () => {
    for (const fake of ['North West Freight Ltd', 'Rapid Logistics UK Ltd', 'Nolawi Express Logistics', 'Save local prototype']) {
      expect(css).not.toContain(fake);
      expect(layout).not.toContain(fake);
    }
    expect(layout).not.toContain('suite.js');
  });

  it('keeps real data/authoritative flows on the live pages', () => {
    const dashboard = read('app/driver/page.tsx');
    const loads = read('app/driver/loads/page.tsx');
    const quotes = read('app/driver/quotes/page.tsx');
    const diary = read('app/driver/history/page.tsx');
    const returns = read('app/driver/returns/page.tsx');
    const availability = read('app/driver/availability/page.tsx');
    const finance = read('app/driver/finance/page.tsx');

    expect(dashboard).toContain("supabase.rpc('driver_update_job_status_atomic'");
    expect(loads).toContain('/api/driver/marketplace/loads');
    expect(quotes).toContain(".from('job_bids')");
    expect(diary).toContain(".from('jobs')");
    expect(returns).toContain("/api/driver/return-journeys");
    expect(availability).toContain(".from('drivers')");
    expect(finance).toContain("/api/driver/finance/invoices");
  });

  it('inherits the approved shared CX density at desktop scale', () => {
    expect(css).toContain('--driver-prototype-rail: var(--ws-filter-rail-w, 165px);');
    expect(css).toContain('--driver-prototype-head-h: var(--ws-panel-head-h, 36px);');
    expect(css).toContain('--driver-prototype-control-h: var(--ws-control-h, 32px);');
    expect(css).toContain('--driver-prototype-tab-h: var(--ws-tab-h, 28px);');
    expect(css).not.toContain('12.5px');
    // Finance now uses its live register tabs and all shared tab geometry
    // belongs to the measured layer, not obsolete Driver board selectors.
    expect(css).not.toContain('.xdrive-driver-workspace .driver-finance-board');
    expect(css).not.toContain('.xdrive-driver-workspace .driver-quotes-board');
    expect(baseline).toContain('.xdrive-workspace-measured .driver-tab-strip');
    expect(baseline).toContain('min-height: var(--ws-tab-h) !important;');
    expect(css).toContain('.xdrive-driver-workspace .driver-finance-register .finance-tabs');
    expect(read('app/driver/finance/page.tsx')).toContain('driver-finance-register');
    expect(css).not.toMatch(/driver-finance-board[\s\S]{0,180}min-height:\s*38px/i);
    expect(css).not.toMatch(/driver-quotes-board[\s\S]{0,180}min-height:\s*38px/i);
    expect(css).toContain('grid-template-columns: var(--driver-prototype-rail) minmax(0, 1fr) !important;');
    expect(css).not.toContain('.xdrive-driver-workspace .workspace-board-layout');
    expect(baseline).toContain('.xdrive-workspace-measured .workspace-board-layout');
    expect(baseline).toContain('--ws-filter-rail-w: 165px');
    expect(baseline).toContain('--ws-font-body: 12px');
    expect(baseline).toContain('--ws-tab-h: 28px');
    expect(css).toContain('min-height: var(--ws-control-h, 32px);');
    expect(css).toContain('height: var(--ws-table-head-h, 40px);');
    expect(css).toContain('min-height: var(--ws-table-row-h, 42px);');
    expect(css).toContain('font-size: var(--ws-font-body, 12px);');
    expect(baseline).toContain('--ws-operational-row-min-h: 52px');
    expect(baseline).toContain('min-height: var(--ws-operational-row-min-h) !important;');
  });

  it('keeps active Diary and Return Journeys Add Journey prototype properties single-owned', () => {
    const source = postcss.parse(read('app/driver/driver-full-prototype.css'));
    const monitored = new Set([
      '.driver-prototype-port .diary-action',
      '.driver-prototype-port .diary-bookings',
      '.driver-prototype-port .diary-head-cx>div:first-child>b',
      '.driver-prototype-port .pagebody:has(.diary-bookings) .left .input',
      '.driver-prototype-port .pagebody:has(.diary-bookings) .left .select',
      '.driver-prototype-port .postload-section-head',
      '.driver-prototype-port .postload-section-head>div',
      '.driver-prototype-port .postload-section-head span',
      '.driver-prototype-port .postload-section-head small strong',
      '.driver-prototype-port .postload-grid',
      '.driver-prototype-port .postload-field',
      '.driver-prototype-port .postload-field input',
      '.driver-prototype-port .postload-field select',
      '.driver-prototype-port .postload-check',
      '.driver-prototype-port .postload-check.tall',
      '.driver-prototype-port .postload-grid.documents small',
    ]);
    const observed = new Set<string>();
    const properties = new Map<string, Set<string>>();
    const duplicates: string[] = [];
    source.walkRules((rule) => {
      if (rule.parent?.type !== 'root') return;
      for (const selector of rule.selectors) {
        if (!monitored.has(selector)) continue;
        observed.add(selector);
        const seen = properties.get(selector) ?? new Set<string>();
        rule.walkDecls((decl) => {
          if (seen.has(decl.prop)) duplicates.push(`${selector} redefines ${decl.prop}`);
          seen.add(decl.prop);
        });
        properties.set(selector, seen);
      }
    });
    expect(observed).toEqual(monitored);
    expect(duplicates).toEqual([]);
  });

  it('keeps Diary record values at the compact PR675 Loads scale without oversized legacy bold type', () => {
    const match = css.match(/\.xdrive-driver-workspace \.driver-diary-route \.driver-diary-entry \.driver-cell-primary \{([^}]*)\}/);
    expect(match, 'Diary needs its route-specific primary-value adapter').not.toBeNull();
    expect(match?.[1]).toContain('font-size: 13px !important;');
    expect(match?.[1]).toContain('line-height: 18px !important;');
    expect(match?.[1]).toContain('font-weight: 600 !important;');
    expect(match?.[1]).not.toContain('13.5px');
  });

  it('keeps real Return Journeys filter controls on the shared Loads radius and type scale', () => {
    const returnsCss = read('app/driver/returns/returns-exchange.css');
    expect(returnsCss).toContain('grid-template-columns:var(--ws-filter-rail-w,165px) minmax(0,1fr)!important;');
    expect(returnsCss).toContain('min-height:var(--ws-control-h,32px)!important;');
    expect(returnsCss).toContain('font-size:var(--ws-font-body,12px)!important;');
    expect(returnsCss).toContain('border-radius:var(--ws-radius,4px)!important;');
    expect(returnsCss).not.toContain('border-radius:2px!important;');
    // The shared measured layer owns Return Journeys rail width and sticky
    // offset; the legacy 50px + 12px rule cannot compete with the 42px nav.
    expect(returnsCss).not.toMatch(/\.driver-returns-exchange \.driver-filter-rail \{\s*width: var\(--returns-rail\);/);
    expect(returnsCss).not.toContain('top: calc(var(--ws-header-h, 50px) + var(--ws-gap-grid, 12px));');
    expect(css).not.toContain('.xdrive-driver-workspace .driver-returns-exchange .driver-filter-rail {');
    expect(baseline).toContain('top: calc(var(--ws-header-h) + var(--ws-nav-h)) !important;');
  });

  it('rejects competing declarations between active Driver CSS layers while allowing frozen PR675 refinements', () => {
    const importedCss = [...layout.matchAll(/import ['"]\.\/(driver-[^'"]+\.css)['"]/g)]
      .map((match) => match[1]);
    const frozen = new Set([
      'driver-dashboard-reference.css',
      'driver-dashboard-cx-close.css',
      'driver-dashboard-prototype-exact.css',
    ]);
    const owners = new Map<string, Array<{ file: string; value: string }>>();
    const collisions: string[] = [];

    for (const file of importedCss) {
      const root = postcss.parse(read(`app/driver/${file}`), { from: file });
      root.walkRules((rule) => {
        const conditions: string[] = [];
        let ancestor: postcss.Node | undefined = rule.parent;
        while (ancestor) {
          if (ancestor.type === 'atrule') {
            const atRule = ancestor as postcss.AtRule;
            conditions.unshift(`${atRule.name} ${atRule.params}`);
          }
          ancestor = ancestor.parent;
        }
        for (const selector of rule.selectors) {
          for (const declaration of rule.nodes) {
            if (declaration.type !== 'decl') continue;
            const key = `${conditions.join(' / ')}::${selector}::${declaration.prop}`;
            const value = `${declaration.value}${declaration.important ? ' !important' : ''}`;
            const previousOwners = owners.get(key) ?? [];
            for (const previous of previousOwners) {
              if (previous.file === file || previous.value === value) continue;
              if (frozen.has(previous.file) && frozen.has(file)) continue;
              collisions.push(`${key}: ${previous.file} (${previous.value}) vs ${file} (${value})`);
            }
            previousOwners.push({ file, value });
            owners.set(key, previousOwners);
          }
        }
      });
    }

    expect(importedCss).toContain('driver-prototype-parity.css');
    expect(importedCss).toContain('driver-dashboard-prototype-exact.css');
    expect(collisions).toEqual([]);
  });

  it('keeps Driver Quotes status tabs on the shared measured CX-live tab strip', () => {
    const quotes = read('app/driver/quotes/page.tsx');
    const baseline = read('app/components/workspace/workspace-measured-cx-baseline.css');
    expect(quotes).toContain('workspace-tab-strip cx-quote-state-tabs');
    expect(quotes).not.toContain('quote-tabs workspace-tab-strip');
    expect(baseline).toContain('.xdrive-workspace-measured .cx-quote-state-tabs');
    expect(baseline).toContain('min-height: 28px !important;');
    expect(baseline).toContain('border-top: 6px solid #bfe0fb;');
  });

  it('keeps live Diary tabs and paging controls together at the compact PR675 scale', () => {
    const page = read('app/driver/history/page.tsx');
    const routeLayout = read('app/driver/history/layout.tsx');
    const diaryCss = read('app/driver/history/diary-exchange.css');
    expect(page).toContain('className="driver-board-main main diary-main"');
    expect(page).toContain('diary-tabs workspace-tab-strip');
    expect(routeLayout).toContain('driver-diary-route');
    expect(routeLayout).toContain("import './diary-exchange.css'");
    expect(page).toContain('className="driver-diary-controlbar"');
    expect(page.indexOf('className="driver-diary-controlbar"')).toBeLessThan(page.indexOf('className="diary-head diary-head-cx workspace-record-meta workspace-list-controls cx-diary-toolbar"'));
    expect(diaryCss).toContain('grid-template-columns:minmax(0,1fr) auto!important;');
    expect(diaryCss).toContain('grid-template-columns:minmax(0,1fr)!important;');
    expect(diaryCss).not.toContain('.xdrive-diary-layout');
    expect(diaryCss).not.toContain('.xdrive-diary-register');
    expect(diaryCss.match(/\.driver-diary-route \.driver-diary-shell-content\s*\{/g)).toHaveLength(1);
    expect(diaryCss).toContain('padding: var(--ws-page-y, 12px) var(--ws-page-x, 12px) 16px !important;');

    const strip = diaryCss.split('.xdrive-workspace-measured .driver-prototype-port .driver-diary-route .diary-main .driver-diary-controlbar > .diary-tabs{')[1]?.split('}')[0];
    const buttons = diaryCss.split('.xdrive-workspace-measured .driver-prototype-port .driver-diary-route .diary-main .driver-diary-controlbar > .diary-tabs button{')[1]?.split('}')[0];
    const active = diaryCss.split('.xdrive-workspace-measured .driver-prototype-port .driver-diary-route .diary-main .driver-diary-controlbar > .diary-tabs button[data-active="true"]{')[1]?.split('}')[0];
    expect(strip).toContain('height:var(--ws-tab-h,28px)!important;');
    expect(strip).toContain('overflow-x:auto!important;');
    expect(strip).toContain('overflow-y:hidden!important;');
    expect(buttons).toContain('height:var(--ws-tab-h,28px)!important;');
    expect(buttons).toContain('font-size:var(--ws-font-label,11px)!important;');
    expect(active).toContain('border-bottom-color:var(--ws-blue,#1d57d8)!important;');
  });
});