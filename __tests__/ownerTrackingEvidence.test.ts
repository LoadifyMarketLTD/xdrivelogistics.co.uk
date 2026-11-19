import {describe,it,expect} from 'vitest';
import {verifiedLiveTracking} from '../app/driver/_components/ownerTrackingEvidence';
const valid={tracking_active:true,fresh:true,location:{lat:53.5,lng:-2.4,recorded_at:'2026-11-19T10:00:00Z'}};
describe('Owner Freight Vision tracking evidence',()=>{
 it('accepts verified active fresh coordinates',()=>expect(verifiedLiveTracking(valid)).toBe(true));
 it('rejects a stale or inactive snapshot',()=>{expect(verifiedLiveTracking({...valid,fresh:false})).toBe(false);expect(verifiedLiveTracking({...valid,tracking_active:false})).toBe(false)});
 it('never coerces missing coordinates to zero or accepts invalid coordinates',()=>{for(const location of [null,{...valid.location,lat:null},{...valid.location,lng:null},{...valid.location,lat:100},{...valid.location,recorded_at:'invalid'}])expect(verifiedLiveTracking({...valid,location})).toBe(false)});
});
