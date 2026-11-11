import fs from 'node:fs';
import path from 'node:path';
import {describe,expect,it} from 'vitest';
import {canonicalQuoteStage,isTerminalQuoteStage} from '../lib/quotes/canonicalQuote';
const read=(p:string)=>fs.readFileSync(path.join(process.cwd(),p),'utf8');
describe('Driver Quotes: protect active quotes from historical withdrawn/expired noise',()=>{
 it('canonical quotes classify terminal stages without rewriting their saved status',()=>{
  for(const status of ['withdrawn','rejected','cancelled','accepted']){
    const stage=canonicalQuoteStage({status},'bidder');
    expect(isTerminalQuoteStage(stage)).toBe(true);
  }
  expect(isTerminalQuoteStage(canonicalQuoteStage({status:'submitted'},'bidder'))).toBe(false);
  expect(isTerminalQuoteStage(canonicalQuoteStage({status:'viewed'},'bidder'))).toBe(false);
 });
 it('keeps exactly two main 3150 tabs and adds a secondary active/history view',()=>{
  const q=read('app/driver/quotes/page.tsx');
  expect(q).toContain("type TabId = 'submitted' | 'awarded'");
  expect(q).toContain("useState<SubmittedQuoteView>('active')");
  expect(q).toContain("const historic=isTerminalQuoteStage(stage)");
  expect(q).toContain("submittedView === 'history' ? historic : !historic");
  expect(q).toContain('Withdrawn / expired / unsuccessful');
  expect(q).toContain('All submitted records');
 });
 it('retains privacy and allows only the saved quote summary for inaccessible jobs',()=>{
  const q=read('app/driver/quotes/page.tsx');
  expect(q).toContain("access: 'protected', pickup: 'Route protected'");
  expect(q).toContain("Only your saved quotation is available; private job details remain protected");
  expect(q).toContain("fullDetailsRestricted ? (expanded?'Hide quote summary':'View saved quote')");
  expect(q).toContain("/api/driver/bids/${encodeURIComponent(bidId)}/withdraw");
  expect(q).not.toContain('Details unavailable');
 });
});
