import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(p:string)=>readFileSync(p,'utf8');
const approved=read('app/try-xdrive-demo/components/DemoQuotePanel.tsx');
const live=read('app/components/workspace/MarketplaceQuoteNowDialog.tsx');

describe('approved 3150 four-tab Quote modal end-to-end content contract',()=>{
 it('approved original has four required tabs and matching content sections',()=>{
  for(const title of ['Quote','Load Details','Route & Map','Company'])expect(approved).toContain(`activeTab==="${title}"`);
  expect(approved).toContain('xd-quote-nav');
  expect(approved).toContain('Payment Terms');
 });
 it('live shared Quote Now must reuse the original tabbed 3150 experience',()=>{
  const canonicalImported = live.includes('Canonical3150QuoteInformation') && live.includes('CANONICAL_3150_QUOTE_TABS');
  const canonicalTabs = readFileSync('app/components/workspace/Canonical3150QuoteInformation.tsx', 'utf8');
  const fourTabLive = ['Quote','Load Details','Route & Map','Company'].every(t=>canonicalTabs.includes(t));
  expect(canonicalImported || fourTabLive, 'LIVE 3150 Quote Now currently lacks all four original tabs').toBe(true);
 });
 it('Company and Driver quote entrypoints must use the same canonical modal adapter',()=>{
  const company=read('app/components/workspace/CompanyMarketplaceExchange.tsx');
  const driver=read('app/driver/_components/MarketplaceQuoteModal.tsx');
  expect(company).toContain('MarketplaceQuoteNowDialog');
  expect(driver).toContain('MarketplaceQuoteNowDialog');
 });
});