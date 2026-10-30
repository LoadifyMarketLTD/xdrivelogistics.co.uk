import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const source=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
describe('Official XDrive Driver PWA - approved sandbox integration',()=>{
 it('installs as the real Driver PWA with Loads as its entry route',()=>{
  expect(source('app/driver-pwa-fresh/manifest.webmanifest/route.ts')).toContain("start_url: '/driver-pwa-fresh/jobs'");
  expect(source('app/driver-pwa-fresh/page.tsx')).toContain("redirect('/driver-pwa-fresh/jobs')");
  expect(source('app/driver-pwa-fresh/DriverServiceWorkerRegistration.tsx')).toContain("scope: '/driver-pwa-fresh/'");
  expect(source('app/driver/MobileDriverWorkspaceRedirect.tsx')).toContain("router.replace('/driver-pwa-fresh/jobs')");
  expect(source('app/login/page.tsx')).toContain("safeNextPath?.startsWith('/driver-pwa-fresh/')");
 });
 it('keeps real Booking and POD stages inside the approved visual shell',()=>{
  expect(source('app/driver-pwa-fresh/layout.tsx')).toContain("import './booking-approved.css'");
  expect(source('app/driver-pwa-fresh/bookings/[id]/page.tsx')).toContain('DriverJobExecutionPage');
  expect(source('app/driver-pwa-fresh/bookings/[id]/pod/page.tsx')).toContain('DriverJobExecutionPage');
  expect(source('app/driver-pwa-fresh/bookings/[id]/pod/page.tsx')).toContain('<FreshBottom active="bookings"/>');
 });
 it('keeps job details distinct from Loads tab navigation',()=>{
  const details=source('app/driver-pwa-fresh/jobs/[id]/page.tsx');
  expect(details).not.toContain('FreshSectionTabs');
  expect(details).toContain('data-testid="load-details"');
 });
 it('allows deliberate touch drag on the Loads Map while keeping mobile viewport bounded',()=>{
  const loads=source('app/driver-pwa-fresh/jobs/LoadsClient.tsx');
  expect(loads).toContain('allowTouchDrag={true}');
  expect(loads).toContain('place(load.pickup_area,load.pickup_postcode_area)');
  expect(loads).toContain('place(load.delivery_area,load.delivery_postcode_area)');
  expect(source('app/driver-pwa-fresh/visual-standard.css')).toContain('touch-action:none!important');
  expect(source('app/components/workspace/MarketplaceLoadMap.tsx')).toContain('allowTouchDrag = true');
 });
 it('uses route-based bottom tab selection rather than early pointer state',()=>{
  const nav=source('app/driver-pwa-fresh/FreshNavigation.tsx');
  expect(nav).not.toContain('onPointerDown={()=>setSelected');
  expect(nav).toContain("pathname.startsWith('/driver-pwa-fresh/bookings')");
 });
});
