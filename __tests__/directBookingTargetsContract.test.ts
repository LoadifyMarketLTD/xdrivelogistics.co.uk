import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('direct booking target contract', () => {
  const form = read('app/components/workspace/LoadPostingForm.tsx');
  const create = read('app/api/jobs/create/route.ts');
  const resources = read('app/api/jobs/direct-booking-resources/route.ts');
  const migration = read('supabase/migrations/20261009104500_add_direct_booking_targets.sql');

  it('persists canonical direct booking target metadata', () => {
    expect(migration).toContain('direct_booking_target_type text');
    expect(migration).toContain("'exchange_member','external_subcontractor','internal_resource'");
    expect(create).toContain("type: z.literal('exchange_member')");
    expect(create).toContain("type: z.literal('external_subcontractor')");
    expect(create).toContain("type: z.literal('internal_resource')");
    expect(create).toContain('direct_booking_target_type: requestedDirectTarget?.type ?? null');
  });

  it('supports marketplace, external subcontractor, and internal driver/vehicle flows in the shared posting form', () => {
    expect(form).toContain('XDrive Exchange');
    expect(form).toContain('External subcontractor');
    expect(form).toContain('Company driver + vehicle');
    expect(form).toContain("directTargetMode === 'external_subcontractor'");
    expect(form).toContain("directTargetMode === 'internal_resource'");
    expect(form).toContain('Confirm External Booking');
    expect(form).toContain('Create & Allocate Booking');
  });

  it('keeps internal Direct Booking resources company-scoped and active', () => {
    expect(resources).toContain(".eq('company_id', companyId)");
    expect(resources).toContain(".eq('status', 'active')");
    expect(resources).toContain("['owner', 'admin', 'fleet_manager', 'dispatcher'].includes(role)");
    expect(create).toContain(".eq('company_id', input.companyId)");
    expect(create).toContain('The selected internal driver is not active in this company.');
    expect(create).toContain('The selected internal vehicle is not active in this company.');
  });

  it('keeps exchange-member Direct Booking subject to legal, Stripe and block checks', () => {
    expect(create).toContain('areCompaniesBlocked');
    expect(create).toContain('getCommercialLegalReadiness');
    expect(create).toContain('getStripeCommercialReadiness');
    expect(create).toContain('A company cannot send a Direct Booking to itself.');
  });
});
