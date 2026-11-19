import {describe,it,expect} from 'vitest';
import {stopLabel,stopAuditEvents} from '../driver-pwa-reserve/src/BookingStatusTimeline';
import type {LiveJob,LiveStop} from '../driver-pwa-reserve/src/liveApi';
const stop=(sequence:number,type:LiveStop['type'])=>({id:'s'+sequence,sequence,type,status:'completed',address:'QA',completedAt:'2026-11-19T22:00:00Z',handover:{version:3}} as LiveStop);
describe('Canonical route stop history',()=>{
 it('uses persisted route sequence regardless of the displayed subset',()=>{expect(stopLabel(stop(2,'collection'))).toBe('Collection Stop 2');expect(stopLabel(stop(3,'delivery'))).toBe('Delivery Stop 3');});
 it('includes all verified modern route stops in canonical order, including boundary evidence',()=>{const routeStops=[stop(3,'delivery'),stop(1,'collection'),stop(4,'delivery'),stop(2,'collection')];expect(stopAuditEvents({routeStops} as LiveJob).map(e=>e.status)).toEqual(['Collection Stop 1 Completed','Collection Stop 2 Completed','Delivery Stop 3 Completed','Delivery Stop 4 Completed']);});
 it('does not duplicate standard two-stop legacy history',()=>{expect(stopAuditEvents({routeStops:[stop(1,'collection'),stop(2,'delivery')]} as LiveJob)).toEqual([]);});
});