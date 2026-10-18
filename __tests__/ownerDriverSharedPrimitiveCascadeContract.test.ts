import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
function declarations(file: string, selector: string) {
  const values: Record<string, string> = {};
  postcss.parse(read(file)).walkRules((rule) => {
    if (!rule.selectors.includes(selector)) return;
    rule.walkDecls((declaration) => { values[declaration.prop] = declaration.value; });
  });
  return values;
}
const shared = 'app/components/workspace/workspace-measured-cx-baseline.css';
const owner = 'app/driver/driver-full-prototype.css';
const shell = 'app/components/workspace/top-workspace-shell.css';

describe('Owner Driver shared primitive cascade contract', () => {
  it('keeps one menu width and the same mobile edges for operational roles', () => {
    const css = read(shell);
    const menu = declarations(shell, '.xdrive-operational-top-workspace .top-workspace-nav__menu');
    expect(css).toContain('width: 248px !important;');
    expect(menu['max-height']).toBe('calc(100vh - 104px)');
    expect(menu['scrollbar-gutter']).toBe('stable');
    expect(css).not.toContain('width: 280px !important;');
    expect(css).not.toContain('max-width: min(252px');
    expect(css).not.toContain('width: 34px !important;');
    const component = read('app/components/workspace/TopWorkspaceShell.tsx');
    expect(component).toContain('<SharedMoreIcon item={item} />');
    expect(component).not.toContain(': item.icon ?? null}');
    expect(component).toContain('href={fixtureRouteFor(item.href)}');
    expect(component).toContain('prefetch={false}');
    expect(component).not.toContain('onClick={() => openRoute(item.href)}');
  });

  it('copies the actual Owner Driver table palette rather than a parallel role palette', () => {
    const head = declarations(shared, '.xdrive-workspace-measured .xdrive-operational-table th');
    const ownerHead = declarations(owner, '.driver-prototype-port th');
    expect(head.color).toBe(ownerHead.color);
    expect(head.background).toBe(ownerHead.background);
    expect(head['letter-spacing']).toBe(ownerHead['letter-spacing']);
    expect(head['border-right']).toBe(ownerHead['border-right']);
    const cell = declarations(shared, '.xdrive-workspace-measured .xdrive-operational-table td');
    const ownerCell = declarations(owner, '.driver-prototype-port td');
    for (const property of ['font-weight', 'color', 'border-right']) {
      expect(cell[property]).toBe(ownerCell[property]);
    }
  });

  it('preserves the Owner Driver fixed table width and sticky head without changing column data', () => {
    const table = declarations(shared, '.xdrive-workspace-measured .xdrive-operational-table');
    const ownerTable = declarations(owner, '.driver-prototype-port table');
    expect(table['min-width']).toBe(ownerTable['min-width']);
    expect(table['table-layout']).toBe(ownerTable['table-layout']);
    const head = declarations(shared, '.xdrive-workspace-measured .xdrive-operational-table thead');
    const ownerHead = declarations(owner, '.driver-prototype-port thead');
    for (const property of ['position', 'top', 'z-index']) expect(head[property]).toBe(ownerHead[property]);
  });

  it('does not let Customer and Carrier paint shared primitives differently', () => {
    const carrier = declarations('app/admin/carrier-workspace-canonical.css', '.xdrive-carrier-workspace .top-workspace-shell__content');
    expect(carrier.color).toBe('var(--ws-text)');
    const customer = declarations('app/customer/customer-dashboard.css', '.xdrive-customer-workspace .xdrive-operational-card');
    expect(customer['border-color']).toBeUndefined();
  });

  it('keeps the added table adapter outside Super Admin and avoids extra important declarations', () => {
    const css = read(shared);
    const adapter = '/* Shared OperationalTable adopts' + css.split('/* Shared OperationalTable adopts')[1].split('/* Operational records. */')[0];
    const ast = postcss.parse(adapter);
    ast.walkRules((rule) => {
      expect(rule.selector.startsWith('.xdrive-workspace-measured .xdrive-operational-table')).toBe(true);
      rule.walkDecls((declaration) => { expect(Boolean(declaration.important)).toBe(false); });
    });
    expect(read('app/super-admin/layout.tsx')).not.toContain('xdrive-workspace-measured');
  });
});