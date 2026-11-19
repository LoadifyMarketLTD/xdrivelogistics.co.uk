import {describe,it,expect} from 'vitest';
import {parseExtraInput,mayRequestExtra} from '../driver-pwa-reserve/src/ReserveBookingExtras';
import type {LiveJob} from '../driver-pwa-reserve/src/liveApi';
describe('Reserve extra request guard',()=>{
 it('validates real extra amounts and waiting minutes',()=>{expect(parseExtraInput('waiting_time','15.00','30','QA wait')).toEqual({extraType:'waiting_time',amountGbp:15,minutes:30,description:'QA wait'});expect(parseExtraInput('parking','5','30','Parking').minutes).toBeNull();});
 it('refuses invalid amounts, minutes and missing descriptions',()=>{for(const x of ['','0','-2','1.239','10001','Infinity','1e2'])expect(()=>parseExtraInput('parking',x,'','QA')).toThrow();expect(()=>parseExtraInput('waiting_time','15','0','QA')).toThrow();expect(()=>parseExtraInput('waiting_time','15','2.5','QA')).toThrow();expect(()=>parseExtraInput('other','15','','')).toThrow();});
 it('allows only active test bookings, not closed or commercial bookings',()=>{const job={backendStatus:'loaded',isTest:true,podRecorded:false} as LiveJob;expect(mayRequestExtra(job)).toBe(true);expect(mayRequestExtra({...job,isTest:false})).toBe(false);expect(mayRequestExtra({...job,backendStatus:'delivered'})).toBe(false);expect(mayRequestExtra({...job,podRecorded:true})).toBe(false);});
});