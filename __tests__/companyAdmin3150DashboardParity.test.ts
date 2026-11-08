import fs from 'node:fs';
import path from 'node:path';
import {describe,expect,it} from 'vitest';
const source=(p:string)=>fs.readFileSync(path.join(process.cwd(),p),'utf8');
const content=source('app/components/workspace/CompanyMasterDashboard.tsx');
describe('Company Admin 3150 dashboard visual parity',()=>{
 it('uses exactly the same approved 3150 visual source as Owner Driver',()=>{
  expect(content).toContain('import DemoCompanyDashboard');
  expect(content).toContain('<DemoCompanyDashboard workspaceLabel={role}');
  expect(source('app/driver/_components/OwnerDriver3150LiveDashboard.tsx')).toContain('<DemoCompanyDashboard');
  expect(content).not.toContain('<Master3150DashboardLayout');
 });
 it('does not introduce preview records and only reads the company-authenticated dataset',()=>{
  expect(content).toContain('useCompany3150Live()');
  expect(content).toContain('data?.jobs??[]');
  expect(content).toContain('data?.vehicles??[]');
  expect(content).toContain('data?.drivers??[]');
  expect(content).toContain('classifyWorkspaceJobStage(job)');
  expect(content).not.toContain('demoExchange');
 });
 it('keeps role-specific navigation and refuses fabricated invoice totals',()=>{
  expect(content).toContain('masterNavigationHref(role,tab)');
  expect(content).toContain('verifiedOutstanding={verifiedOutstanding}');
  expect(content).toContain(':null;');
  expect(content).toContain("'/admin/jobs/'");
 });
});