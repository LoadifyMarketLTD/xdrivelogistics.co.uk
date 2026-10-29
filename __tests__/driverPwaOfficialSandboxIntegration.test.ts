import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const source=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
describe('Official XDrive Driver PWA - approved sandbox integration',()=>{
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
 it('scrolls the Driver Loads page instead of dragging Leaflet across the world',()=>{
  expect(source('app/driver-pwa-fresh/jobs/LoadsClient.tsx')).toContain('allowTouchDrag={false}');
  expect(source('app/driver-pwa-fresh/visual-standard.css')).toContain('touch-action:pan-y!important');
  expect(source('app/components/workspace/MarketplaceLoadMap.tsx')).toContain('allowTouchDrag = true');
 });
 it('uses route-based bottom tab selection rather than early pointer state',()=>{
  const nav=source('app/driver-pwa-fresh/FreshNavigation.tsx');
  expect(nav).not.toContain('onPointerDown={()=>setSelected');
  expect(nav).toContain("pathname.startsWith('/driver-pwa-fresh/bookings')");
 });
});
