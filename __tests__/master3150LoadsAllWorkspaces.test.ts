import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {MASTER_AUTHENTICATED_ROUTES,masterNavigationHref} from '../lib/masterWorkspaceNavigation';

const read=(p:string)=>readFileSync(p,'utf8');

describe('WORKSPACE 3510: canonical Loads for all authorised workspace roles',()=>{
 it('maps every allowed Loads role to its actual authenticated route',()=>{
  const expected=[
   ['Company / Carrier','/admin/marketplace'],
   ['Broker','/broker/loads'],
   ['Customer','/customer/loads'],
   ['Fleet','/admin/marketplace'],
   ['Owner Driver','/driver/loads'],
   ['Company Driver','/driver/loads'],
   ['Dispatcher','/admin/marketplace'],
  ] as const;
  expect(expected).toHaveLength(7);
  for(const [role,route] of expected){
   expect(role in MASTER_AUTHENTICATED_ROUTES).toBe(true);
   expect(masterNavigationHref(role,2)).toBe(route);
  }
 });
 it('preserves exact approved 3150 original on Customer and no mock backend',()=>{
  const customer=read('app/customer/loads/page.tsx');
  expect(customer).toContain('<DemoExchangeBoard role="Customer" productionMode />');
  expect(customer).toContain('<Company3150LiveProvider publicLocations>');
 });
 it('uses unified 3150 load presentation for carrier, broker, dispatcher, fleet, and both driver roles',()=>{
  const company=read('app/components/workspace/CompanyMarketplaceExchange.tsx');
  const broker=read('app/broker/loads/page.tsx');
  const driver=read('app/driver/loads/page.tsx');
  for(const source of [company,broker,driver]){
   expect(source).toContain('master3150-unified-loads.css');
   expect(source).toContain('master3150-unified-loads');
  }
  expect(company).toContain('<CxLoadCard');
  expect(broker).toContain('<CxLoadCard');
  expect(driver).toContain('<ApprovedDriverLoadCard');
  expect(read('app/components/workspace/CxLoadCard.tsx')).toContain('Master3150Card');
  expect(read('app/driver/_components/ApprovedDriverOperationalCard.tsx')).toContain('Master3150Card');
 });
 it('keeps role-specific live API / quote / award / privacy mechanics without demo action replacement',()=>{
  const company=read('app/components/workspace/CompanyMarketplaceExchange.tsx');
  const broker=read('app/broker/loads/page.tsx');
  const driver=read('app/driver/loads/page.tsx');
  expect(company).toContain('MarketplaceQuoteNowDialog');
  expect(company).toContain('MarketplaceLoadMap');
  expect(broker).toContain('useCompanyWorkspaceData');
  expect(broker).toContain('Quotes & award');
  expect(driver).toContain('MarketplaceQuoteModal');
  expect(driver).toContain('MarketplaceLoadMap');
  for(const source of [company,broker,driver]){
   expect(source).not.toContain('publishDemoLoad(');
   expect(source).not.toContain('submitDemoQuote(');
  }
 });
 it('design system keeps exact reference geometry and mobile layout',()=>{
  const css=read('app/components/workspace/master3150-unified-loads.css');
  expect(css).toContain('--master-loads-rail:220px');
  expect(css).toContain('--master-loads-gap:18px');
  expect(css).toContain('--master-loads-card-height:174px');
  expect(css).toContain('@media(max-width:720px)');
 });
});
