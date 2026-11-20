import { describe,it,expect } from 'vitest';
import { londonDate,londonMidnight,shiftDate,reportingStart } from '../app/api/driver/dashboard/commercial-summary/reportingDates';
describe('UK reporting calendar',()=>{
 it.each([['2026-01-15','2026-01-15T00:00:00.000Z'],['2026-07-15','2026-07-14T23:00:00.000Z'],['2026-03-29','2026-03-29T00:00:00.000Z'],['2026-03-30','2026-03-29T23:00:00.000Z'],['2026-10-25','2026-10-24T23:00:00.000Z'],['2026-10-26','2026-10-26T00:00:00.000Z']])('midnight %s',(date,expected)=>expect(londonMidnight(date)?.toISOString()).toBe(expected));
 it('uses a 23 hour spring day',()=>expect(londonMidnight('2026-03-30')!.getTime()-londonMidnight('2026-03-29')!.getTime()).toBe(23*3600000));
 it('uses a 25 hour autumn day',()=>expect(londonMidnight('2026-10-26')!.getTime()-londonMidnight('2026-10-25')!.getTime()).toBe(25*3600000));
 it('uses UK date even before UTC midnight',()=>expect(londonDate(new Date('2026-07-14T23:30:00Z'))).toBe('2026-07-15'));
 it('uses calendar days across DST',()=>expect(reportingStart('7d',new Date('2026-04-02T12:00:00Z'))).toBe('2026-03-26T00:00:00.000Z'));
 it.each(['2026-02-30','2026-13-01','invalid','2026-2-01'])('rejects invalid %s',v=>expect(londonMidnight(v)).toBeNull());
 it('handles year rollover',()=>expect(shiftDate('2026-12-31',1)).toBe('2027-01-01'));
 it('all has no cutoff',()=>expect(reportingStart('all',new Date())).toBeNull());
});
