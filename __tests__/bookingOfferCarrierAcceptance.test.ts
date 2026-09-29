import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(join(process.cwd(),'supabase/migrations/20260926122647_booking_offer_carrier_acceptance.sql'),'utf8');
const customerAward = readFileSync(join(process.cwd(),'app/api/customer/bids/[id]/award/route.ts'),'utf8');
const carrierRespond = readFileSync(join(process.cwd(),'app/api/booking-offers/[id]/respond/route.ts'),'utf8');
const inbox = readFileSync(join(process.cwd(),'app/components/workspace/PendingBookingOffers.tsx'),'utf8');

describe('buyer award and carrier commercial acceptance',()=>{
  it('keeps buyer award separate from contract formation',()=>{
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.job_booking_offers');
    expect(migration).toContain("status text NOT NULL DEFAULT 'pending'");
    expect(migration).toContain('public.award_job_bid_pending_atomic');
    const awardBody=migration.slice(migration.indexOf('public.award_job_bid_pending_atomic'),migration.indexOf('public.accept_job_booking_offer_atomic'));
    expect(awardBody).not.toContain('INSERT INTO public.job_commercial_agreements');
    expect(awardBody).not.toContain("SET status=CASE WHEN jb.id=v_bid.id THEN 'accepted'");
  });

  it('forms the commercial agreement only when the carrier accepts',()=>{
    expect(migration).toContain('public.accept_job_booking_offer_atomic');
    expect(migration).toContain("SET status=CASE WHEN jb.id=v_bid.id THEN 'accepted' ELSE 'rejected' END");
    expect(migration).toContain('INSERT INTO public.job_commercial_agreements');
    expect(migration).toContain("SET status='accepted',responded_by=v_actor,responded_at=now(),commercial_agreement_id=v_agreement_id");
  });

  it('supports an auditable carrier decline without pretending a booking was accepted',()=>{
    expect(migration).toContain('public.decline_job_booking_offer_atomic');
    expect(migration).toContain("SET status='declined'");
    expect(migration).toContain("'booking_offer_declined'");
  });

  it('uses server-only database authority for booking offers',()=>{
    expect(migration).toContain('ALTER TABLE public.job_booking_offers ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('REVOKE ALL ON TABLE public.job_booking_offers FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('GRANT SELECT, INSERT, UPDATE ON TABLE public.job_booking_offers TO service_role');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.accept_job_booking_offer_atomic(uuid,uuid) FROM PUBLIC, anon, authenticated');
  });

  it('routes canonical buyer awards into pending carrier acceptance',()=>{
    expect(customerAward).toContain("'award_job_bid_pending_atomic'");
    expect(customerAward).toContain('bookingOfferId: result.booking_offer_id');
    expect(customerAward).not.toContain("'accept_job_bid_atomic'");
  });

  it('provides explicit Accept Booking and Decline actions to the carrier',()=>{
    expect(carrierRespond).toContain("z.enum(['accept', 'decline'])");
    expect(carrierRespond).toContain("'accept_job_booking_offer_atomic'");
    expect(carrierRespond).toContain("'decline_job_booking_offer_atomic'");
    expect(inbox).toContain('Accept Booking');
    expect(inbox).toContain('A buyer award is not a confirmed transport booking until you accept');
  });
});
