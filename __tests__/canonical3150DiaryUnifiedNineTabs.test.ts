import { describe, expect, it } from 'vitest';
import {getCanonicalDiaryTabs} from '../lib/diary/canonicalDiary';
import {isDiaryBookingJob} from '../lib/jobs/workspaceJobStage';
import fs from 'node:fs';
import path from 'node:path';

const roles=['customer','broker','carrier','fleet_manager','dispatcher','owner_driver'] as const;
const names=['All','Unallocated','Allocated','In Progress','Completed','Cancelled','Expired','Awaiting Feedback','Recent Feedback'];

describe('3150 nine-tab Diary in every eligible Master Workspace',()=>{
  it('keeps exactly the same approved 9 tabs for every commercial and fleet role',()=>{
    for(const role of roles)expect(getCanonicalDiaryTabs(role).map(item=>item.label),role).toEqual(names);
  });

  it('keeps marketplace-posted loads out of Customer and Broker Diary',()=>{
    const customer=fs.readFileSync(path.join(process.cwd(),'app/customer/diary/page.tsx'),'utf8');
    const broker=fs.readFileSync(path.join(process.cwd(),'app/broker/diary/page.tsx'),'utf8');
    expect(customer).toContain('.filter((job) => isDiaryBookingJob(job))');
    expect(broker).toContain('.filter((job) => isDiaryBookingJob(job))');
    expect(isDiaryBookingJob({status:'posted'})).toBe(false);
    expect(isDiaryBookingJob({status:'awarded'})).toBe(true);
  });

  it('keeps real action controllers instead of demo mutations',()=>{
    const customer=fs.readFileSync(path.join(process.cwd(),'app/customer/diary/page.tsx'),'utf8');
    const broker=fs.readFileSync(path.join(process.cwd(),'app/broker/diary/page.tsx'),'utf8');
    for(const source of [customer,broker]){
      expect(source).toContain('CompanyJobSheetPanel');
      expect(source).toContain('CxDiaryActions');
      expect(source).not.toContain('submitDemo');
    }
  });
});
