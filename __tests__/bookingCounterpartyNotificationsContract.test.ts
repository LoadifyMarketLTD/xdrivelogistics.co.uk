import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const sql = readFileSync('supabase/migrations/20261107034000_booking_offer_counterparty_notifications.sql','utf8');
const inbox = readFileSync('app/components/workspace/PendingBookingOffers.tsx','utf8');
describe('Customer -> Driver -> Customer booking notification contract (draft migration)',()=>{
  it('notifies named driver plus carrier decision-makers when Customer sends offer',()=>{
    expect(sql).toContain("TG_OP='INSERT' AND NEW.status='pending'");
    expect(sql).toContain('SELECT d.user_id FROM public.drivers d WHERE d.id=NEW.bidder_driver_id');
    expect(sql).toContain("cm.role_in_company::text IN ('owner','admin','dispatcher')");
    expect(sql).toContain("'booking_offer_pending'");
  });
  it('notifies buyer decision-makers on accepted or declined carrier response',()=>{
    expect(sql).toContain("NEW.status IN ('accepted','declined')");
    expect(sql).toContain("cm.company_id=NEW.buyer_company_id");
    expect(sql).toContain("'booking_offer_accepted'");
    expect(sql).toContain("'booking_offer_declined'");
    expect(sql).toContain('SECURITY INVOKER');
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.fn_notify_booking_offer_counterparties() FROM PUBLIC, anon, authenticated');
    expect(sql).toContain("n.body LIKE '%' || NEW.id::text || '%'");
  });
  it('refreshes booking inbox without clearing or reloading existing content',()=>{
    expect(inbox).toContain('useVisibleRefresh');
    expect(inbox).toContain('load({background:true})');
    expect(inbox).toContain('if(!background)setOffers([])');
  });
});