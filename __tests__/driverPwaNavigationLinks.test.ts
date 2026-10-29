import {describe,it,expect} from 'vitest';
import {navigationDestination,navigationUrl} from '../lib/jobs/driverNavigationLinks';
describe('OPPO map link regression',()=>{
 it('does not triple outcodes from legacy jobs',()=>{
  expect(navigationDestination('BB2, BB2','BB2')).toBe('BB2');
  expect(navigationDestination('BB2','BB2')).toBe('BB2');
  expect(navigationDestination('Blackburn BB2','BB2')).toBe('Blackburn BB2');
  expect(navigationDestination('1 Test Road, Blackburn, BB2 1AA','BB2 1AA')).toBe('1 Test Road, Blackburn, BB2 1AA');
 });
 it('adds United Kingdom to ambiguous bare outcodes but not an existing full address',()=>{
  expect(navigationDestination('1 Collection Road, Blackburn','BB2 1AA')).toBe('1 Collection Road, Blackburn, BB2 1AA');
  expect(navigationUrl('BB2','BB2','view')).toBe('https://www.google.com/maps/search/?api=1&query=BB2%2C%20United%20Kingdom');
  expect(navigationUrl('BB2','BB2','navigate')).toBe('https://www.google.com/maps/dir/?api=1&destination=BB2%2C%20United%20Kingdom');
  expect(navigationUrl(null,null,'view')).toBeNull();
 });
});
