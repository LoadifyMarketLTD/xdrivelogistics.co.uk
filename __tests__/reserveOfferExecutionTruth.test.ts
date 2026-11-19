/// <reference types="vite/client" />
import {describe,it,expect} from 'vitest';
import {applyBookingOffers} from '../driver-pwa-reserve/src/liveApi';
import type {LiveJob} from '../driver-pwa-reserve/src/liveApi';
const base={id:'job-1',from:'Blackburn',to:'Manchester',vehicle:'LWB',weight:100,pickup:'',delivery:'',notes:'',status:'ALLOCATED',backendStatus:'allocated'} as LiveJob;
const offer=(status:string|undefined,offerStatus='accepted')=>({offers:[{id:'offer-1',job_id:'job-1',status:offerStatus,job:{current_status:status},quoted_amount:125}]});
describe('Reserve accepted offer execution source of truth',()=>{
 it('does not manufacture an executable booking from an accepted offer without canonical status',()=>{expect(applyBookingOffers([],offer(undefined))).toEqual([]);});
 it('does not reopen a delivered job as allocated when the execution feed is missing',()=>{expect(applyBookingOffers([],offer('delivered'))[0]).toMatchObject({status:'DELIVERED',backendStatus:'delivered',acceptanceRequired:false});});
 it('overrides a stale allocated card when canonical job is delivered',()=>{expect(applyBookingOffers([base],offer('delivered'))[0]).toMatchObject({status:'DELIVERED',backendStatus:'delivered'});});
 it('retains real allocated jobs and pending offers',()=>{expect(applyBookingOffers([],offer('allocated'))[0].status).toBe('ALLOCATED');expect(applyBookingOffers([],offer('posted','pending'))[0].acceptanceRequired).toBe(true);});
 it('does not resurrect cancelled or terminal pending offers',()=>{expect(applyBookingOffers([base],offer('cancelled'))).toEqual([]);expect(applyBookingOffers([],offer('completed','pending'))).toEqual([]);});
 it('recognises invoiced and paid as historical execution',()=>{for(const s of ['invoiced','paid'])expect(applyBookingOffers([],offer(s))[0].status).toBe('DELIVERED');});
});