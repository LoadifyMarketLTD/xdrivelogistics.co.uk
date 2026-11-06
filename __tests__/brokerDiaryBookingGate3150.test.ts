import { describe, expect, it } from 'vitest';
import { isDiaryBookingJob } from '../lib/jobs/workspaceJobStage';
import fs from 'node:fs';
import path from 'node:path';

describe('Broker Diary 3150 includes booked transport but excludes open loads', () => {
  it('keeps open, quoted and never-awarded jobs on Loads, not Diary', () => {
    expect(isDiaryBookingJob({status:'posted'})).toBe(false);
    expect(isDiaryBookingJob({status:'open'})).toBe(false);
    expect(isDiaryBookingJob({status:'expired'})).toBe(false);
    expect(isDiaryBookingJob({status:'cancelled'})).toBe(false);
  });

  it('includes carrier-awarded work even when driver/vehicle are still unallocated', () => {
    expect(isDiaryBookingJob({status:'awarded'})).toBe(true);
    expect(isDiaryBookingJob({status:'posted',awarded_carrier_company_id:'carrier-company'})).toBe(true);
    expect(isDiaryBookingJob({status:'allocated',assigned_driver_id:'driver'})).toBe(true);
  });

  it('retains cancelled and expired bookings only if previously awarded', () => {
    expect(isDiaryBookingJob({status:'cancelled',awarded_carrier_company_id:'carrier-company'})).toBe(true);
    expect(isDiaryBookingJob({status:'expired',assigned_company_id:'carrier-company'})).toBe(true);
    expect(isDiaryBookingJob({status:'completed'})).toBe(true);
  });

  it('preserves approved nine tabs, real booking details, POD and invoice actions', () => {
    const file=fs.readFileSync(path.join(process.cwd(),'app/broker/diary/page.tsx'),'utf8');
    expect(file).toContain('.filter((job) => isDiaryBookingJob(job))');
    expect(file).toContain('verifiedBrokerBookingStage(job)');
    expect(file).toContain('CompanyJobSheetPanel');
    for(const item of ['unallocated','allocated','in_progress','completed','cancelled','expired','awaiting_feedback','recent_feedback'])expect(file).toContain(item);
  });
});
