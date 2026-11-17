import type { LiveJob } from './liveApi';

// Single lifecycle for the active Reserve PWA. The driver explicitly confirms
// every transport movement. Final POD is canonical evidence and is saved BEFORE
// the parent job may transition from On Site Delivery to Delivered.
export const reserveStatusSteps: Partial<Record<LiveJob['status'], {label:string;backend:string;status:LiveJob['status']}>> = {
  ALLOCATED:{label:'On My Way to Collection',backend:'on_my_way',status:'ON_WAY_TO_PICKUP'},
  ON_WAY_TO_PICKUP:{label:'On Site Collection',backend:'on_site_pickup',status:'ON_SITE_PICKUP'},
  ON_SITE_PICKUP:{label:'Complete Collection',backend:'loaded',status:'LOADED'},
  LOADED:{label:'On My Way to Delivery',backend:'in_transit',status:'ON_WAY_TO_DELIVERY'},
  ON_WAY_TO_DELIVERY:{label:'On Site Delivery',backend:'on_site_delivery',status:'ON_SITE_DELIVERY'},
};

export const reserveUndoTargets: Partial<Record<LiveJob['status'],{expected:string;previous:LiveJob['status']}>> = {
  ON_WAY_TO_PICKUP:{expected:'on_my_way',previous:'ALLOCATED'},
  ON_SITE_PICKUP:{expected:'on_site_pickup',previous:'ON_WAY_TO_PICKUP'},
  LOADED:{expected:'loaded',previous:'ON_SITE_PICKUP'},
  ON_WAY_TO_DELIVERY:{expected:'in_transit',previous:'LOADED'},
  ON_SITE_DELIVERY:{expected:'on_site_delivery',previous:'ON_WAY_TO_DELIVERY'},
};

export const reserveTimelineStages=[
  {key:'ALLOCATED',title:'Accepted'},
  {key:'ON_WAY_TO_PICKUP',title:'On My Way to Pickup'},
  {key:'ON_SITE_PICKUP',title:'On Site (Pickup)'},
  {key:'LOADED',title:'Loaded'},
  {key:'ON_WAY_TO_DELIVERY',title:'On My Way to Final Delivery'},
  {key:'ON_SITE_DELIVERY',title:'On Site (Final Delivery)'},
  {key:'DELIVERED',title:'Delivered / POD'},
  {key:'POD_ARCHIVED',title:'Signed POD archived'},
] as const;

export const reserveTimelineIndex:Record<string,number> =
  Object.fromEntries(reserveTimelineStages.slice(0,-1).map((stage,index)=>[stage.key,index]));
reserveTimelineIndex.POD_SUBMITTED=6;
