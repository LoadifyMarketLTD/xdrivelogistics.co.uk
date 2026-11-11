import {describe,it,expect} from 'vitest';
import {adminMasterTab,brokerMasterTab,customerMasterTab} from '../lib/masterWorkspaceRouteTab';

describe('Master 3150 nested operational action routing',()=>{
 const cases:[string,(url:string)=>number,string[],number][]=[
  ['Company bookings',adminMasterTab,['/admin/won-work','/admin/fleet/assignments','/admin/fleet/active-jobs','/admin/collections','/admin/deliveries','/admin/pod'],4],
  ['Company directory',adminMasterTab,['/admin/marketplace/directory','/admin/companies'],10],
  ['Company quotes',adminMasterTab,['/admin/bids','/admin/exchange-quotes'],3],
  ['Company invoices',adminMasterTab,['/admin/finance','/admin/invoices'],8],
  ['Company availability',adminMasterTab,['/admin/live-availability','/admin/fleet/positions','/admin/fleet/future-availability'],11],
  ['Broker bookings',brokerMasterTab,['/broker/jobs','/broker/pod-review','/broker/bookings'],4],
  ['Broker quotes',brokerMasterTab,['/broker/bids','/broker/compare-quotes','/broker/awards'],3],
  ['Broker invoices',brokerMasterTab,['/broker/finance','/broker/customer-invoices','/broker/carrier-costs'],8],
  ['Customer bookings',customerMasterTab,['/customer/jobs','/customer/tracking','/customer/deliveries','/customer/bookings'],4],
  ['Customer quotes',customerMasterTab,['/customer/quotes','/customer/awards'],3],
 ];
 for(const [name,resolve,urls,tab] of cases)it(name,()=>{for(const url of urls)expect(resolve(url),url).toBe(tab)});
});
