import {describe,expect,it} from 'vitest';
import {filterMarketplaceLoads,type MarketplaceLoad,type LoadFilters} from '../app/driver-pwa-fresh/jobs/loadFilters';

const now=Date.parse('2026-11-07T16:38:40Z');
const base:MarketplaceLoad={
 id:'766ca83f-3729-484c-8c3c-7ab4faa4280e',status:'posted',
 pickup_area:'Blackburn',pickup_postcode_area:'BB1',
 delivery_area:'Brighton',delivery_postcode_area:'BN1',
 pickup_datetime:'2026-11-09T10:00:00Z',
 distance_to_pickup_miles:null,distance_to_delivery_miles:null,
 vehicle_type:'luton_tail_lift',requested_vehicle_label:'Luton Tail Lift',requested_vehicle_type:'luton_tail_lift',
};
const filters:LoadFilters={from:'',to:'',vehicle:'',bodyType:'',collectWithin:'',pickupRadius:'10',destinationRadius:''};
const run=(job:MarketplaceLoad,overrides:Partial<LoadFilters>={})=>filterMarketplaceLoads([job],{...filters,...overrides},now);

describe('driver PWA live marketplace location fallback',()=>{
 it('shows Blackburn job when the server has no recent driver GPS',()=>{
  expect(run(base).map(job=>job.id)).toEqual([base.id]);
 });
 it('retains the approved 10-mile radius for known positions',()=>{
  expect(run({...base,distance_to_pickup_miles:9.9})).toHaveLength(1);
  expect(run({...base,distance_to_pickup_miles:10.1})).toHaveLength(0);
 });
 it('does not hide destination jobs solely because destination proximity cannot be computed',()=>{
  expect(run(base,{destinationRadius:'50'})).toHaveLength(1);
  expect(run({...base,distance_to_delivery_miles:60},{destinationRadius:'50'})).toHaveLength(0);
 });
 it('still rejects stale and non-marketplace loads',()=>{
  expect(run({...base,status:'awarded'})).toHaveLength(0);
  expect(run({...base,pickup_datetime:'2026-11-06T10:00:00Z'})).toHaveLength(0);
 });
 it('keeps textual location and vehicle filtering intact',()=>{
  expect(run(base,{from:'Manchester'})).toHaveLength(0);
  expect(run(base,{from:'Blackburn',to:'Brighton',vehicle:'Luton'})).toHaveLength(1);
 });
 it('rejects invalid radius values',()=>{
  expect(run(base,{pickupRadius:'invalid'})).toHaveLength(0);
  expect(run(base,{destinationRadius:'invalid'})).toHaveLength(0);
 });
});
