import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';

describe('Customer Loads 3150 radius and rapid sidebar reset',()=>{
 const board=readFileSync('app/try-xdrive-demo/components/DemoExchangeBoard.tsx','utf8');
 const shell=readFileSync('app/components/workspace/AuthenticatedMasterShell.tsx','utf8');
 it('supports the requested 200 and 300 mile options in addition to existing ranges',()=>{
  expect(board).toContain('["5","10","20","30","50","100","200","300"]');
  expect(board).toContain('pickupRadius.withinRadius(x.from,Number(radius))');
 });
 it('resets all local filters and display settings to the approved initial state',()=>{
  for(const statement of ['setFrom("")','setTo("")','setRadius("10")','setVehicle("")','setService("")','setDate("")','setSame(false)','setNext(false)','setTab("All Loads")','setSort("new")','setPage(1)','setMap(false)','setDetails(null)','setQuoteLoad(null)']){
   expect(board).toContain(statement);
  }
 });
 it('reselects Loads immediately without redundant navigation or network refresh',()=>{
  expect(shell).toContain('index===2&&pathname===target');
  expect(shell).toContain("window.dispatchEvent(new Event('xdrive:loads-reselect'))");
  expect(board).toContain('window.addEventListener("xdrive:loads-reselect",onLoadsReselect)');
  expect(board).toContain('window.removeEventListener("xdrive:loads-reselect",onLoadsReselect)');
  expect(shell).toContain('router.push(target)');
 });
 it('preserves the approved 3150 preview and changes only production reset',()=>{
  expect(board).toContain('if(!productionMode)return');
  expect(readFileSync('app/customer/loads/page.tsx','utf8')).toContain('<DemoExchangeBoard role="Customer" productionMode />');
 });
});
