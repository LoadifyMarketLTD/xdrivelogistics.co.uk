import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const route = readFileSync(join(root, 'app/customer/quotes/page.tsx'), 'utf8');
const canonical = readFileSync(join(root, 'app/customer/quotes/CustomerQuotesCxPage.tsx'), 'utf8');
const modules = readFileSync(join(root, 'app/customer/CustomerWorkspaceModules.tsx'), 'utf8');
const operational = readFileSync(join(root, 'app/customer/CustomerOperationalPages.tsx'), 'utf8');

describe('Customer canonical Quotes surface', () => {
  it('routes Quotes through one canonical implementation', () => {
    expect(route).toContain("import CustomerQuotesCxPage from './CustomerQuotesCxPage'");
    expect(route).toContain('<CustomerQuotesCxPage />');
    expect(canonical).toContain('Review & Send Offer');
  });

  it('does not keep competing dead Quotes implementations', () => {
    expect(modules).not.toContain('export function CustomerQuotesPage');
    expect(operational).not.toContain('export function CustomerQuotesOperationalPage');
  });
});
