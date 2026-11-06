import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const read=(file:string)=>readFileSync(join(process.cwd(),file),'utf8');

describe('exact approved 3150 geometry with preserved authenticated execution',()=>{
 const demoLoads=read('app/try-xdrive-demo/components/xdrive-unified-board.css');
 const demoDiary=read('app/try-xdrive-demo/xdrive-design-system.css');
 const demoFleet=read('app/try-xdrive-demo/components/demo-fleet-board.css');
 const demoDrivers=read('app/try-xdrive-demo/components/demo-drivers-board.css');
 const live=read('app/components/workspace/master3150-live-operations.css');
 const card=read('app/components/workspace/master3150-record-card.css');

 it('uses exact approved 3150 Load and Quote rail and card dimensions',()=>{
   expect(demoLoads).toContain('grid-template-columns:220px minmax(0,1fr);gap:18px');
   expect(live).toContain('grid-template-columns:220px minmax(0,1fr);');
   expect(card).toContain('grid-template-columns:110px minmax(0,1fr) 230px !important');
   expect(demoLoads).toContain('min-height:174px');
   expect(card).toContain('min-height:174px');
 });

 it('uses the exact 3150 Diary dimensions in desktop and tablet layouts',()=>{
   expect(demoDiary).toContain('.demo-shell .xd-diary-v2 .xd-diary-layout{grid-template-columns:235px minmax(0,1fr);gap:18px}');
   expect(live).toContain('grid-template-columns:235px minmax(0,1fr);');
   expect(live).toContain('grid-template-columns:200px minmax(0,1fr);');
   expect(demoDiary).toContain('min-height:92px');
   expect(live).toContain('min-height:92px');
   expect(demoDiary).toContain('gap:14px');
   expect(live).toContain('gap:14px');
 });

 it('retains exact My Fleet and Drivers board components rather than approximate copies',()=>{
   expect(demoFleet).toContain('.xd-fleet-layout{display:grid;grid-template-columns:220px minmax(0,1fr);gap:14px}');
   expect(demoDrivers).toContain('.xd-drivers-layout{display:grid;grid-template-columns:220px minmax(0,1fr);gap:14px}');
   const overview=read('app/components/workspace/MemberFleetOverview.tsx');
   expect(overview).toContain('<DemoFleetBoard');
   expect(overview).toContain('<DemoDriversBoard');
 });

 it('preserves real job allocation and vehicle assignment with permissions and evidence',()=>{
   const diary=read('app/components/workspace/OperationsDiaryPage.tsx');
   const driver=read('app/driver/history/page.tsx');
   expect(diary).toContain('const assignDriver = async');
   expect(diary).toContain('canManageCompanyBookings');
   expect(diary).toContain('CompanyJobSheetPanel');
   expect(diary).toContain('driverSelections');
   expect(diary).toContain('assigned_driver_id');
   expect(driver).toContain('DriverInvoicePreviewModal');
   expect(driver).toContain('hasCompletePodEvidence');
   expect(driver).toContain('detailTab');
   expect(driver).toContain('documents');
   expect(driver).toContain('status_history');
 });

 it('retains verified quote, award, invoice, message and access workflows without demo substitutions',()=>{
   const carrier=read('app/components/workspace/CompanyMarketplaceExchange.tsx');
   const customer=read('app/customer/quotes/CustomerQuotesCxPage.tsx');
   expect(carrier).toContain('submit_bid');
   expect(customer).toContain('bookingPaymentObligationRequestBody');
   expect(customer).toContain('sendBidMessage');
   expect(customer).toContain('/api/customer/bids/');
   expect(read('app/api/workspace/fleet-overview/route.ts')).toContain('canReadDocuments');
   expect(live).not.toContain('demoExchange');
 });
});
