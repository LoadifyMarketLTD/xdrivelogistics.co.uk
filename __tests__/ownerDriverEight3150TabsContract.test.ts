import fs from 'node:fs';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');
const prefix='app/driver/';
const tabs=[['Dashboard','page.tsx'],['Post Load','post-load/page.tsx'],['Loads','loads/page.tsx'],['Quotes','quotes/page.tsx'],['Bookings','jobs/page.tsx'],['My Fleet','fleet/page.tsx'],['Drivers','drivers/page.tsx'],['Diary','history/page.tsx']] as const;
describe('Eight approved 3150 Owner Driver tab integration gates',()=>{
 it('preserves the eight exact 3150 Master routes',()=>{
  const nav=read('lib/masterWorkspaceNavigation.ts');
  for(const [label,file] of tabs)expect(read(prefix+file).length,label).toBeGreaterThan(50);
  for(const route of ['/driver','/driver/post-load','/driver/loads','/driver/quotes','/driver/jobs','/driver/fleet','/driver/drivers','/driver/history'])expect(nav).toContain(route);
 });
 it('Post Load renders the real 3150 form with no duplicate Driver shell',()=>{
  const content=read(prefix+'post-load/page.tsx');
  expect(content).toContain('<LoadPostingForm mode="owner" />');
  expect(content).not.toContain('<DriverWorkspaceShell');
  expect(read('app/components/workspace/LoadPostingForm.tsx')).toContain('xdrive-approved-postload-3150');
 });
 it('Fleet and Drivers use original 3150 boards with a company-scoped API, not demo records',()=>{
  const fleet=read('app/components/workspace/MemberFleetOverview.tsx');
  expect(fleet).toContain('/api/workspace/fleet-overview?companyId=');
  expect(fleet).toContain('<DemoFleetBoard');
  expect(fleet).toContain('<DemoDriversBoard');
  expect(fleet).toContain('body?.companyId!==companyId');
 });
 it('Dashboard and operational card wrappers use canonical Master 3150 originals',()=>{
  expect(read(prefix+'page.tsx')).toContain('OwnerDriver3150LiveDashboard');
  expect(read(prefix+'_components/ApprovedDriverOperationalCard.tsx')).toContain('Master3150Card');
  expect(read(prefix+'_components/ApprovedDriverLoadCard.tsx')).toContain('CxLoadCard');
  expect(read(prefix+'_components/ApprovedDriverQuoteCard.tsx')).toContain('CxQuoteCard');
  expect(read(prefix+'history/ApprovedDriverDiaryCard.tsx')).toContain('CxDiaryCard');
  expect(read(prefix+'jobs/page.tsx')).toContain('return <CxDiaryCard');
  expect(read('app/components/workspace/CxLoadCard.tsx')).toContain('Master3150Card');
  expect(read('app/components/workspace/CxQuoteCard.tsx')).toContain('Master3150Card');
  expect(read('app/components/workspace/CxDiaryCard.tsx')).toContain('Master3150Card');
 });
});