import {describe,it,expect} from 'vitest';
import {driverQuoteSection} from '../lib/jobs/driverQuoteSections';
describe('approved My Quotes two-tab grouping without changing bid status',()=>{
 it.each(['submitted','pending','awaiting','under_review','accepted','won','open'])('keeps %s in SUBMITTED',status=>{
  expect(driverQuoteSection(status)).toBe('submitted');
 });
 it.each(['withdrawn','rejected','unsuccessful','expired','cancelled','archived','lost','declined'])('shows %s under UNSUCCESSFUL',status=>{
  expect(driverQuoteSection(status)).toBe('unsuccessful');
 });
});
