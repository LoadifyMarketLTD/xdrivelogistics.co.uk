import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
 historicalJobAliases, matchesHistoricalJobReference, normalizedReference,
 selectHistoricalJobMatches,
} from '../lib/jobs/historicalReferenceLookup';

const jobs = [
 {id:'db68930a-4488-430e-956b-27eb64f60297',customer_ref:'XD-0765',booking_reference:null,customer_reference:null,load_reference:null,load_ref:null},
 {id:'a29732e2-40aa-4991-b87c-1bb67fa06fd1',booking_reference:'XDL-QA-20261107-05',customer_reference:'XDL-QA-20261107-05',customer_ref:'XD-0764'},
 {id:'e2e00000-0000-4000-8000-000000000010',booking_reference:null,customer_ref:'XD-0702'},
 {id:'e2e00000-0000-4000-8000-000000000001',booking_reference:null,customer_ref:'XD-0698'},
 {id:'81b67813-f31f-4350-8c19-84874bbafbe3',booking_reference:'5JP]5J',customer_reference:'NAVSON',customer_ref:'XD-0628'},
];
describe('Historic job number recovery without changing job identity or POD/invoices',()=>{
 it('finds job using XDrive short reference or original full internal identifier',()=>{
   expect(selectHistoricalJobMatches(jobs,'XDL-DB68930A')).toHaveLength(1);
   expect(selectHistoricalJobMatches(jobs,'db68930a-4488-430e-956b-27eb64f60297')).toHaveLength(1);
   expect(selectHistoricalJobMatches(jobs,'XD-0765')).toHaveLength(1);
 });
 it('finds historical poster references even after job completion',()=>{
   expect(selectHistoricalJobMatches(jobs,'XDL-QA-20261107-05')[0].id).toBe(jobs[1].id);
   expect(selectHistoricalJobMatches(jobs,'NAVSON')[0].id).toBe(jobs[4].id);
   expect(selectHistoricalJobMatches(jobs,'5JP]5J')[0].id).toBe(jobs[4].id);
 });
 it('returns BOTH matching historical jobs for a colliding short XDL reference',()=>{
   const matches=selectHistoricalJobMatches(jobs,'XDL-E2E00000');
   expect(matches.map(x=>x.id)).toEqual([jobs[2].id,jobs[3].id]);
   expect(new Set(matches.map(x=>x.id)).size).toBe(2);
 });
 it('unambiguous full UUID can select the intended historical record',()=>{
   const matches=selectHistoricalJobMatches(jobs,'e2e00000-0000-4000-8000-000000000010');
   expect(matches.map(x=>x.id)).toEqual([jobs[2].id]);
 });
 it('normalizes punctuation, case and whitespace for legacy codes',()=>{
   expect(normalizedReference(' xdl-db68930a ')).toBe('XDLDB68930A');
   expect(matchesHistoricalJobReference(jobs[0],'xdl db68930a')).toBe(true);
   expect(matchesHistoricalJobReference(jobs[1],'XDL QA 20261107 05')).toBe(true);
 });
 it('includes saved loading references as searchable legacy aliases without mutating them',()=>{
   const aliases=historicalJobAliases({
     id:jobs[0].id, collection_handover:{loaded:{yourReference:'OLD-BOOK-12',customerReference:'CLIENT-888',jobReference:'XDL-DB68930A'}},
   });
   expect(aliases).toContain('CLIENT-888');
   expect(aliases).toContain('OLD-BOOK-12');
 });
 it('never searches beyond the authorised supplied records and rejects blank queries',()=>{
   expect(selectHistoricalJobMatches([jobs[0]],'XDL-QA-20261107-05')).toHaveLength(0);
   expect(selectHistoricalJobMatches(jobs,'')).toHaveLength(0);
   expect(selectHistoricalJobMatches(jobs,'a'.repeat(130))).toHaveLength(0);
 });
 it('driver mobile AND web server searches scope by assigned driver BEFORE checking aliases',()=>{
   for(const file of ['app/api/driver/mobile/jobs/route.ts','app/api/driver/web/jobs/route.ts']){
     const text=readFileSync(file,'utf8');
     expect(text).toContain("const referenceTerm = searchParams.get('reference')?.trim() || ''");
     expect(text).toContain(".eq('assigned_driver_id', driver.driverId)");
     expect(text).toContain('selectHistoricalJobMatches(all, referenceTerm)');
     expect(text).toContain('.range(offset, offset + pageSize - 1)');
     expect(text).toContain("const historyDays = completedHistory && !referenceTerm");
   }
 });
 it('poster and broker search historical aliases rather than only the UUID',()=>{
   for(const file of ['app/broker/jobs/page.tsx','app/broker/loads/page.tsx']){
     const source=readFileSync(file,'utf8');
     expect(source).toContain('matchesHistoricalJobReference(job, referenceTerm)');
     expect(source).not.toContain('!referenceTerm || job.id.toLowerCase().includes(referenceTerm)');
   }
 });
 it('customer Loads also searches past references without changing their identifiers',()=>{
   const board=readFileSync('app/try-xdrive-demo/components/DemoExchangeBoard.tsx','utf8');
   const provider=readFileSync('app/try-xdrive-demo/components/Company3150LiveData.tsx','utf8');
   const data=readFileSync('app/components/workspace/useCompanyWorkspaceData.ts','utf8');
   expect(board).toContain('Find historical job by reference');
   expect(board).toContain('referenceAliases||[]');
   expect(board).toContain('normalizedReference(reference)');
   expect(provider).toContain('historicalJobAliases(job)');
   expect(provider).toContain("displayId: publicLocations ? 'XDL-' + job.id.slice(0,8).toUpperCase()");
   expect(data).toContain('booking_reference, customer_reference, customer_ref, load_reference, load_ref');
 });
 it('driver PWA lets a driver search all-time history and warns on duplicate matches',()=>{
   const app=readFileSync('driver-pwa-reserve/src/ReserveApp.tsx','utf8');
   expect(app).toContain('scope=completed&compact=1&reference=');
   expect(app).toContain('Check the route and date; no job has been selected automatically.'); // warn rather than auto-open
   expect(app).toContain('historicalSearchResults');
 });
});