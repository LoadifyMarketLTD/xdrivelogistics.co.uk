import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('Customer operational visual hierarchy', () => {
  const quotes = read('app/customer/quotes/CustomerQuotesCxPage.tsx');
  const customerCss = read('app/customer/customer-dashboard.css');

  it('keeps Quotes as a full-width operational card stack rather than a detached side rail', () => {
    expect(quotes).toContain('<OperationalCard');
    expect(quotes).toContain('title="Quote filters"');
    expect(quotes).toContain("display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))'");
    expect(quotes).not.toContain('aria-label="Customer quote filters"');
  });

  it('promotes legacy Customer filter rails into horizontal full-width filter cards', () => {
    expect(customerCss).toContain('.xdrive-customer-workspace .workspace-board-layout');
    expect(customerCss).toContain('grid-template-columns: minmax(0, 1fr) !important');
    expect(customerCss).toContain('.workspace-board-layout > .workspace-filter-rail');
    expect(customerCss).toContain('grid-template-columns: 148px minmax(0, 1fr) !important');
  });

  it('keeps operational registers visually enclosed as cards', () => {
    expect(customerCss).toContain('.xdrive-customer-workspace .workspace-panel');
    expect(customerCss).toContain('border: 1px solid var(--ws-border) !important');
    expect(customerCss).toContain('background: #fff !important');
  });
});
