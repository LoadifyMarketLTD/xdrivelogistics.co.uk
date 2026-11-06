import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {resolveWorkspaceDataQueryPlan} from '../app/components/workspace/useCompanyWorkspaceData';

const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
const page=read('app/broker/diary/page.tsx');
const css=read('app/components/workspace/broker-3150-diary.css');

describe('Broker Diary is canonical 3150, powered by authorised real operations',()=>{
 it('renders title, day navigation, nine tab counts, then real KPIs and find bookings rail',()=>{
  const header=page.indexOf('<header className="xd3150-diary-header">');
  const tabs=page.indexOf('<div className="xd3150-diary-status-tabs"');
  const kpis=page.indexOf('<Master3150OperationsKpis');
  const rail=page.indexOf('className="workspace-filter-rail cx-diary-filter-rail xd3150-diary-rail"');
  expect(header).toBeGreaterThan(0);expect(tabs).toBeGreaterThan(header);expect(kpis).toBeGreaterThan(tabs);expect(rail).toBeGreaterThan(kpis);
  expect(page).toContain("tabCount(item.id)");
  expect(page).toContain("setDate(new Date().toISOString().slice(0, 10))");
  expect(page).toContain("onClick={() => changeDay(-1)}");
  for(const label of ['From (Town/Postcode)','To (Town/Postcode)','Any Driver','Any Vehicle','Status<select','Search Diary'])expect(page).toContain(label);
 });
 it('uses 3150 exact width and card geometry with working mobile layout',()=>{
  expect(css).toContain('grid-template-columns:235px minmax(0,1fr)');
  expect(css).toContain('gap:18px');
  expect(css).toContain('min-height:40px');
  expect(css).toContain('@media(max-width:780px)');
  expect(read('app/components/workspace/master3150-record-card.css')).toContain('grid-template-columns:110px minmax(0,1fr) 230px !important');
 });
 it('opens real job-sheet View Details without substituting illustrative demo records',()=>{
  expect(page).toContain('onClick={() => setSelectedDetailsJobId(job.id)}>View Details');
  expect(page).toContain('<CompanyJobSheetPanel jobId={selectedDetailsJobId} mode="broker" initialTab="agreement" />');
  expect(page).toContain('ariaLabel="Verified 3150 transport details"');
  expect(page).not.toContain('DemoTransportDetails');
  expect(page).not.toContain('submitDemo');
 });
 it('fetches real company-scoped drivers and vehicles for Broker filters',()=>{
  const plan=resolveWorkspaceDataQueryPlan({pathname:'/broker/diary',workspaceRole:'broker'});
  expect(plan.datasets).toContain('drivers');
  expect(plan.datasets).toContain('vehicles');
  expect(plan.datasets).toContain('jobs');
  expect(plan.datasets).toContain('bids');
  const source=read('app/components/workspace/useCompanyWorkspaceData.ts');
  expect(source).toContain(".from('drivers')");
  expect(source).toContain(".from('vehicles')");
  expect(source).toContain(".eq('company_id', companyId)");
 });
 it('retains real operations even if secondary controls move under More actions',()=>{
  expect(page).toContain('<CxDiaryActions');
  expect(page).toContain("DIARY_JOB_SHEET_TABS[actionTab]");
  expect(page).toContain('saveFeedback()');
  expect(page).toContain('/job-replay/');
  expect(page).toContain('data.refresh()');
  expect(page).toContain('setPageSize(Number(event.target.value))');
  expect(page).toContain('setViewMode(\'calendar\')');
  expect(page).toContain("job.assigned_driver_id === driverFilter");
  expect(page).toContain("job.vehicle_id === vehicleFilter");
 });
});