import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(f:string)=>readFileSync(f,'utf8');

describe('3150 exact Loads visual semantics with real role workflows',()=>{
 const company=read('app/components/workspace/CompanyMarketplaceExchange.tsx');
 const driver=read('app/driver/loads/page.tsx');
 const css=read('app/components/workspace/master3150-unified-loads.css');
 it('places original navigation tabs before filter and card columns in Company workspace',()=>{
  const nav=company.indexOf('aria-label="3150 Loads primary tabs"');
  const rail=company.indexOf('className="carrier-exchange-rail"');
  expect(nav).toBeGreaterThan(0);
  expect(nav).toBeLessThan(rail);
  for(const title of ['All Loads','On Demand','Same Day','Next Day','My Loads']){
   expect(company).toContain(title);
  }
  expect(company).toContain('selectMasterLoadsTab(item.id)');
  expect(company).toContain("dateFrom: next === 'same_day' || next === 'next_day'");
  expect(company).toContain("dateTo: next === 'same_day' || next === 'next_day'");
 });
 it('preserves advanced real Company exchange options behind service dropdown',()=>{
  expect(company).toContain('master3150-loads-service-selector');
  expect(company).toContain('regular_load');
  expect(company).toContain('daily_hire');
  expect(company).toContain('MarketplaceLoadMap');
  expect(company).toContain('openQuote(load)');
  expect(company).toContain('Search Loads Results');
 });
 it('Driver has approved top tabs, compact statistics without removal and live card actions',()=>{
  const nav=driver.indexOf('aria-label="3150 Loads primary tabs"');
  const rail=driver.indexOf('className="pagebody"');
  expect(nav).toBeGreaterThan(0);
  expect(nav).toBeLessThan(rail);
  expect(driver).toContain('master3150-driver-load-stats');
  expect(driver).toContain('<summary>Live exchange statistics</summary>');
  for(const title of ['All Loads','On Demand','Same Day','Next Day','My Loads']){
   expect(driver).toContain(title);
  }
  expect(driver).toContain("setMasterLoadsTab('all')");
  expect(driver).toContain('ApprovedDriverLoadCard');
  expect(driver).toContain('MarketplaceLoadMap');
  expect(driver).toContain('usePublicPickupRadius');
  expect(driver).toContain('pickupRadius.withinRadius');
  expect(driver).toContain('pickupRadiusMiles');
  expect(driver).toContain("['5','10','20','30','50','100','200','300']");
 });
 it('uses the shared approved 3150 spacing and preserves responsive behaviour',()=>{
  expect(css).toContain('--master-loads-card-height:174px');
  expect(css).toContain('--master-loads-rail:220px');
  expect(css).toContain('master3150-driver-load-stats');
  expect(css).toContain('.master3150-loads-primary-tabs');
  expect(css).toContain('@media(max-width:720px)');
 });
});
