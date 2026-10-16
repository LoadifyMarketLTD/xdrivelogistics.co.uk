import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('Customer operational visual hierarchy', () => {
  const quotes = read('app/customer/quotes/CustomerQuotesCxPage.tsx');
  const customerCss = read('app/customer/customer-dashboard.css');

  it('keeps Quotes on the shared operational board with the canonical CX-style filter rail', () => {
    expect(quotes).toContain('className="workspace-board-layout"');
    expect(quotes).toContain('className="workspace-filter-rail"');
    expect(quotes).toContain('aria-label="Quote filters"');
    expect(quotes).toContain('className="workspace-board-main"');
    expect(quotes).not.toContain('title="Quote filters"');
  });

  it('uses the same vertical Customer filter rail geometry as the other operational workspaces', () => {
    expect(customerCss).toContain('.xdrive-customer-workspace .workspace-board-layout');
    expect(customerCss).toContain('grid-template-columns: var(--ws-filter-rail-w, 165px) minmax(0, 1fr) !important');
    expect(customerCss).toContain('.workspace-board-layout > .workspace-filter-rail');
    expect(customerCss).toContain('width: var(--ws-filter-rail-w, 165px) !important');
  });

  it('keeps operational registers visually enclosed as cards', () => {
    expect(customerCss).toContain('.xdrive-customer-workspace .workspace-panel');
    expect(customerCss).toContain('border: 1px solid var(--ws-border) !important');
    expect(customerCss).toContain('background: #fff !important');
  });
});
