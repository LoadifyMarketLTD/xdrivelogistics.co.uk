import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(p:string)=>readFileSync(p,'utf8');
describe('Broker 3150 awards compatibility route',()=>{
 it('preserves canonical 3150 Master visual shell without independent 3118 sidebar',()=>{
  const layout=read('app/broker/layout.tsx');
  expect(layout).toContain('Broker3150LayoutGate');
  expect(layout).not.toContain('Broker3118Shell');
 });
 it('deep links Awards to actual awarded bookings filter rather than All',()=>{
  expect(read('app/broker/awards/page.tsx')).toContain("redirect('/broker/jobs?view=awarded')");
  expect(read('app/broker/jobs/page.tsx')).toContain("searchParams.get('view') === 'awarded' ? 'awarded' : 'all'");
 });
 it('preserves canonical awarded job lifecycle and shared auth data',()=>{
  const jobs=read('app/broker/jobs/page.tsx');
  expect(jobs).toContain("if (tab === 'awarded') return stage === 'awarded' || stage === 'allocated'");
  expect(jobs).toContain('useCompanyWorkspaceData');
 });
});