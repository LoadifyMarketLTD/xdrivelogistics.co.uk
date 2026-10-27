import type { Load } from './FreshJobCard';
export type DemoStage = 'jobs'|'submitted'|'unsuccessful'|'received'|'allocated'|'pickup'|'onsite-pickup'|'loaded'|'delivery'|'onsite-delivery'|'delivered'|'pod'|'invoiced';
export type DemoEntry = {stage:DemoStage;amount?:number;podPhoto?:string;signature?:string};
export type DemoStore = Record<string,DemoEntry>;
const KEY='xdrive-fresh-driver-demo-v1';
export const demoJobs:Load[]=[
{id:'visual-1',status:'posted',pickup_area:'Blackburn',pickup_postcode_area:'BB1',delivery_area:'Manchester',delivery_postcode_area:'M1',pickup_datetime:'2026-11-02T10:00:00Z',delivery_datetime:'2026-11-02T16:00:00Z',pickup_time_slot:'At',delivery_time_slot:'By',vehicle_type:'LWB Van',requested_vehicle_label:'LWB Van',requested_vehicle_type:'LWB Van',service_mode:'TIMED DIRECT',public_quote_notes:'Demo load 1 — handle with care. No actual transport.',distance_to_pickup_miles:8,distance_to_delivery_miles:22,distance_miles:52,weight_kg:375,pallets:1,payment_terms:'30 days',exchange_posted_at:'2026-10-27T12:00:00Z',member:{name:'XDRIVE LOGISTICS LTD',postedBy:'XDRIVE LOGISTICS LTD'}},
{id:'visual-2',status:'posted',pickup_area:'Darwen',pickup_postcode_area:'BB3',delivery_area:'Leeds',delivery_postcode_area:'LS14',pickup_datetime:'2026-11-03T10:00:00Z',delivery_datetime:'2026-11-03T16:00:00Z',pickup_time_slot:'At',delivery_time_slot:'By',vehicle_type:'LWB Van',requested_vehicle_label:'LWB Van',requested_vehicle_type:'LWB Van',service_mode:'DIRECT',public_quote_notes:'Demo load 2 — boxed goods, one pallet. No actual transport.',distance_to_pickup_miles:5,distance_to_delivery_miles:72,distance_miles:72,weight_kg:375,pallets:1,payment_terms:'30 days',exchange_posted_at:'2026-10-27T12:05:00Z',member:{name:'XDRIVE LOGISTICS LTD',postedBy:'XDRIVE LOGISTICS LTD'}}
];
export function readDemo():DemoStore {try{return JSON.parse(localStorage.getItem(KEY)||'{}') as DemoStore;}catch{return {};}}
export function updateDemo(id:string,entry:DemoEntry){const data=readDemo();data[id]=entry;localStorage.setItem(KEY,JSON.stringify(data));window.dispatchEvent(new Event('xdrive-demo-update'));}
export const bookingStages:DemoStage[]=['received','allocated','pickup','onsite-pickup','loaded','delivery','onsite-delivery','delivered','pod','invoiced'];
