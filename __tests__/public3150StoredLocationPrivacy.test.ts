import {describe,expect,it} from 'vitest';
import {public3150StoredLocation} from '../lib/jobs/public3150StoredLocation';
describe('Original 3150 Loads display sanitizes authenticated addresses',()=>{
 it('shows only town and outcode for full town hall addresses',()=>{
  expect(public3150StoredLocation('Bolton Town Hall, Victoria Square, Bolton, BL1 1RU','BL1 1RU')).toBe('Bolton, BL1');
  expect(public3150StoredLocation('Preston Town Hall, Lancaster Road, Preston, PR1 2RL','PR1 2RL')).toBe('Preston, PR1');
 });
 it('never displays house number or street in load cards and transport detail town fields',()=>{
  for (const value of ['123 High Street, Brighton, BN1 1AB','Brighton, BN1 1AB','12 High Street, BN1 1AB']) {
   const label = public3150StoredLocation(value,'BN1 1AB');
   expect(label).not.toMatch(/High Street|123|12 |1AB/);
   expect(label).toContain('BN1');
  }
 });
 it('uses privacy fallback when postcode or town cannot be identified',()=>{
  expect(public3150StoredLocation('24 Private Street',null)).toBe('Location not supplied');
 });
});