import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
const read=(p:string)=>fs.readFileSync(path.join(process.cwd(),p),'utf8');
describe('approved 3150 live board integration preserves operational controllers',()=>{
 it('shares the 3150 card and page presentation without substituting demo backend',()=>{
  const card=read('app/components/workspace/Master3150Card.tsx');
  const css=read('app/components/workspace/master3150-live-operations.css');
  expect(card).toContain("import './master3150-live-operations.css'");
  expect(card).toContain('<i aria-hidden="true">→</i>');
  for(const driverBoard of ['.driver-loads-prototype','.driver-quotes-prototype','.driver-diary-board'])expect(css).toContain(driverBoard);
  for(const selector of ['.workspace-board-layout.xdrive-admin-marketplace-identity','.xdrive-loads-workspace-layout','.workspace-filter-rail__body','.workspace-tab-strip','.master3150-record.xd-board-card'])expect(css).toContain(selector);
  expect(css).not.toMatch(/url\(https?:\/\//);
  for(const file of ['app/components/workspace/CxLoadCard.tsx','app/components/workspace/CxQuoteCard.tsx','app/components/workspace/CxDiaryCard.tsx'])
   expect(read(file)).toContain('Master3150Card');
  for(const file of ['app/admin/marketplace/page.tsx','app/admin/exchange/page.tsx','app/admin/diary/page.tsx','app/broker/loads/page.tsx','app/broker/bids/page.tsx','app/broker/diary/page.tsx','app/customer/loads/page.tsx','app/customer/quotes/page.tsx','app/customer/diary/page.tsx','app/driver/loads/page.tsx','app/driver/quotes/page.tsx','app/driver/history/page.tsx']){
   const source=read(file);
   expect(source,file).not.toContain('DemoExchangeBoard');
   expect(source,file).not.toContain('DemoCompanyQuotes');
   expect(source,file).not.toContain('DemoBookingOverview');
  }
 });
 it('preserves live company marketplace quote and filter behaviour',()=>{
  const live=read('app/components/workspace/CompanyMarketplaceExchange.tsx');
  for(const value of ["'/api/marketplace/company'","action: 'submit_bid'","action: 'withdraw_bid'","updateQuoteLifecycle","<CxLoadCard","<CxQuoteCard","<MarketplaceLoadMap"])expect(live).toContain(value);
 });
 it('preserves customer award, legal acknowledgement, diary replay and live messaging',()=>{
  const quotes=read('app/customer/quotes/CustomerQuotesCxPage.tsx');
  for(const value of ["'/api/workspace/bids/identities'","/api/customer/bids/","bookingPaymentObligationRequestBody","<CxQuoteCard","sendBidMessage"])expect(quotes).toContain(value);
  const diary=read('app/customer/diary/page.tsx');
  for(const value of ["classifyWorkspaceJobStage","/job-replay/","<CxDiaryCard"])expect(diary).toContain(value);
 });
 it('preserves driver quotes and history, invoices, POD and live bids',()=>{
  const loads=read('app/driver/loads/page.tsx');
  expect(loads).toContain("'/api/driver/marketplace/loads'");
  expect(loads).toContain("'/api/driver/bids'");
  const quotes=read('app/driver/quotes/page.tsx');
  expect(quotes).toContain('updateQuoteLifecycle');
  const history=read('app/driver/history/page.tsx');
  expect(history).toContain('DriverInvoicePreviewModal');
  expect(history).toContain('getCanonicalDiaryTabs');
 });
 it('preserves actual booking assignment and diary workflow',()=>{
  const diary=read('app/components/workspace/OperationsDiaryPage.tsx');
  for(const value of ["assignDriver","cancelJob","saveFeedback","<CxDiaryCard"])expect(diary).toContain(value);
 });
});
