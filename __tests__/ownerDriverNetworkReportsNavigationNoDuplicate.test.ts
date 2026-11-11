import fs from 'node:fs';import path from 'node:path';
import {describe,expect,it} from 'vitest';
import {masterNavigationHref} from '../lib/masterWorkspaceNavigation';
const read=(p:string)=>fs.readFileSync(path.join(process.cwd(),p),'utf8');
describe('Owner Driver Network and Reports real destinations',()=>{
 it('has a distinct, authenticated Network & Tools hub rather than redirecting to Directory',()=>{
  const page=read('app/driver/network/page.tsx');
  expect(page).toContain('Network &amp; Tools');
  expect(page).toContain('<ProtectedRoute');
  expect(page).toContain("href:'/driver/loads'");
  expect(page).toContain("href:'/driver/directory'");
  expect(page).toContain("href:'/driver/returns'");
  expect(page).not.toContain("redirect('/driver/directory')");
 });
 it('enables existing authenticated Reports page only for the authorised Owner Driver role',()=>{
  expect(masterNavigationHref('Owner Driver',16)).toBe('/driver/reports');
  expect(masterNavigationHref('Company Driver',16)).toBeNull();
  const reports=read('app/driver/reports/page.tsx');
  expect(reports).toContain('<ProtectedRoute');
  expect(reports).toContain('<MemberOperationalReports');
 });
 it('does not alter approved Post Load or PWA navigation',()=>{
  const route=read('app/admin/post-load/page.tsx');
  expect(route).toContain('<LoadPostingForm mode="admin" />');
 });
});
