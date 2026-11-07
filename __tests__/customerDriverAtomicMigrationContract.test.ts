import{describe,it,expect}from 'vitest';
import{readFileSync}from 'node:fs';
const sql=readFileSync('supabase/migrations/20261107033000_customer_driver_booking_atomic_guardrails.sql','utf8');
describe('unapplied Customer-Driver transaction migration contract',()=>{
 it('guards booking offer creation and acceptance inside DB transaction',()=>{
  expect(sql).toContain('BEFORE INSERT OR UPDATE OF status ON public.job_booking_offers');
  expect(sql).toContain('FOR UPDATE');
  expect(sql).toContain('j.pickup_datetime <= now()');
 });
 it('checks actual quoted driver, vehicle, capacity and tail-lift',()=>{
  expect(sql).toContain('NEW.quoted_vehicle_id IS DISTINCT FROM b.quote_vehicle_id');
  expect(sql).toContain('v.assigned_driver_id IS DISTINCT FROM NEW.bidder_driver_id');
  expect(sql).toContain('j.pallets > cap');
  expect(sql).toContain('v.has_tail_lift');
 });
 it('prevents driver withdrawal or buyer rejection while booking offer pending',()=>{
  expect(sql).toContain('BEFORE UPDATE OF status ON public.job_bids');
  expect(sql).toContain("NEW.status IN ('withdrawn', 'rejected')");
  expect(sql).toContain("o.status='pending'");
 });
});