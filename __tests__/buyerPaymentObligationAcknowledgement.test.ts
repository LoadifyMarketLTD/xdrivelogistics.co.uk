import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(join(process.cwd(),'supabase/migrations/20260926123823_buyer_payment_obligation_acknowledgement.sql'),'utf8');
const customerApi = readFileSync(join(process.cwd(),'app/api/customer/bids/[id]/award/route.ts'),'utf8');
const adminApi = readFileSync(join(process.cwd(),'app/api/admin/bids/[id]/accept/route.ts'),'utf8');
const obligation = readFileSync(join(process.cwd(),'lib/legal/paymentObligation.ts'),'utf8');
const clientHelper = readFileSync(join(process.cwd(),'lib/legal/paymentObligationClient.ts'),'utf8');
const uiFiles = [
  'app/admin/bids/page.tsx',
  'app/broker/bids/page.tsx',
  'app/customer/jobs/[id]/page.tsx',
  'app/customer/quotes/CustomerQuotesCxPage.tsx',
  'app/customer/CustomerOperationalPages.tsx',
  'app/customer/CustomerWorkspaceModules.tsx',
].map((file)=>readFileSync(join(process.cwd(),file),'utf8'));

describe('buyer payment obligation acknowledgement',()=>{
  it('stores timestamp, actor and server-controlled terms version on the booking offer',()=>{
    expect(migration).toContain('payment_obligation_acknowledged_at timestamptz');
    expect(migration).toContain('payment_obligation_acknowledged_by uuid');
    expect(migration).toContain('payment_obligation_terms_version text');
    expect(migration).toContain('now(),v_actor,btrim(p_payment_obligation_terms_version)');
    expect(migration).toContain("'payment_obligation_acknowledged'");
  });

  it('rejects award at the database boundary when acknowledgement is absent',()=>{
    expect(migration).toContain('p_payment_obligation_acknowledged boolean');
    expect(migration).toContain("'PAYMENT_OBLIGATION_ACK_REQUIRED'");
    expect(migration).toContain('COALESCE(p_payment_obligation_acknowledged,false) IS NOT TRUE');
  });

  it('blocks carrier acceptance if the buyer acknowledgement record is incomplete',()=>{
    expect(migration).toContain('v_offer.payment_obligation_acknowledged_at IS NULL');
    expect(migration).toContain('v_offer.payment_obligation_acknowledged_by IS NULL');
    expect(migration).toContain("v_offer.payment_obligation_terms_version");
  });

  it('requires explicit acknowledgement in both canonical award APIs',()=>{
    for (const api of [customerApi,adminApi]) {
      expect(api).toContain('paymentObligationAcknowledged?: boolean');
      expect(api).toContain('paymentObligationAcknowledged !== true');
      expect(api).toContain('p_payment_obligation_acknowledged: true');
      expect(api).toContain('p_payment_obligation_terms_version: BOOKING_PAYMENT_OBLIGATION_TERMS_VERSION');
    }
  });

  it('uses one explicit wording and one version across all award surfaces',()=>{
    expect(obligation).toContain("BOOKING_PAYMENT_OBLIGATION_TERMS_VERSION = 'xdrive-booking-payment-obligation-v1-2026-09-26'");
    expect(obligation).toContain('responsible for paying the awarded carrier');
    expect(clientHelper).toContain('window.confirm');
    for (const ui of uiFiles) {
      expect(ui).toContain('confirmBookingPaymentObligation');
      expect(ui).toContain('bookingPaymentObligationRequestBody');
    }
  });
});
