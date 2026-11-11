import {describe,expect,it} from 'vitest';
import {brokerMasterTab,adminMasterTab,customerMasterTab} from '../lib/masterWorkspaceRouteTab';
import {masterNavigationHref} from '../lib/masterWorkspaceNavigation';

describe('Master 3150 cross-workspace operational route consistency',()=>{
 it('keeps every Customer canonical route in its actual sidebar section',()=>{
  for(let tab=0;tab<17;tab++){
   const href=masterNavigationHref('Customer',tab);
   if(href)expect(customerMasterTab(href),href).toBe(tab);
  }
 });
 it('keeps nested customer job, booking and tracking actions in Bookings',()=>{
  for(const href of ['/customer/jobs/123','/customer/jobs/123/edit','/customer/tracking/123','/customer/deliveries/123','/customer/bookings/123'])expect(customerMasterTab(href),href).toBe(4);
 });
 it('keeps nested broker quote and POD actions in the correct operational section',()=>{
  expect(brokerMasterTab('/broker/compare-quotes/123')).toBe(3);
  expect(brokerMasterTab('/broker/pod-review/123')).toBe(4);
  expect(brokerMasterTab('/broker/customer-invoices/123')).toBe(8);
 });
 it('keeps every Broker canonical route in its actual sidebar section',()=>{
  for(const tab of [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]){
   const href=masterNavigationHref('Broker',tab);
   if(href)expect(brokerMasterTab(href),href).toBe(tab);
  }
 });
 it('keeps Company / Carrier canonical routes in their actual sidebar section',()=>{
  for(const tab of [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]){
   const href=masterNavigationHref('Company / Carrier',tab);
   if(href)expect(adminMasterTab(href),href).toBe(tab);
  }
 });
});
