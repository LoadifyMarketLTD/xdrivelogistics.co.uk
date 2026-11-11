import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {MASTER_AUTHENTICATED_ROUTES} from '../lib/masterWorkspaceNavigation';
const read=(path:string)=>readFileSync(path,'utf8');

describe('Approved two Driver role Master Workspace navigation',()=>{
 it('uses Company Driver restricted menu for every non-owner driver account, even legacy generic driver metadata',()=>{
  const layout=read('app/driver/DriverMasterLayoutGate.tsx');
  const home=read('app/driver/page.tsx');
  expect(layout).toContain("const role=workspace==='owner_driver'?'Owner Driver':'Company Driver';");
  expect(home).toContain("const role = workspace === 'owner_driver' ? 'Owner Driver' : 'Company Driver';");
  expect(layout).not.toContain("?'Company Driver':'Driver'");
  expect(home).not.toContain("? 'Company Driver' : 'Driver'");
 });
 it('retains owner driver My Fleet administration route and removes it from company drivers',()=>{
  expect(MASTER_AUTHENTICATED_ROUTES['Owner Driver'][5]).toBe('/driver/fleet');
  expect(MASTER_AUTHENTICATED_ROUTES['Company Driver'][5]).toBeNull();
  expect(MASTER_AUTHENTICATED_ROUTES['Company Driver'][6]).toBeNull();
  expect(MASTER_AUTHENTICATED_ROUTES['Company Driver'][3]).toBe('/driver/quotes');
 });
 it('preserves one approved visual shell and protected fleet backend',()=>{
  expect(read('app/driver/DriverMasterLayoutGate.tsx')).toContain('role={role} authenticated');
  expect(read('app/driver/fleet/page.tsx')).toContain('canManage={canManage}');
  expect(read('app/driver/fleet/page.tsx')).toContain("manageHref={canManage ? '/driver/vehicles' : undefined}");
 });
});