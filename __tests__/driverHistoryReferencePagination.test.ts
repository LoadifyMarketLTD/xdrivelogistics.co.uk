import {describe,it,expect,vi} from 'vitest';
import {findDriverHistoryReferences} from '../lib/jobs/driverHistoryReferencePages';
const jobs=Array.from({length:520},(_,i)=>({id:`job-${i}`,your_ref:i===505?'CUSTOM-REF':i===260?'CUSTOM-REF':null,customer_reference:i===400?'CUSTOM-REF':null,booking_reference:null,driver:i===519?'other':'driver-a'}));
describe('driver reference pagination',()=>{
 it('finds all matches after first 250, with deterministic page order and driver isolation',async()=>{
  const page=vi.fn(async(driver:string,offset:number,count:number)=>({data:jobs.filter(j=>j.driver===driver).slice(offset,offset+count),error:null}));
  const found=await findDriverHistoryReferences('driver-a','CUSTOM-REF',page,200);
  expect(found.map(x=>x.id)).toEqual(['job-260','job-400','job-505']);
  expect(page.mock.calls.map(c=>c[1])).toEqual([0,200,400]);
  expect(page.mock.calls.every(c=>c[0]==='driver-a')).toBe(true);
 });
 it('returns empty for missing reference',async()=>expect(await findDriverHistoryReferences('driver-a','NOT-FOUND',async()=>({data:jobs.slice(0,10),error:null}))).toEqual([]));
 it('propagates query errors',async()=>await expect(findDriverHistoryReferences('driver-a','REF',async()=>({data:null,error:new Error('network')}))).rejects.toThrow('network'));
 it('does not issue query without driver identity',async()=>{const page=vi.fn();expect(await findDriverHistoryReferences('','REF',page)).toEqual([]);expect(page).not.toHaveBeenCalled();});
 it('deduplicates repeated rows by id',async()=>expect(await findDriverHistoryReferences('driver-a','CUSTOM-REF',async()=>({data:[jobs[260],jobs[260]],error:null}),200)).toHaveLength(1));
});
