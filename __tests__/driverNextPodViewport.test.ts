import fs from 'node:fs';
import {describe,expect,it} from 'vitest';
const css=fs.readFileSync('driver-pwa-next/src/BookingCXStatus.css','utf8');
describe('Driver NEXT POD mobile viewport',()=>{
 it('hides Summary / Stops / Status tabs while entering signed POD',()=>{
  expect(css).toContain('.xb-workspace:has(.xb-cx-operation) .xb-tabs{display:none}');
 });
 it('keeps the POD form scrollable above the fixed bottom nav',()=>{
  expect(css).toContain('height:calc(100dvh - 150px)');
  expect(css).toContain('overflow-y:auto');
  expect(css).toContain('.xb-cx-operation .xb-form-actions{position:sticky;bottom:0');
 });
 it('does not repeat the POD heading inside the form',()=>{
  expect(css).toContain('.xb-cx-operation .xb-delivery-header h3');
  expect(css).toContain('display:none');
 });
});
