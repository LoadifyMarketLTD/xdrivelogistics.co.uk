import fs from 'node:fs';
import path from 'node:path';
import { isRoleAllowedForPath } from '../lib/authRole';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('CX carrier Exchange Quotes navigation contract', () => {
  const shell = read('app/components/workspace/TopWorkspaceShell.tsx');
  const workspaceRole = read('lib/workspaceRole.ts');
  const exchangeQuotesPage = read('app/admin/exchange-quotes/page.tsx');
  const marketplace = read('app/components/workspace/CompanyMarketplaceExchange.tsx');

  it('maps the primary carrier Quotes navigation to marketplace bid lifecycle', () => {
    expect(workspaceRole).toContain("href: '/admin/exchange-quotes'");
    expect(shell).toContain("['carrier-quotes', 'Quotes', '/admin/exchange-quotes']");
    expect(exchangeQuotesPage).toContain('initialTab="bids"');
    expect(marketplace).toContain("initialTab = 'loads'");
    expect(marketplace).toContain("useState<'loads' | 'bids' | 'won'>(initialTab)");
  });

  it('keeps the separate customer quote workflow discoverable instead of deleting it', () => {
    expect(shell).toContain("label: 'Customer Quotes'");
    expect(shell).toContain("href: customerQuotesHref");
    expect(shell).toContain("const customerQuotesHref = '/admin/quotes';");
  });

  it('authorises the dedicated carrier exchange quote route for a company owner', () => {
    expect(isRoleAllowedForPath('/admin/exchange-quotes', 'company_admin', { workspaceRole: 'company_owner' })).toBe(true);
  });
});
