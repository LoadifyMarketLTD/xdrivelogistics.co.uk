import {describe,expect,it} from 'vitest';
import {brokerMasterTab} from '../lib/masterWorkspaceRouteTab';

describe('Broker Master Workspace highlights the actual 3150 section',()=>{
 it('selects My Fleet and Drivers, never Dashboard, on their real routes',()=>{
  expect(brokerMasterTab('/broker/fleet')).toBe(5);
  expect(brokerMasterTab('/broker/drivers')).toBe(6);
 });
 it('retains the canonical five modules and booking/diary navigation',()=>{
  expect(brokerMasterTab('/broker/loads')).toBe(2);
  expect(brokerMasterTab('/broker/bids')).toBe(3);
  expect(brokerMasterTab('/broker/jobs')).toBe(4);
  expect(brokerMasterTab('/broker/diary')).toBe(7);
  expect(brokerMasterTab('/broker')).toBe(0);
 });
});