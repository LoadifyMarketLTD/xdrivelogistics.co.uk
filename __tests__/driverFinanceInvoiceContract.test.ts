import { readFileSync } from 'fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InvoiceProStatusTabs } from '../app/components/workspace/InvoiceProMasterFrame';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

describe('driver finance invoice contract', () => {
  it('uses the live numeric late-fee and canonical VAT/job authority contract', () => {
    const route = readRepoFile('app/api/driver/finance/invoices/route.ts');

    expect(route).toContain('late_fee: 0');
    expect(route).not.toContain("late_fee: typeof late_fee === 'string'");
    expect(route).toContain('vatRegistered ? requestedVatRate : 0');
    expect(route).toContain(".from('companies')");
    expect(route).toContain(".from('jobs')");
    expect(route).toContain('Your company is not a party to the related job.');
    expect(route).toContain('An active company is required to create invoices.');
  });

  it('keeps a single full-width invoice lifecycle filter row without duplicate payment tabs', () => {
    const page = readRepoFile('app/driver/finance/page.tsx');
    const css = readRepoFile('app/components/workspace/InvoiceProFinance.module.css');

    // The approved Invoice Pro uses a shared semantic status strip, not the legacy page-local markup.
    const markup = renderToStaticMarkup(createElement(InvoiceProStatusTabs, {
      tabs: [{ id: 'all', label: 'All', active: true, onSelect: () => {} },
             { id: 'draft', label: 'Draft', active: false, onSelect: () => {} }],
    }));
    expect(page.match(/<InvoiceProStatusTabs\b/g)).toHaveLength(1);
    expect(markup).toContain('role="tablist"');
    expect(markup).toContain('aria-label="Invoice states"');
    expect(markup.match(/role="tab"/g)).toHaveLength(2);
    expect(markup).toContain('aria-selected="true"');
    expect(page).not.toContain('aria-label="Payment states"');
    expect(page).not.toContain('PAYMENT_TABS');
    expect(page).not.toContain('paymentTab');
    expect(css).toMatch(/\.tabStrip\{display:flex;overflow:auto;/);
  });
});
